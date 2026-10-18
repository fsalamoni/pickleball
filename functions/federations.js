/**
 * FEDERAÇÕES — o que só o SERVIDOR faz (flag `federations`).
 *
 * A regra do Firestore não deixa o navegador criar filiação, mudar o estado
 * dela, criar cobrança nem confirmar pagamento. Tudo passa por aqui:
 *
 *  - REVISÃO da federação (`review`, admin da plataforma): aprova (e cria o
 *    presidente na equipe), recusa, suspende, verifica, marca como oficial;
 *  - FILIAÇÃO (`membership`): o pedido da própria pessoa (confere plano,
 *    idade, filiação viva), a decisão da secretaria (aprovar gera o número
 *    numa transação sobre `member_counter`; plano pago gera a cobrança),
 *    renovação, cancelamento, suspensão e reintegração — o código da
 *    carteirinha GIRA ao renovar e ao suspender;
 *  - COBRANÇA (`chargeConfirm`, financeiro): confirmar ativa ou renova a
 *    filiação; cancelar devolve o pedido ao estado anterior;
 *  - VARREDURA diária (`sweep`): `active` → `expired` na data; avisos
 *    30/7/1 dias antes (uma vez cada); contagem de filiados;
 *  - VERIFICAÇÃO (`verify`, pública): o mínimo da carteirinha pelo código.
 *
 * ⚠️ A conta da validade é CÓPIA de `src/modules/federations/domain/
 * membership.js` (`federationMembership.js`, com paridade).
 */
const crypto = require('node:crypto');
const m = require('./federationMembership.js');
const { tx, textoDoAviso, i18nDoAviso } = require('./avisoI18n.js');

class FederationError extends Error {
  constructor(code, message) { super(message); this.code = code; this.name = 'FederationError'; }
}
const falha = (code, msg) => { throw new FederationError(code, msg); };

const C = Object.freeze({
  federations: 'federations', staff: 'federation_staff', plans: 'federation_plans',
  members: 'federation_members', charges: 'federation_charges', cardIndex: 'federation_card_index',
});
const PERMS = Object.freeze({
  president: ['admin', 'members', 'finance', 'competitions', 'courses', 'discipline', 'comms'],
  director: ['admin', 'members', 'finance', 'competitions', 'courses', 'discipline', 'comms'],
  secretary: ['members'], treasurer: ['finance'], competitions: ['competitions'], referees: ['courses'],
  discipline: ['discipline'], communication: ['comms'],
});
const LIVE = Object.freeze(['pending', 'awaiting_payment', 'active', 'expired', 'suspended']);
const texto = (v, max = 300) => String(v == null ? '' : v).trim().slice(0, max);

/* ------------------------------------------------------------- avisos -- */

function aviso(ctx, batch, userId, { title, message, link }) {
  const i18n = i18nDoAviso({ title, message });
  batch.set(ctx.db.collection('notifications').doc(), {
    user_id: userId, title: textoDoAviso(title), message: textoDoAviso(message), ...(i18n ? { i18n } : {}),
    type: 'federation', link, read: false, archived: false, origin: 'server', essential: true,
    created_at: ctx.Timestamp.fromMillis(ctx.now),
  });
}

async function auditoria(ctx, actor, action, details) {
  await ctx.db.collection('audit_logs').add({
    log_number: Number(`${ctx.now}${Math.floor(Math.random() * 900 + 100)}`),
    action, action_label: action, actor_id: actor.uid, actor_name: actor.name || actor.uid, actor_email: actor.email || '',
    tournament_id: null, user_id: details.user_id || null, details, created_at: ctx.Timestamp.fromMillis(ctx.now),
  });
}

/* --------------------------------------------------------------- quem -- */

async function flagLigada(ctx) {
  const snap = await ctx.db.collection('platform_settings').doc('global').get();
  return Boolean(snap.exists && snap.data().feature_flags && snap.data().feature_flags.federations === true);
}

async function staffPerms(ctx, fedId, actor) {
  if (actor.isPlatformAdmin) return PERMS.president;
  const snap = await ctx.db.collection(C.staff).doc(`${fedId}_${actor.uid}`).get();
  return snap.exists ? (PERMS[snap.data().role] || []) : [];
}

async function exigePerm(ctx, fedId, actor, perm) {
  const perms = await staffPerms(ctx, fedId, actor);
  if (!perms.includes(perm)) falha('permission-denied', 'Você não tem permissão para isso nesta federação.');
}

async function federacao(ctx, fedId) {
  const snap = await ctx.db.collection(C.federations).doc(texto(fedId, 80)).get();
  if (!snap.exists) falha('not-found', 'Federação não encontrada.');
  return { id: snap.id, ...snap.data() };
}

const staffIds = async (ctx, fedId, perm) => {
  const snap = await ctx.db.collection(C.staff).where('federation_id', '==', fedId).get();
  return snap.docs.map((d) => d.data()).filter((s) => (PERMS[s.role] || []).includes(perm)).map((s) => s.user_id);
};

const novoCodigo = () => m.cardCodeFromBytes(crypto.randomBytes(m.CARD_CODE_LENGTH));

/* ------------------------------------------------------------- review -- */

const REVIEW = Object.freeze({
  approve: { from: ['pending', 'suspended', 'rejected'], patch: { status: 'approved' } },
  reject: { from: ['pending'], patch: { status: 'rejected' }, needsReason: true },
  suspend: { from: ['approved'], patch: { status: 'suspended' }, needsReason: true },
  verify: { from: ['approved'], patch: { verified: true } },
  unverify: { from: ['approved'], patch: { verified: false } },
  official: { from: ['approved'], patch: { official: true } },
  unofficial: { from: ['approved'], patch: { official: false } },
});

async function review(ctx, actor, data) {
  if (!actor.isPlatformAdmin) falha('permission-denied', 'Só o admin da plataforma revisa federações.');
  const acao = REVIEW[data.action];
  if (!acao) falha('invalid-argument', 'Ação desconhecida.');
  const reason = texto(data.reason, 500);
  if (acao.needsReason && reason.length < 3) falha('invalid-argument', 'Diga o motivo.');
  const fed = await federacao(ctx, data.federationId);
  if (!acao.from.includes(fed.status)) falha('failed-precondition', 'A federação já mudou de estado. Atualize a página.');

  const batch = ctx.db.batch();
  const ref = ctx.db.collection(C.federations).doc(fed.id);
  batch.update(ref, { ...acao.patch, review: { action: data.action, reason, by: actor.uid, at_ms: ctx.now }, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  // Aprovar pela primeira vez cria o presidente: quem pediu a abertura.
  if (data.action === 'approve' && fed.created_by) {
    const staffRef = ctx.db.collection(C.staff).doc(`${fed.id}_${fed.created_by}`);
    const atual = await staffRef.get();
    if (!atual.exists) {
      batch.set(staffRef, { federation_id: fed.id, federation_name: fed.name, federation_acronym: fed.acronym || '', user_id: fed.created_by, user_name: fed.created_by_name || '', role: 'president', added_by: actor.uid, created_at: ctx.Timestamp.fromMillis(ctx.now) });
    }
  }
  const link = `/federacoes/${fed.id}/gerir`;
  const avisos = {
    approve: [tx('{sigla} foi aprovada'), tx('A federação está no ar. Configure o Pix, os planos e a equipe na Central da federação.')],
    reject: [tx('O pedido da {sigla} foi recusado'), tx('Motivo: {motivo}. Corrija e peça de novo.')],
    suspend: [tx('{sigla} foi suspensa'), tx('Motivo: {motivo}. A página e as filiações ficam fora do ar até a revisão.')],
    verify: [tx('{sigla} recebeu o selo de verificada'), tx('O CNPJ e o estatuto foram conferidos pela plataforma.')],
    official: [tx('{sigla} foi marcada como oficial'), tx('A federação aparece com o selo de oficial no diretório e na página.')],
  };
  if (avisos[data.action] && fed.created_by) {
    const [title, message] = avisos[data.action];
    const params = { sigla: fed.acronym || fed.name, motivo: reason };
    aviso(ctx, batch, fed.created_by, { title: tx(title.$t, params), message: tx(message.$t, params), link });
  }
  await batch.commit();
  await auditoria(ctx, actor, `federation_review_${data.action}`, { federation_id: fed.id, reason });
  return { ok: true, status: acao.patch.status || fed.status };
}

/* --------------------------------------------------------- membership -- */

/** Ativa (ou renova) numa transação: número sequencial, validade, código novo, índice da carteirinha. */
async function ativar(ctx, tr, { fed, memberRef, member, plan, hoje }) {
  const fedRef = ctx.db.collection(C.federations).doc(fed.id);
  const fedSnap = await tr.get(fedRef);
  const fedNow = fedSnap.data() || {};
  const patch = { status: 'active', updated_at: ctx.Timestamp.fromMillis(ctx.now) };
  if (!member.member_number) {
    const seq = (Number(fedNow.member_counter) || 0) + 1;
    patch.member_number = m.formatMemberNumber(fedNow.acronym, Number(hoje.slice(0, 4)), seq);
    tr.update(fedRef, { member_counter: seq });
  }
  const inicio = m.renewalStart(member, hoje);
  patch.valid_from = member.valid_from || hoje;
  patch.valid_until = m.computeValidUntil(plan, inicio);
  patch.activated_at_ms = ctx.now;
  patch.expiry_notified = {};
  // O código GIRA a cada ativação: carteirinha antiga clonada não continua "em dia".
  const code = novoCodigo();
  if (member.card_code) tr.delete(ctx.db.collection(C.cardIndex).doc(member.card_code));
  tr.set(ctx.db.collection(C.cardIndex).doc(code), { member_id: memberRef.id, federation_id: fed.id, created_at_ms: ctx.now });
  patch.card_code = code;
  tr.update(memberRef, patch);
  return { ...member, ...patch };
}

function novaCobranca(ctx, batchOrTr, { fed, member, memberId, plan, origin, hoje }) {
  const ref = ctx.db.collection(C.charges).doc();
  const data = {
    federation_id: fed.id, member_id: memberId, payer_uid: member.user_id, payer_name: member.user_name || '',
    origin, plan_id: plan.id, plan_name: plan.name, amount_cents: Math.max(0, Math.trunc(Number(plan.price_cents) || 0)),
    status: 'open', due_date: m.chargeDueDate(hoje), created_at: ctx.Timestamp.fromMillis(ctx.now), created_at_ms: ctx.now,
  };
  batchOrTr.set(ref, data);
  return { id: ref.id, ...data };
}

async function plano(ctx, fedId, planId) {
  const snap = await ctx.db.collection(C.plans).doc(texto(planId, 80)).get();
  if (!snap.exists || snap.data().federation_id !== fedId) falha('not-found', 'Plano não encontrado nesta federação.');
  return { id: snap.id, ...snap.data() };
}

async function membership(ctx, actor, data) {
  if (!(await flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await federacao(ctx, data.federationId);
  const hoje = m.isoDateBR(ctx.now);
  const acao = texto(data.action, 30);
  const propria = ['request', 'renew', 'cancel'].includes(acao);
  const uid = propria ? actor.uid : texto(data.userId, 128);
  if (!uid) falha('invalid-argument', 'Diga de quem é a filiação.');
  if (!propria) await exigePerm(ctx, fed.id, actor, 'members');
  const memberRef = ctx.db.collection(C.members).doc(`${fed.id}_${uid}`);
  const snap = await memberRef.get();
  const member = snap.exists ? { id: snap.id, ...snap.data() } : null;
  const reason = texto(data.reason, 500);
  const link = `/perfil?secao=federacoes`;

  if (acao === 'request') {
    if (fed.status !== 'approved') falha('failed-precondition', 'Esta federação não está recebendo filiações.');
    if (member && LIVE.includes(member.status)) falha('already-exists', 'Você já tem uma filiação nesta federação.');
    const p = await plano(ctx, fed.id, data.planId);
    if (p.active === false) falha('failed-precondition', 'Este plano não está mais disponível.');
    const perfil = await ctx.db.collection('users').doc(uid).get();
    const u = perfil.exists ? perfil.data() : {};
    const idade = idadeDe(u.birth_date, hoje);
    if (p.age_min != null && idade != null && idade < p.age_min) falha('failed-precondition', 'Este plano exige idade mínima maior que a sua.');
    if (p.age_max != null && idade != null && idade > p.age_max) falha('failed-precondition', 'Este plano tem idade máxima menor que a sua.');
    const gratis = !(Number(p.price_cents) > 0);
    const doc = {
      federation_id: fed.id, federation_name: fed.name, federation_acronym: fed.acronym || '', user_id: uid, user_name: texto(u.platform_name || u.full_name || u.display_name || 'Atleta', 120),
      photo_url: texto(u.photo_url || u.avatar_url, 500), person_type: p.person_type || 'athlete', tier: p.tier || 'federated',
      plan_id: p.id, plan_name: p.name, billing: p.billing || 'annual', status: 'pending',
      public_badge: data.publicBadge !== false, show_in_directory: data.showInDirectory === true, public_photo: true,
      represented_club_id: texto(data.clubId, 80) || null, note: texto(data.note, 300),
      requested_at: ctx.Timestamp.fromMillis(ctx.now), requested_at_ms: ctx.now, updated_at: ctx.Timestamp.fromMillis(ctx.now),
      member_number: (member && member.member_number) || null, card_code: null, valid_from: null, valid_until: null, expiry_notified: {},
    };
    let charge = null;
    if (p.auto_approve) {
      if (gratis) {
        await ctx.db.runTransaction(async (tr) => {
          tr.set(memberRef, doc);
          await ativar(ctx, tr, { fed, memberRef, member: doc, plan: p, hoje });
        });
      } else {
        const batch = ctx.db.batch();
        batch.set(memberRef, { ...doc, status: 'awaiting_payment' });
        charge = novaCobranca(ctx, batch, { fed, member: doc, memberId: memberRef.id, plan: p, origin: 'membership', hoje });
        await batch.commit();
      }
    } else {
      const batch = ctx.db.batch();
      batch.set(memberRef, doc);
      const secretaria = await staffIds(ctx, fed.id, 'members');
      secretaria.forEach((sid) => aviso(ctx, batch, sid, {
        title: tx('Novo pedido de filiação na {sigla}', { sigla: fed.acronym }),
        message: tx('{nome} pediu filiação no plano {plano}. Analise na Central da federação.', { nome: doc.user_name, plano: p.name }),
        link: `/federacoes/${fed.id}/gerir?aba=pedidos`,
      }));
      await batch.commit();
    }
    await auditoria(ctx, actor, 'federation_membership_request', { federation_id: fed.id, user_id: uid, plan_id: p.id });
    return { ok: true, memberId: memberRef.id, chargeId: charge ? charge.id : null };
  }

  if (!member) falha('not-found', 'Filiação não encontrada.');
  const p = member.plan_id ? await plano(ctx, fed.id, member.plan_id).catch(() => null) : null;

  if (acao === 'approve') {
    if (member.status !== 'pending') falha('failed-precondition', 'Este pedido já foi decidido.');
    if (!p) falha('failed-precondition', 'O plano deste pedido não existe mais.');
    const gratis = !(Number(p.price_cents) > 0);
    let charge = null;
    if (gratis) {
      await ctx.db.runTransaction(async (tr) => {
        await ativar(ctx, tr, { fed, memberRef, member, plan: p, hoje });
        tr.update(memberRef, { decided_by: actor.uid, decided_at_ms: ctx.now });
      });
    } else {
      const batch = ctx.db.batch();
      batch.update(memberRef, { status: 'awaiting_payment', decided_by: actor.uid, decided_at_ms: ctx.now, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
      charge = novaCobranca(ctx, batch, { fed, member, memberId: memberRef.id, plan: p, origin: 'membership', hoje });
      await batch.commit();
    }
    const batch = ctx.db.batch();
    aviso(ctx, batch, uid, gratis
      ? { title: tx('Sua filiação na {sigla} foi aprovada', { sigla: fed.acronym }), message: tx('A carteirinha digital já está na sua Minha área.'), link }
      : { title: tx('Sua filiação na {sigla} foi aprovada', { sigla: fed.acronym }), message: tx('Falta o pagamento: pague pelo Pix e toque em "Já paguei". A carteirinha sai quando o financeiro confirmar.'), link });
    await batch.commit();
    await auditoria(ctx, actor, 'federation_membership_approve', { federation_id: fed.id, user_id: uid });
    return { ok: true, chargeId: charge ? charge.id : null };
  }

  if (acao === 'reject') {
    if (member.status !== 'pending') falha('failed-precondition', 'Este pedido já foi decidido.');
    if (reason.length < 3) falha('invalid-argument', 'Diga o motivo da recusa.');
    const batch = ctx.db.batch();
    batch.update(memberRef, { status: 'rejected', reject_reason: reason, decided_by: actor.uid, decided_at_ms: ctx.now, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
    aviso(ctx, batch, uid, { title: tx('Sua filiação na {sigla} foi recusada', { sigla: fed.acronym }), message: tx('Motivo: {motivo}. Você pode corrigir e pedir de novo.', { motivo: reason }), link });
    await batch.commit();
    await auditoria(ctx, actor, 'federation_membership_reject', { federation_id: fed.id, user_id: uid, reason });
    return { ok: true };
  }

  if (acao === 'renew') {
    const st = m.membershipState(member, hoje);
    if (!st.canRenew) falha('failed-precondition', 'A renovação abre 30 dias antes do vencimento.');
    if (!p || p.active === false) falha('failed-precondition', 'O plano desta filiação não está mais disponível. Fale com a federação.');
    const aberta = await ctx.db.collection(C.charges).where('member_id', '==', memberRef.id).get();
    if (aberta.docs.some((d) => ['open', 'declared'].includes(d.data().status) && d.data().origin === 'renewal')) falha('already-exists', 'Já existe uma cobrança de renovação em aberto.');
    if (!(Number(p.price_cents) > 0)) {
      await ctx.db.runTransaction(async (tr) => { await ativar(ctx, tr, { fed, memberRef, member, plan: p, hoje }); });
      return { ok: true, chargeId: null };
    }
    const batch = ctx.db.batch();
    const charge = novaCobranca(ctx, batch, { fed, member, memberId: memberRef.id, plan: p, origin: 'renewal', hoje });
    await batch.commit();
    return { ok: true, chargeId: charge.id };
  }

  if (acao === 'cancel') {
    if (!LIVE.includes(member.status)) falha('failed-precondition', 'Esta filiação já está encerrada.');
    const batch = ctx.db.batch();
    batch.update(memberRef, { status: 'cancelled', cancelled_at_ms: ctx.now, cancelled_by: actor.uid, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
    const abertas = await ctx.db.collection(C.charges).where('member_id', '==', memberRef.id).get();
    abertas.docs.filter((d) => ['open', 'declared'].includes(d.data().status)).forEach((d) => batch.update(d.ref, { status: 'cancelled', cancelled_at_ms: ctx.now }));
    if (member.card_code) batch.delete(ctx.db.collection(C.cardIndex).doc(member.card_code));
    await batch.commit();
    await auditoria(ctx, actor, 'federation_membership_cancel', { federation_id: fed.id, user_id: uid });
    return { ok: true };
  }

  if (acao === 'suspend' || acao === 'reinstate') {
    const de = acao === 'suspend' ? ['active', 'expired'] : ['suspended'];
    if (!de.includes(member.status)) falha('failed-precondition', 'A filiação não está no estado certo para isso.');
    if (acao === 'suspend' && reason.length < 3) falha('invalid-argument', 'Diga o motivo da suspensão.');
    await ctx.db.runTransaction(async (tr) => {
      const code = novoCodigo();
      if (member.card_code) tr.delete(ctx.db.collection(C.cardIndex).doc(member.card_code));
      tr.set(ctx.db.collection(C.cardIndex).doc(code), { member_id: memberRef.id, federation_id: fed.id, created_at_ms: ctx.now });
      const patch = { card_code: code, updated_at: ctx.Timestamp.fromMillis(ctx.now) };
      if (acao === 'suspend') Object.assign(patch, { status: 'suspended', suspended_reason: reason, suspended_by: actor.uid, suspended_at_ms: ctx.now, status_before_suspension: member.status });
      else Object.assign(patch, { status: member.status_before_suspension || 'active', suspended_reason: null, reinstated_at_ms: ctx.now });
      tr.update(memberRef, patch);
    });
    const batch = ctx.db.batch();
    aviso(ctx, batch, uid, acao === 'suspend'
      ? { title: tx('Sua filiação na {sigla} foi suspensa', { sigla: fed.acronym }), message: tx('Motivo: {motivo}. Enquanto suspensa, a carteirinha mostra "Suspensa".', { motivo: reason }), link }
      : { title: tx('Sua filiação na {sigla} voltou a valer', { sigla: fed.acronym }), message: tx('A suspensão foi encerrada e a carteirinha voltou a valer.'), link });
    await batch.commit();
    await auditoria(ctx, actor, `federation_membership_${acao}`, { federation_id: fed.id, user_id: uid, reason });
    return { ok: true };
  }

  return falha('invalid-argument', 'Ação desconhecida.');
}

function idadeDe(birth, hoje) {
  const b = String(birth || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b)) return null;
  let idade = Number(hoje.slice(0, 4)) - Number(b.slice(0, 4));
  if (hoje.slice(5) < b.slice(5)) idade -= 1;
  return idade;
}

/* ------------------------------------------------------------- charge -- */

async function chargeConfirm(ctx, actor, data) {
  if (!(await flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const snap = await ctx.db.collection(C.charges).doc(texto(data.chargeId, 80)).get();
  if (!snap.exists) falha('not-found', 'Cobrança não encontrada.');
  const charge = { id: snap.id, ...snap.data() };
  const fed = await federacao(ctx, charge.federation_id);
  await exigePerm(ctx, fed.id, actor, 'finance');
  if (!['open', 'declared'].includes(charge.status)) falha('failed-precondition', 'Esta cobrança já foi fechada.');
  const hoje = m.isoDateBR(ctx.now);
  const note = texto(data.note, 300);
  const memberRef = ctx.db.collection(C.members).doc(charge.member_id);

  if (data.action === 'cancel') {
    const batch = ctx.db.batch();
    batch.update(snap.ref, { status: 'cancelled', cancelled_at_ms: ctx.now, cancelled_by: actor.uid, cancel_note: note });
    const ms = await memberRef.get();
    // A filiação que esperava este pagamento volta a "aguardando aprovação" (a secretaria decide de novo) — nunca fica presa.
    if (ms.exists && ms.data().status === 'awaiting_payment' && charge.origin === 'membership') batch.update(memberRef, { status: 'pending', updated_at: ctx.Timestamp.fromMillis(ctx.now) });
    aviso(ctx, batch, charge.payer_uid, { title: tx('Cobrança da {sigla} cancelada', { sigla: fed.acronym }), message: note ? tx('Motivo: {motivo}.', { motivo: note }) : tx('A federação cancelou a cobrança.'), link: '/perfil?secao=federacoes' });
    await batch.commit();
    await auditoria(ctx, actor, 'federation_charge_cancel', { federation_id: fed.id, charge_id: charge.id, user_id: charge.payer_uid, note });
    return { ok: true };
  }
  if (data.action !== 'confirm') falha('invalid-argument', 'Ação desconhecida.');

  const p = await plano(ctx, fed.id, charge.plan_id);
  await ctx.db.runTransaction(async (tr) => {
    const ms = await tr.get(memberRef);
    if (!ms.exists) falha('not-found', 'A filiação desta cobrança não existe mais.');
    const member = { id: ms.id, ...ms.data() };
    if (!['awaiting_payment', 'active', 'expired'].includes(member.status)) falha('failed-precondition', 'A filiação não está num estado que aceite pagamento.');
    await ativar(ctx, tr, { fed, memberRef, member, plan: p, hoje });
    tr.update(snap.ref, { status: 'paid', paid_at: hoje, paid_at_ms: ctx.now, confirmed_by: actor.uid, confirmed_by_name: actor.name || '', confirm_note: note });
  });
  const batch = ctx.db.batch();
  aviso(ctx, batch, charge.payer_uid, {
    title: tx('Pagamento confirmado — {sigla}', { sigla: fed.acronym }),
    message: charge.origin === 'renewal' ? tx('Sua filiação foi renovada. A carteirinha já mostra a nova validade.') : tx('Sua filiação está ativa. A carteirinha digital está na sua Minha área.'),
    link: '/perfil?secao=federacoes',
  });
  await batch.commit();
  await auditoria(ctx, actor, 'federation_charge_confirm', { federation_id: fed.id, charge_id: charge.id, user_id: charge.payer_uid, amount_cents: charge.amount_cents });
  return { ok: true };
}

/* -------------------------------------------------------------- sweep -- */

/**
 * Varredura diária: vence quem venceu, avisa quem vai vencer (uma vez por
 * marco), recontam-se os filiados ativos de cada federação.
 */
async function sweep(ctx) {
  if (!(await flagLigada(ctx))) return { skipped: 'flag' };
  const hoje = m.isoDateBR(ctx.now);
  const ativos = await ctx.db.collection(C.members).where('status', '==', 'active').get();
  let vencidas = 0;
  let avisos = 0;
  const porFed = {};
  const fedCache = {};
  const sigla = async (fedId) => {
    if (!fedCache[fedId]) {
      const s = await ctx.db.collection(C.federations).doc(fedId).get();
      fedCache[fedId] = s.exists ? (s.data().acronym || s.data().name) : fedId;
    }
    return fedCache[fedId];
  };
  let batch = ctx.db.batch();
  let n = 0;
  const flush = async () => { if (n) { await batch.commit(); batch = ctx.db.batch(); n = 0; } };
  for (const d of ativos.docs) {
    const mem = d.data();
    const st = m.membershipState(mem, hoje);
    const link = '/perfil?secao=federacoes';
    if (st.status === 'expired') {
      batch.update(d.ref, { status: 'expired', expired_at_ms: ctx.now });
      // eslint-disable-next-line no-await-in-loop
      aviso(ctx, batch, mem.user_id, { title: tx('Sua filiação na {sigla} venceu', { sigla: await sigla(mem.federation_id) }), message: tx('Renove para continuar em dia e pontuando. A carteirinha mostra "Vencida" até lá.'), link });
      vencidas += 1; n += 2;
    } else {
      porFed[mem.federation_id] = (porFed[mem.federation_id] || 0) + 1;
      const marcos = m.EXPIRY_NOTICE_DAYS.filter((dias) => st.daysLeft != null && st.daysLeft <= dias && !(mem.expiry_notified || {})[String(dias)]);
      if (marcos.length) {
        const dias = Math.min(...marcos);
        // eslint-disable-next-line no-await-in-loop
        aviso(ctx, batch, mem.user_id, { title: tx('Sua filiação na {sigla} vence em {dias} dias', { sigla: await sigla(mem.federation_id), dias: Math.max(0, st.daysLeft) }), message: tx('Renove pela Minha área → Federações para não ficar fora do ranking e dos torneios chancelados.'), link });
        const notified = { ...(mem.expiry_notified || {}) };
        marcos.forEach((x) => { notified[String(x)] = true; });
        batch.update(d.ref, { expiry_notified: notified });
        avisos += 1; n += 2;
      }
    }
    // eslint-disable-next-line no-await-in-loop
    if (n >= 400) await flush();
  }
  await flush();
  const feds = await ctx.db.collection(C.federations).where('status', '==', 'approved').get();
  const contagem = ctx.db.batch();
  feds.docs.forEach((f) => contagem.update(f.ref, { member_count: porFed[f.id] || 0 }));
  if (feds.size) await contagem.commit();
  if (ctx.logger) ctx.logger.info('Federações: varredura diária.', { vencidas, avisos, federacoes: feds.size });
  return { vencidas, avisos };
}

/* ------------------------------------------------------------- verify -- */

/** Verificação pública pelo código: devolve só o mínimo (D11, LGPD). */
async function verify(ctx, data) {
  const code = m.normalizeCardCode(data && data.code);
  if (!code) return { found: false };
  const idx = await ctx.db.collection(C.cardIndex).doc(code).get();
  if (!idx.exists) return { found: false };
  const [ms, fs] = await Promise.all([
    ctx.db.collection(C.members).doc(idx.data().member_id).get(),
    ctx.db.collection(C.federations).doc(idx.data().federation_id).get(),
  ]);
  if (!ms.exists || !fs.exists || fs.data().status !== 'approved') return { found: false };
  return m.publicVerification(ms.data(), fs.data(), m.isoDateBR(ctx.now));
}

module.exports = { FederationError, PERMS, REVIEW, LIVE, review, membership, chargeConfirm, sweep, verify, idadeDe };
