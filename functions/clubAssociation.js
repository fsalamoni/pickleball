/**
 * ASSOCIAÇÃO DO CLUBE — o que só o SERVIDOR faz (flag `club_association`).
 *
 * O clube vira uma associação quando a administração liga `clubs.association`
 * (`enabled`) e a abre ao público (`published`). Os dados moram em
 * `club_x/{clube}/{espécie}/{id}` (uma regra só, `firestore.rules`); o
 * navegador NÃO cria filiação, não muda o estado dela, não cria cobrança nem
 * confirma pagamento — tudo passa por aqui:
 *
 *  - FILIAÇÃO (`association`): o pedido da própria pessoa (confere plano e
 *    idade), a decisão da secretaria (aprovar gera o número numa transação
 *    sobre `club_x/{clube}/srv/counter`; plano pago gera a cobrança), a
 *    filiação direta pela secretaria (`grant`), a adoção em lote dos membros
 *    que já existem (`adopt`, só plano gratuito), renovação, cancelamento,
 *    saída do clube, suspensão e reintegração — o código da carteirinha GIRA
 *    ao ativar e ao suspender;
 *  - COBRANÇA: o pagador DECLARA ("Já paguei"); o financeiro confirma ou
 *    cancela, e confirmar ativa ou renova a filiação. O dinheiro vai direto
 *    para o Pix do clube (`club_x/{clube}/cfg/pix`): a plataforma não recebe;
 *  - VARREDURA diária (`sweep`): vence quem venceu, avisa 30/7/1 dias antes,
 *    gera a cobrança da próxima mensalidade e lembra a cobrança em aberto;
 *  - VERIFICAÇÃO (`verify`, pública): o mínimo da carteirinha pelo código.
 *
 * A ponte com o acesso: ativar a filiação cria `club_members` (papel
 * `member`) se a pessoa ainda não é membro. Perder o vínculo (vencida,
 * suspensa) NÃO expulsa — só tira vantagens, cupom e voto (decisão D3).
 *
 * A conta da validade, do preço e do código é a da federação
 * (`federationMembership.js`, com paridade no cliente).
 */
const crypto = require('node:crypto');
const m = require('./federationMembership.js');
const { tx, textoDoAviso, i18nDoAviso } = require('./avisoI18n.js');
const { FederationError } = require('./federations.js');
const S = require('./clubStaffPolicy.js');

const X = 'club_x';
const INDEX = 'club_card_index';
const PERMS = S.ALL;
const LIVE = Object.freeze(['pending', 'awaiting_payment', 'active', 'expired', 'suspended']);
const ADOPT_MAX = 200;
const IMPORT_MAX = 100;
const NEXT_CHARGE_DAYS = 7;

const falha = (code, msg) => { throw new FederationError(code, msg); };
const texto = (v, max = 300) => String(v == null ? '' : v).trim().slice(0, max);
const col = (ctx, clubId, kind) => ctx.db.collection(X).doc(clubId).collection(kind);

/* --------------------------------------------------------------- avisos -- */

function aviso(ctx, batch, userId, { title, message, link }) {
  if (!userId) return;
  const i18n = i18nDoAviso({ title, message });
  batch.set(ctx.db.collection('notifications').doc(), {
    user_id: userId, title: textoDoAviso(title), message: textoDoAviso(message), ...(i18n ? { i18n } : {}),
    type: 'club_association', link, read: false, archived: false, origin: 'server', essential: true,
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

/* ------------------------------------------------------------------ quem -- */

async function flagLigada(ctx) {
  const snap = await ctx.db.collection('platform_settings').doc('global').get();
  return Boolean(snap.exists && snap.data().feature_flags && snap.data().feature_flags.club_association === true);
}

async function exigeFlag(ctx) {
  if (!(await flagLigada(ctx))) falha('failed-precondition', 'A associação de clubes não está ligada nesta plataforma.');
}

/**
 * As permissões de quem age NESTE clube: administrador do clube tem todas;
 * os demais vêm do cargo (`staff/{uid}.perms`) com o mandato valendo
 * (`term_end_ms` 0 = sem prazo). Mesma conta de `cxPerms` na regra.
 */
async function permsDe(ctx, clubId, uid) {
  const mem = await ctx.db.collection('club_members').doc(`${clubId}_${uid}`).get();
  if (!mem.exists) return []; // cargo só vale para quem ainda é membro do clube
  if (mem.data().role === 'admin') return [...PERMS];
  const st = await col(ctx, clubId, 'staff').doc(uid).get();
  return st.exists ? S.permsOf(st.data(), ctx.now) : [];
}

async function exigePerm(ctx, clubId, actor, ...algumas) {
  const perms = await permsDe(ctx, clubId, actor.uid);
  if (!perms.includes('admin') && !algumas.some((p) => perms.includes(p))) falha('permission-denied', 'Você não tem permissão para isso neste clube.');
}

/** Os uids que têm uma das permissões (para avisar a secretaria e o financeiro). */
async function quemTem(ctx, clubId, perm) {
  const [admins, staff] = await Promise.all([
    ctx.db.collection('club_members').where('club_id', '==', clubId).where('role', '==', 'admin').get(),
    col(ctx, clubId, 'staff').get(),
  ]);
  const ids = new Set(admins.docs.map((d) => d.data().user_id).filter(Boolean));
  staff.docs.forEach((d) => {
    const perms = S.permsOf(d.data(), ctx.now);
    if (perms.includes(perm) || perms.includes('admin')) ids.add(d.id);
  });
  return [...ids];
}

async function clube(ctx, clubId) {
  const id = texto(clubId, 80);
  if (!id) falha('invalid-argument', 'Clube não informado.');
  const snap = await ctx.db.collection('clubs').doc(id).get();
  if (!snap.exists) falha('not-found', 'Clube não encontrado.');
  return { id: snap.id, ...snap.data() };
}

/** Aberta ao público: a administração ligou a associação E publicou (`published`, ausente = oculta). */
const aberta = (club) => Boolean(club) && club.association?.enabled === true && club.association?.published === true;

async function plano(ctx, clubId, planId) {
  const snap = await col(ctx, clubId, 'plans').doc(texto(planId, 80)).get();
  if (!snap.exists || (snap.data().club_id && snap.data().club_id !== clubId)) falha('not-found', 'Plano não encontrado neste clube.');
  return { id: snap.id, ...snap.data() };
}

const preco = (p) => Math.max(0, Math.trunc(Number(p.price_cents) || 0));

/** Até quando vale: plano gratuito não vence; o pago segue a conta da federação (mensal +1 mês, anual +12). */
function validade(p, inicio) {
  return preco(p) > 0 ? m.computeValidUntil({ billing: p.billing === 'monthly' ? 'monthly' : 'annual', validity: 'rolling' }, inicio) : '';
}

const idadeDe = (nasc, hoje) => {
  const a = String(nasc || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const h = String(hoje || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!a || !h) return null;
  let idade = Number(h[1]) - Number(a[1]);
  if (Number(h[2]) < Number(a[2]) || (Number(h[2]) === Number(a[2]) && Number(h[3]) < Number(a[3]))) idade -= 1;
  return idade;
};

/** Sigla do clube para o número: iniciais das palavras que dizem algo (CLB se nada sobra). */
function sigla(club) {
  const ignora = new Set(['clube', 'club', 'de', 'do', 'da', 'dos', 'das', 'e', 'associacao', 'associação', 'pickleball', 'pickle']);
  const palavras = String(club.name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/)
    .filter((w) => w && !ignora.has(w.toLowerCase()));
  const iniciais = palavras.map((w) => w[0]).join('').toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Uma palavra só dá uma letra: nesse caso valem as três primeiras dela.
  const base = iniciais.length >= 2 ? iniciais : (palavras[0] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return base.slice(0, 5) || 'CLB';
}

const novoCodigo = () => m.cardCodeFromBytes(crypto.randomBytes(m.CARD_CODE_LENGTH));

/** O perfil público mínimo de quem pede (nome e foto): nada de contato. */
async function perfil(ctx, uid) {
  const snap = await ctx.db.collection('users').doc(uid).get();
  const u = snap.exists ? snap.data() : {};
  return { nome: texto(u.platform_name || u.full_name || u.display_name || 'Atleta', 120), foto: texto(u.photo_url || u.avatar_url, 500), nascimento: u.birth_date || null };
}

/* --------------------------------------------------------------- cobrança -- */

/** O Pix do clube, copiado para a cobrança (quem paga lê a cobrança, não a configuração). */
async function pixDoClube(ctx, clubId, club) {
  const snap = await col(ctx, clubId, 'cfg').doc('pix').get();
  const p = snap.exists ? snap.data() : {};
  return {
    pix_key: texto(p.pix_key, 140), key_type: texto(p.key_type, 20), receiver_name: texto(p.receiver_name || club.name, 60),
    city: texto(club.city || club.state || '', 40), instructions: texto(p.instructions, 500),
  };
}

async function novaCobranca(ctx, batchOrTr, { club, aff, plan, origin, hoje, amount }) {
  const ref = col(ctx, club.id, 'charges').doc();
  const data = {
    club_id: club.id, club_name: club.name || '', user_id: aff.user_id, member_id: aff.user_id, payer_name: aff.user_name || '', member_name: aff.user_name || '',
    origin, plan_id: plan.id, plan_name: plan.name, amount_cents: Math.max(0, Math.trunc(Number(amount) || 0)), status: 'open',
    due_date: m.chargeDueDate(hoje), payment: await pixDoClube(ctx, club.id, club),
    created_at: ctx.Timestamp.fromMillis(ctx.now), created_at_ms: ctx.now,
  };
  batchOrTr.set(ref, data);
  return { id: ref.id, ...data };
}

/** O valor da filiação para esta pessoa: o preço do plano com o desconto de idade que ele tiver. */
function valorDoPlano(plan, idade) {
  return preco(plan) > 0 ? m.planPrice(plan, { age: idade, familyIndex: 1 }).total : 0;
}

/* ------------------------------------------------------------------ ativar -- */

/**
 * Ativa (ou renova) a filiação numa transação: número (só na primeira vez),
 * validade, código novo e — se a pessoa ainda não é membro — o `club_members`.
 * `aff` é o documento atual (ou o novo, com `novo: true`).
 */
async function ativar(ctx, tr, { club, ref, aff, plan, hoje, novo = false }) {
  const contador = col(ctx, club.id, 'srv').doc('counter');
  const [cSnap, mSnap] = await Promise.all([tr.get(contador), tr.get(ctx.db.collection('club_members').doc(`${club.id}_${aff.user_id}`))]);
  const patch = { status: 'active', updated_at: ctx.Timestamp.fromMillis(ctx.now) };
  if (!aff.member_number) {
    const seq = (cSnap.exists ? Number(cSnap.data().member) || 0 : 0) + 1;
    patch.member_number = m.formatMemberNumber(sigla(club), Number(hoje.slice(0, 4)), seq);
    tr.set(contador, { member: seq, updated_at_ms: ctx.now }, { merge: true });
  }
  const inicio = m.renewalStart(aff, hoje);
  patch.valid_from = aff.valid_from || hoje;
  patch.valid_until = validade(plan, inicio);
  patch.activated_at_ms = ctx.now;
  patch.expiry_notified = {};
  patch.votes = plan.votes === true;
  const code = novoCodigo();
  if (aff.card_code) tr.delete(ctx.db.collection(INDEX).doc(aff.card_code));
  tr.set(ctx.db.collection(INDEX).doc(code), { club_id: club.id, user_id: aff.user_id, created_at_ms: ctx.now });
  patch.card_code = code;
  if (novo) tr.set(ref, { ...aff, ...patch }); else tr.update(ref, patch);
  if (!mSnap.exists) {
    tr.set(ctx.db.collection('club_members').doc(`${club.id}_${aff.user_id}`), {
      club_id: club.id, user_id: aff.user_id, user_name: aff.user_name || 'Atleta', photo_url: aff.photo_url || '', role: 'member',
      joined_at: ctx.Timestamp.fromMillis(ctx.now), via: 'association',
    });
    tr.update(ctx.db.collection('clubs').doc(club.id), { member_count: ctx.FieldValue.increment(1) });
  }
  return { ...aff, ...patch };
}

function encerrar(ctx, batch, ref, aff, patch) {
  batch.update(ref, { ...patch, card_code: null, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  if (aff.card_code) batch.delete(ctx.db.collection(INDEX).doc(aff.card_code));
}

/* --------------------------------------------------------------- o pedido -- */

async function pedir(ctx, actor, data, { club, hoje }) {
  if (!aberta(club)) falha('failed-precondition', 'Este clube não está recebendo filiações.');
  const uid = actor.uid;
  const p = await plano(ctx, club.id, data.planId);
  if (p.active === false) falha('failed-precondition', 'Este plano não está mais disponível.');
  const ref = col(ctx, club.id, 'aff').doc(uid);
  const atual = await ref.get();
  if (atual.exists && LIVE.includes(atual.data().status)) falha('already-exists', 'Você já tem uma filiação neste clube.');
  const pf = await perfil(ctx, uid);
  const idade = idadeDe(pf.nascimento, hoje);
  if ((p.age_min != null || p.age_max != null) && idade == null) falha('failed-precondition', 'Este plano é por faixa de idade: informe a data de nascimento no seu perfil.');
  if (p.age_min != null && idade < p.age_min) falha('failed-precondition', 'Este plano exige idade mínima maior.');
  if (p.age_max != null && idade > p.age_max) falha('failed-precondition', 'Este plano tem idade máxima menor.');
  const anterior = atual.exists ? atual.data() : {};
  const doc = {
    club_id: club.id, user_id: uid, user_name: pf.nome, photo_url: pf.foto, plan_id: p.id, plan_name: p.name, category: p.category || '', billing: p.billing || 'annual',
    free: preco(p) === 0, status: 'pending', public_badge: data.publicBadge !== false, note: texto(data.note, 300),
    requested_at_ms: ctx.now, updated_at: ctx.Timestamp.fromMillis(ctx.now),
    member_number: anterior.member_number || null, card_code: null, valid_from: null, valid_until: null, expiry_notified: {},
  };
  const valor = valorDoPlano(p, idade);
  let charge = null;
  if (p.auto_approve) {
    if (!(valor > 0)) {
      await ctx.db.runTransaction(async (tr) => { await ativar(ctx, tr, { club, ref, aff: doc, plan: p, hoje, novo: true }); });
    } else {
      const batch = ctx.db.batch();
      batch.set(ref, { ...doc, status: 'awaiting_payment' });
      charge = await novaCobranca(ctx, batch, { club, aff: doc, plan: p, origin: 'membership', hoje, amount: valor });
      await batch.commit();
    }
  } else {
    const batch = ctx.db.batch();
    batch.set(ref, doc);
    (await quemTem(ctx, club.id, 'members')).forEach((sid) => aviso(ctx, batch, sid, {
      title: tx('Novo pedido de associação no {clube}', { clube: club.name }),
      message: tx('{nome} pediu associação no plano {plano}. Analise na gestão do clube.', { nome: doc.user_name, plano: p.name }),
      link: `/clubes/${club.id}/gerir?aba=associados`,
    }));
    await batch.commit();
  }
  await auditoria(ctx, actor, 'club_membership_request', { club_id: club.id, user_id: uid, plan_id: p.id });
  return { ok: true, memberId: uid, chargeId: charge ? charge.id : null };
}

/* ------------------------------------------------------------- a ação geral -- */

async function association(ctx, actor, data) {
  await exigeFlag(ctx);
  const club = await clube(ctx, data.clubId);
  const hoje = m.isoDateBR(ctx.now);
  const acao = texto(data.action, 30);
  const propria = ['request', 'renew', 'cancel', 'leave', 'declare'].includes(acao);
  if (!propria) {
    if (acao === 'charge_confirm') await exigePerm(ctx, club.id, actor, 'finance');
    else await exigePerm(ctx, club.id, actor, 'members');
  }
  const reason = texto(data.reason, 500);
  const linkMinha = `/clubes/${club.id}?tab=associacao`;

  if (acao === 'request') return pedir(ctx, actor, data, { club, hoje });
  if (acao === 'declare') return declarar(ctx, actor, data, { club });
  if (acao === 'charge_confirm') return confirmarCobranca(ctx, actor, data, { club, hoje });
  if (acao === 'grant') return conceder(ctx, actor, data, { club, hoje });
  if (acao === 'adopt') return adotar(ctx, actor, data, { club, hoje });
  if (acao === 'import') return importar(ctx, actor, data, { club, hoje });

  const uid = propria ? actor.uid : texto(data.userId, 128);
  const ref = col(ctx, club.id, 'aff').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) falha('not-found', 'Filiação não encontrada.');
  const aff = { id: snap.id, ...snap.data() };
  const p = aff.plan_id ? await plano(ctx, club.id, aff.plan_id).catch(() => null) : null;

  if (acao === 'approve') {
    if (aff.status !== 'pending') falha('failed-precondition', 'Este pedido já foi decidido.');
    if (!p) falha('failed-precondition', 'O plano deste pedido não existe mais.');
    const pf = await perfil(ctx, uid);
    const valor = valorDoPlano(p, idadeDe(pf.nascimento, hoje));
    let charge = null;
    if (!(valor > 0)) {
      await ctx.db.runTransaction(async (tr) => {
        await ativar(ctx, tr, { club, ref, aff, plan: p, hoje });
        tr.update(ref, { decided_by: actor.uid, decided_at_ms: ctx.now });
      });
    } else {
      const batch = ctx.db.batch();
      batch.update(ref, { status: 'awaiting_payment', decided_by: actor.uid, decided_at_ms: ctx.now, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
      charge = await novaCobranca(ctx, batch, { club, aff, plan: p, origin: 'membership', hoje, amount: valor });
      await batch.commit();
    }
    const batch = ctx.db.batch();
    aviso(ctx, batch, uid, !(valor > 0)
      ? { title: tx('Sua associação no {clube} foi aprovada', { clube: club.name }), message: tx('A carteirinha digital já está disponível na página do clube.'), link: linkMinha }
      : { title: tx('Sua associação no {clube} foi aprovada', { clube: club.name }), message: tx('Falta o pagamento: pague pelo Pix e toque em "Já paguei". A carteirinha sai quando o financeiro confirmar.'), link: linkMinha });
    await batch.commit();
    await auditoria(ctx, actor, 'club_membership_approve', { club_id: club.id, user_id: uid });
    return { ok: true, chargeId: charge ? charge.id : null };
  }

  if (acao === 'reject') {
    if (aff.status !== 'pending') falha('failed-precondition', 'Este pedido já foi decidido.');
    if (reason.length < 3) falha('invalid-argument', 'Diga o motivo da recusa.');
    const batch = ctx.db.batch();
    batch.update(ref, { status: 'rejected', reject_reason: reason, decided_by: actor.uid, decided_at_ms: ctx.now, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
    aviso(ctx, batch, uid, { title: tx('Sua associação no {clube} foi recusada', { clube: club.name }), message: tx('Motivo: {motivo}. Você pode corrigir e pedir de novo.', { motivo: reason }), link: linkMinha });
    await batch.commit();
    await auditoria(ctx, actor, 'club_membership_reject', { club_id: club.id, user_id: uid, reason });
    return { ok: true };
  }

  if (acao === 'renew') {
    const st = m.membershipState(aff, hoje, ctx.now);
    if (!st.canRenew) falha('failed-precondition', 'A renovação abre 30 dias antes do vencimento.');
    if (!p || p.active === false) falha('failed-precondition', 'O plano desta filiação não está mais disponível. Fale com o clube.');
    const abertas = await col(ctx, club.id, 'charges').where('user_id', '==', uid).get();
    if (abertas.docs.some((d) => ['open', 'declared'].includes(d.data().status) && d.data().origin === 'renewal')) falha('already-exists', 'Já existe uma cobrança de renovação em aberto.');
    const pf = await perfil(ctx, uid);
    const valor = valorDoPlano(p, idadeDe(pf.nascimento, hoje));
    if (!(valor > 0)) {
      await ctx.db.runTransaction(async (tr) => { await ativar(ctx, tr, { club, ref, aff, plan: p, hoje }); });
      return { ok: true, chargeId: null };
    }
    const batch = ctx.db.batch();
    const charge = await novaCobranca(ctx, batch, { club, aff, plan: p, origin: 'renewal', hoje, amount: valor });
    await batch.commit();
    return { ok: true, chargeId: charge.id };
  }

  if (acao === 'cancel' || acao === 'leave') {
    if (!LIVE.includes(aff.status)) falha('failed-precondition', 'Esta filiação já está encerrada.');
    const batch = ctx.db.batch();
    encerrar(ctx, batch, ref, aff, { status: 'cancelled', cancelled_at_ms: ctx.now, cancelled_by: actor.uid });
    const abertas = await col(ctx, club.id, 'charges').where('user_id', '==', uid).get();
    abertas.docs.filter((d) => ['open', 'declared'].includes(d.data().status)).forEach((d) => batch.update(d.ref, { status: 'cancelled', cancelled_at_ms: ctx.now }));
    if (acao === 'leave') await sairDoClube(ctx, batch, club, uid);
    await batch.commit();
    await auditoria(ctx, actor, `club_membership_${acao}`, { club_id: club.id, user_id: uid });
    return { ok: true };
  }

  if (acao === 'suspend' || acao === 'reinstate') {
    const de = acao === 'suspend' ? ['active', 'expired'] : ['suspended'];
    if (!de.includes(aff.status)) falha('failed-precondition', 'A filiação não está no estado certo para isso.');
    if (acao === 'suspend' && reason.length < 3) falha('invalid-argument', 'Diga o motivo da suspensão.');
    await ctx.db.runTransaction(async (tr) => {
      const code = novoCodigo();
      if (aff.card_code) tr.delete(ctx.db.collection(INDEX).doc(aff.card_code));
      tr.set(ctx.db.collection(INDEX).doc(code), { club_id: club.id, user_id: uid, created_at_ms: ctx.now });
      const patch = { card_code: code, updated_at: ctx.Timestamp.fromMillis(ctx.now) };
      if (acao === 'suspend') Object.assign(patch, { status: 'suspended', suspended_reason: reason, suspended_by: actor.uid, suspended_at_ms: ctx.now, status_before_suspension: aff.status });
      else Object.assign(patch, { status: aff.status_before_suspension || 'active', suspended_reason: null, reinstated_at_ms: ctx.now });
      tr.update(ref, patch);
    });
    const batch = ctx.db.batch();
    aviso(ctx, batch, uid, acao === 'suspend'
      ? { title: tx('Sua associação no {clube} foi suspensa', { clube: club.name }), message: tx('Motivo: {motivo}. Enquanto suspensa, a carteirinha mostra "Suspensa".', { motivo: reason }), link: linkMinha }
      : { title: tx('Sua associação no {clube} voltou a valer', { clube: club.name }), message: tx('A suspensão foi encerrada e a carteirinha voltou a valer.'), link: linkMinha });
    await batch.commit();
    await auditoria(ctx, actor, `club_membership_${acao}`, { club_id: club.id, user_id: uid, reason });
    return { ok: true };
  }

  return falha('invalid-argument', 'Ação desconhecida.');
}

/** Sair do clube: tira o `club_members` (nunca o último administrador) e desconta o contador. */
async function sairDoClube(ctx, batch, club, uid) {
  const mref = ctx.db.collection('club_members').doc(`${club.id}_${uid}`);
  const snap = await mref.get();
  if (!snap.exists) return;
  if (snap.data().role === 'admin') {
    const admins = await ctx.db.collection('club_members').where('club_id', '==', club.id).where('role', '==', 'admin').get();
    if (admins.size <= 1) falha('failed-precondition', 'Você é o único administrador. Promova outra pessoa antes de sair.');
  }
  batch.delete(mref);
  batch.delete(col(ctx, club.id, 'staff').doc(uid)); // sair do clube também encerra o cargo
  batch.update(ctx.db.collection('clubs').doc(club.id), { member_count: ctx.FieldValue.increment(-1) });
}

/* ------------------------------------------------------- filiação direta -- */

/**
 * A secretaria filia uma pessoa que já está na plataforma (balcão, quem já
 * pagou fora): `paid: true` ativa na hora e registra a cobrança como PAGA (o
 * financeiro enxerga a entrada); sem ele, plano pago gera a cobrança.
 */
async function conceder(ctx, actor, data, { club, hoje }) {
  const uid = texto(data.userId, 128);
  if (!uid) falha('invalid-argument', 'Escolha a pessoa.');
  const p = await plano(ctx, club.id, data.planId);
  const ref = col(ctx, club.id, 'aff').doc(uid);
  const atual = await ref.get();
  if (atual.exists && LIVE.includes(atual.data().status)) falha('already-exists', 'Esta pessoa já tem filiação neste clube.');
  const u = await ctx.db.collection('users').doc(uid).get();
  if (!u.exists) falha('not-found', 'Pessoa não encontrada.');
  const pf = await perfil(ctx, uid);
  const anterior = atual.exists ? atual.data() : {};
  const doc = {
    club_id: club.id, user_id: uid, user_name: pf.nome, photo_url: pf.foto, plan_id: p.id, plan_name: p.name, category: p.category || '', billing: p.billing || 'annual',
    free: preco(p) === 0, status: 'pending', public_badge: true, note: texto(data.note, 300), granted_by: actor.uid,
    requested_at_ms: ctx.now, updated_at: ctx.Timestamp.fromMillis(ctx.now), member_number: anterior.member_number || null,
    card_code: null, valid_from: null, valid_until: null, expiry_notified: {},
  };
  const valor = valorDoPlano(p, idadeDe(pf.nascimento, hoje));
  let charge = null;
  if (!(valor > 0) || data.paid === true) {
    await ctx.db.runTransaction(async (tr) => {
      const ativo = await ativar(ctx, tr, { club, ref, aff: doc, plan: p, hoje, novo: true });
      if (valor > 0) {
        const cref = col(ctx, club.id, 'charges').doc();
        charge = { id: cref.id };
        tr.set(cref, {
          club_id: club.id, club_name: club.name || '', user_id: uid, member_id: uid, payer_name: ativo.user_name, member_name: ativo.user_name,
          origin: 'membership', plan_id: p.id, plan_name: p.name, amount_cents: valor, status: 'paid', due_date: hoje, paid_at: hoje, paid_at_ms: ctx.now,
          confirmed_by: actor.uid, confirmed_by_name: actor.name || '', confirm_note: texto(data.note, 300) || 'Pago fora da plataforma',
          created_at: ctx.Timestamp.fromMillis(ctx.now), created_at_ms: ctx.now,
        });
      }
    });
  } else {
    const batch = ctx.db.batch();
    batch.set(ref, { ...doc, status: 'awaiting_payment' });
    charge = await novaCobranca(ctx, batch, { club, aff: doc, plan: p, origin: 'membership', hoje, amount: valor });
    await batch.commit();
  }
  const batch = ctx.db.batch();
  aviso(ctx, batch, uid, { title: tx('Você foi associado ao {clube}', { clube: club.name }), message: tx('Veja a sua associação na página do clube.'), link: `/clubes/${club.id}?tab=associacao` });
  await batch.commit();
  await auditoria(ctx, actor, 'club_membership_grant', { club_id: club.id, user_id: uid, plan_id: p.id, paid: data.paid === true });
  return { ok: true, chargeId: charge ? charge.id : null };
}

/**
 * Adota os membros que o clube JÁ tem num plano GRATUITO (os que não têm
 * filiação), em lotes de até 200. Decisão da administração, nunca
 * automática: sem isto, quem entrou antes da associação segue como "membro
 * sem plano". Devolve quantos faltam para chamar de novo.
 */
async function adotar(ctx, actor, data, { club, hoje }) {
  const p = await plano(ctx, club.id, data.planId);
  if (preco(p) > 0) falha('failed-precondition', 'Só um plano gratuito pode ser aplicado a todos os membros de uma vez.');
  const [membros, afiliados] = await Promise.all([
    ctx.db.collection('club_members').where('club_id', '==', club.id).get(),
    col(ctx, club.id, 'aff').get(),
  ]);
  const jaTem = new Set(afiliados.docs.filter((d) => LIVE.includes(d.data().status)).map((d) => d.id));
  const faltam = membros.docs.map((d) => d.data()).filter((x) => x.user_id && !jaTem.has(x.user_id));
  const lote = faltam.slice(0, ADOPT_MAX);
  if (!lote.length) return { ok: true, adopted: 0, remaining: 0 };
  const contador = col(ctx, club.id, 'srv').doc('counter');
  const cSnap = await contador.get();
  let seq = cSnap.exists ? Number(cSnap.data().member) || 0 : 0;
  const batch = ctx.db.batch();
  const ano = Number(hoje.slice(0, 4));
  const antigos = Object.fromEntries(afiliados.docs.map((d) => [d.id, d.data()]));
  lote.forEach((mem) => {
    const ant = antigos[mem.user_id] || {};
    const code = novoCodigo();
    const numero = ant.member_number || m.formatMemberNumber(sigla(club), ano, (seq += 1));
    batch.set(col(ctx, club.id, 'aff').doc(mem.user_id), {
      club_id: club.id, user_id: mem.user_id, user_name: mem.user_name || 'Atleta', photo_url: mem.photo_url || '', plan_id: p.id, plan_name: p.name,
      category: p.category || '', billing: p.billing || 'annual', free: true, status: 'active', public_badge: true, adopted: true, votes: p.votes === true,
      requested_at_ms: ctx.now, activated_at_ms: ctx.now, updated_at: ctx.Timestamp.fromMillis(ctx.now), member_number: numero, card_code: code,
      valid_from: hoje, valid_until: '', expiry_notified: {},
    });
    batch.set(ctx.db.collection(INDEX).doc(code), { club_id: club.id, user_id: mem.user_id, created_at_ms: ctx.now });
  });
  batch.set(contador, { member: seq, updated_at_ms: ctx.now }, { merge: true });
  await batch.commit();
  await auditoria(ctx, actor, 'club_membership_adopt', { club_id: club.id, plan_id: p.id, adopted: lote.length });
  return { ok: true, adopted: lote.length, remaining: faltam.length - lote.length };
}

/* ------------------------------------------------------------- importação -- */

const lc = (v) => String(v == null ? '' : v).trim().toLowerCase();
const ISO = /^\d{4}-\d{2}-\d{2}$/;

async function contaPorEmail(ctx, email) {
  const q = await ctx.db.collection('users').where('email', '==', email).limit(1).get();
  if (!q.empty) return q.docs[0];
  const q2 = await ctx.db.collection('users').where('email_lc', '==', email).limit(1).get();
  return q2.empty ? null : q2.docs[0];
}

/**
 * O clube que já tinha lista de sócios fora da plataforma a traz (nome,
 * e-mail, número, validade), até 100 linhas por chamada. Quem TEM conta com
 * aquele e-mail vira associado ATIVO no plano escolhido (número da lista ou
 * sequencial; validade da lista ou do plano), uma transação por pessoa; quem já
 * tem filiação viva é pulado; quem não tem conta fica em `imports` (só a
 * secretaria lê) para o clube convidar por fora. Nenhum e-mail vai para a
 * filiação.
 */
async function importar(ctx, actor, data, { club, hoje }) {
  const p = await plano(ctx, club.id, data.planId);
  const rows = Array.isArray(data.rows) ? data.rows.slice(0, IMPORT_MAX) : [];
  if (!rows.length) falha('invalid-argument', 'A lista está vazia.');
  const importados = []; const pulados = []; const pendentes = []; const vistos = new Set();
  for (const raw of rows) {
    const email = lc(raw && raw.email);
    const name = texto(raw && raw.name, 120);
    const member_number = texto(raw && raw.member_number, 40);
    const valid_until = ISO.test(String((raw && raw.valid_until) || '')) ? String(raw.valid_until) : '';
    if (!email || !email.includes('@') || vistos.has(email)) { pulados.push({ email, reason: 'E-mail inválido ou repetido' }); continue; }
    vistos.add(email);
    // eslint-disable-next-line no-await-in-loop
    const conta = await contaPorEmail(ctx, email);
    if (!conta) { pendentes.push({ email, name, member_number, valid_until }); continue; }
    const uid = conta.id;
    const u = conta.data() || {};
    const ref = col(ctx, club.id, 'aff').doc(uid);
    // eslint-disable-next-line no-await-in-loop
    const atual = await ref.get();
    if (atual.exists && LIVE.includes(atual.data().status)) { pulados.push({ email, reason: 'Já tem filiação neste clube' }); continue; }
    const doc = {
      club_id: club.id, user_id: uid, user_name: texto(u.platform_name || u.full_name || u.display_name || name || 'Atleta', 120), photo_url: texto(u.photo_url || u.avatar_url, 500),
      plan_id: p.id, plan_name: p.name, category: p.category || '', billing: p.billing || 'annual', free: preco(p) === 0, status: 'pending', public_badge: true,
      note: '', imported: true, imported_by: actor.uid, requested_at_ms: ctx.now, updated_at: ctx.Timestamp.fromMillis(ctx.now),
      member_number: member_number || (atual.exists && atual.data().member_number) || null, card_code: null, valid_from: null, valid_until: null, expiry_notified: {},
    };
    // eslint-disable-next-line no-await-in-loop
    await ctx.db.runTransaction(async (tr) => {
      const ativo = await ativar(ctx, tr, { club, ref, aff: doc, plan: p, hoje, novo: true });
      if (valid_until && ativo.valid_until && valid_until !== ativo.valid_until) tr.update(ref, { valid_until });
    });
    importados.push({ email, uid });
  }
  const batch = ctx.db.batch();
  const impRef = col(ctx, club.id, 'imports').doc();
  batch.set(impRef, { club_id: club.id, plan_id: p.id, plan_name: p.name, by: actor.uid, created_at_ms: ctx.now, imported_count: importados.length, skipped: pulados, pending: pendentes, total_rows: rows.length });
  importados.forEach(({ uid }) => aviso(ctx, batch, uid, { title: tx('Você foi associado ao {clube}', { clube: club.name }), message: tx('O clube importou seu cadastro. Veja a sua associação na página do clube.'), link: `/clubes/${club.id}?tab=associacao` }));
  await batch.commit();
  await auditoria(ctx, actor, 'club_members_import', { club_id: club.id, plan_id: p.id, imported: importados.length, skipped: pulados.length, pending: pendentes.length, import_id: impRef.id });
  return { ok: true, importId: impRef.id, imported: importados.length, skipped: pulados, pending: pendentes.length };
}

/* --------------------------------------------------------------- cobrança -- */

async function declarar(ctx, actor, data, { club }) {
  const ref = col(ctx, club.id, 'charges').doc(texto(data.chargeId, 80));
  const snap = await ref.get();
  if (!snap.exists) falha('not-found', 'Cobrança não encontrada.');
  const c = snap.data();
  if (c.user_id !== actor.uid) falha('permission-denied', 'Esta cobrança não é sua.');
  if (!['open', 'declared'].includes(c.status)) falha('failed-precondition', 'Esta cobrança já foi fechada.');
  await ref.update({ status: 'declared', declared_at: m.isoDateBR(ctx.now), declared_at_ms: ctx.now, declared_note: texto(data.note, 200) });
  const batch = ctx.db.batch();
  (await quemTem(ctx, club.id, 'finance')).filter((id) => id !== actor.uid).forEach((fid) => aviso(ctx, batch, fid, {
    title: tx('Pagamento informado no {clube}', { clube: club.name }),
    message: tx('{nome} informou o pagamento de {oque}. Confira o Pix e confirme.', { nome: c.payer_name || tx('Um associado'), oque: c.plan_name || tx('uma cobrança') }),
    link: `/clubes/${club.id}/gerir?aba=financeiro`,
  }));
  await batch.commit();
  return { ok: true };
}

async function confirmarCobranca(ctx, actor, data, { club, hoje }) {
  const acao = texto(data.decision, 10);
  if (!['confirm', 'cancel'].includes(acao)) falha('invalid-argument', 'Ação desconhecida.');
  const cref = col(ctx, club.id, 'charges').doc(texto(data.chargeId, 80));
  const csnap = await cref.get();
  if (!csnap.exists) falha('not-found', 'Cobrança não encontrada.');
  const charge = { id: csnap.id, ...csnap.data() };
  if (!['open', 'declared'].includes(charge.status)) falha('failed-precondition', 'Esta cobrança já foi fechada.');
  const note = texto(data.note, 300);
  const aref = col(ctx, club.id, 'aff').doc(charge.user_id);
  const linkMinha = `/clubes/${club.id}?tab=associacao`;

  if (acao === 'cancel') {
    const batch = ctx.db.batch();
    batch.update(cref, { status: 'cancelled', cancelled_at_ms: ctx.now, cancelled_by: actor.uid, cancel_note: note });
    const a = await aref.get();
    // A filiação que esperava este pagamento volta a "aguardando aprovação": nunca fica presa.
    if (a.exists && a.data().status === 'awaiting_payment' && charge.origin === 'membership') batch.update(aref, { status: 'pending', updated_at: ctx.Timestamp.fromMillis(ctx.now) });
    aviso(ctx, batch, charge.user_id, { title: tx('Cobrança do {clube} cancelada', { clube: club.name }), message: note ? tx('Motivo: {motivo}.', { motivo: note }) : tx('O clube cancelou a cobrança.'), link: linkMinha });
    await batch.commit();
    await auditoria(ctx, actor, 'club_charge_cancel', { club_id: club.id, charge_id: charge.id, user_id: charge.user_id, note });
    return { ok: true };
  }

  const p = await plano(ctx, club.id, charge.plan_id);
  await ctx.db.runTransaction(async (tr) => {
    const asnap = await tr.get(aref);
    if (!asnap.exists) falha('not-found', 'A filiação desta cobrança não existe mais.');
    const aff = { id: asnap.id, ...asnap.data() };
    if (!['awaiting_payment', 'active', 'expired'].includes(aff.status)) falha('failed-precondition', 'A filiação não está num estado que aceite pagamento.');
    await ativar(ctx, tr, { club, ref: aref, aff, plan: p, hoje });
    tr.update(cref, { status: 'paid', paid_at: hoje, paid_at_ms: ctx.now, confirmed_by: actor.uid, confirmed_by_name: actor.name || '', confirm_note: note });
  });
  const batch = ctx.db.batch();
  aviso(ctx, batch, charge.user_id, {
    title: tx('Pagamento confirmado — {clube}', { clube: club.name }),
    message: charge.origin === 'renewal' ? tx('Sua associação foi renovada. A carteirinha já mostra a nova validade.') : tx('Sua associação está ativa. A carteirinha digital está na página do clube.'),
    link: linkMinha,
  });
  await batch.commit();
  await auditoria(ctx, actor, 'club_charge_confirm', { club_id: club.id, charge_id: charge.id, user_id: charge.user_id, amount_cents: charge.amount_cents });
  return { ok: true };
}

/* -------------------------------------------------------------- varredura -- */

/**
 * Diária: vence quem venceu, avisa 30/7/1 dias antes (uma vez cada), gera a
 * cobrança da PRÓXIMA mensalidade (7 dias antes) e lembra a cobrança em
 * aberto (no vencimento e 7 dias depois). Só os clubes com associação.
 */
async function sweep(ctx) {
  if (!(await flagLigada(ctx))) return { skipped: 'flag' };
  const hoje = m.isoDateBR(ctx.now);
  const clubes = await ctx.db.collection('clubs').where('association.enabled', '==', true).get();
  let vencidas = 0; let avisos = 0; let novas = 0; let lembretes = 0;
  for (const cd of clubes.docs) {
    const club = { id: cd.id, ...cd.data() };
    const link = `/clubes/${club.id}?tab=associacao`;
    // eslint-disable-next-line no-await-in-loop
    const ativos = await col(ctx, club.id, 'aff').where('status', '==', 'active').get();
    // eslint-disable-next-line no-await-in-loop
    const abertas = await col(ctx, club.id, 'charges').where('status', '==', 'open').get();
    const comRenovacao = new Set(abertas.docs.filter((d) => d.data().origin === 'renewal').map((d) => d.data().user_id));
    let batch = ctx.db.batch();
    let n = 0;
    const flush = async () => { if (n) { await batch.commit(); batch = ctx.db.batch(); n = 0; } };
    for (const d of ativos.docs) {
      const a = d.data();
      if (!a.valid_until) continue; // gratuito: não vence
      const dias = m.daysBetween(hoje, a.valid_until);
      if (dias < 0) {
        batch.update(d.ref, { status: 'expired', expired_at_ms: ctx.now });
        aviso(ctx, batch, a.user_id, { title: tx('Sua associação no {clube} venceu', { clube: club.name }), message: tx('Renove para continuar com as vantagens. A carteirinha mostra "Vencida" até lá.'), link });
        vencidas += 1; n += 2;
      } else {
        const marcos = m.EXPIRY_NOTICE_DAYS.filter((x) => dias <= x && !(a.expiry_notified || {})[String(x)]);
        if (marcos.length) {
          aviso(ctx, batch, a.user_id, {
            title: dias === 0 ? tx('Sua associação no {clube} vence hoje', { clube: club.name }) : tx('Sua associação no {clube} vence em {dias} dias', { clube: club.name, dias }),
            message: tx('Renove pela página do clube para não perder as vantagens.'), link,
          });
          const notified = { ...(a.expiry_notified || {}) };
          marcos.forEach((x) => { notified[String(x)] = true; });
          batch.update(d.ref, { expiry_notified: notified });
          avisos += 1; n += 2;
        }
        // Mensalidade: a próxima cobrança já espera pela pessoa, sem ela precisar pedir.
        if (a.billing === 'monthly' && dias <= NEXT_CHARGE_DAYS && !comRenovacao.has(a.user_id)) {
          // eslint-disable-next-line no-await-in-loop
          const pl = await plano(ctx, club.id, a.plan_id).catch(() => null);
          if (pl && pl.active !== false && preco(pl) > 0) {
            // eslint-disable-next-line no-await-in-loop
            const c = await novaCobranca(ctx, batch, { club, aff: a, plan: pl, origin: 'renewal', hoje, amount: preco(pl) });
            aviso(ctx, batch, a.user_id, { title: tx('Sua mensalidade do {clube} está disponível', { clube: club.name }), message: tx('Pague pelo Pix e toque em "Já paguei".'), link });
            comRenovacao.add(a.user_id);
            novas += 1; n += 3;
            void c;
          }
        }
      }
      // eslint-disable-next-line no-await-in-loop
      if (n >= 380) await flush();
    }
    for (const d of abertas.docs) {
      const c = d.data();
      if (!c.due_date || !c.user_id) continue;
      const atraso = m.daysBetween(c.due_date, hoje);
      const feitos = c.overdue_notified || {};
      const marco = [7, 0].find((x) => atraso >= x && !feitos[String(x)]);
      if (marco == null) continue;
      aviso(ctx, batch, c.user_id, {
        title: marco === 0 ? tx('Cobrança do {clube} vence hoje', { clube: club.name }) : tx('Cobrança do {clube} vencida há {dias} dias', { clube: club.name, dias: atraso }),
        message: tx('{oque}: pague pelo Pix e toque em "Já paguei". O financeiro do clube confirma.', { oque: c.plan_name || tx('Associação') }), link,
      });
      batch.update(d.ref, { overdue_notified: { ...feitos, 0: true, ...(marco === 7 ? { 7: true } : {}) } });
      lembretes += 1; n += 2;
      // eslint-disable-next-line no-await-in-loop
      if (n >= 380) await flush();
    }
    // eslint-disable-next-line no-await-in-loop
    await flush();
  }
  if (ctx.logger) ctx.logger.info('Associação de clubes: varredura diária.', { clubes: clubes.size, vencidas, avisos, novas, lembretes });
  return { vencidas, avisos, novas, lembretes };
}

/* ----------------------------------------------------------------- verify -- */

/** Verificação pública pelo código: só o mínimo (nome, clube, categoria, número, situação, validade). */
async function verify(ctx, data) {
  if (!(await flagLigada(ctx))) return { found: false };
  const code = m.normalizeCardCode(data && data.code);
  if (!code) return { found: false };
  const idx = await ctx.db.collection(INDEX).doc(code).get();
  if (!idx.exists) return { found: false };
  const i = idx.data();
  const cs = await ctx.db.collection('clubs').doc(i.club_id).get();
  if (!cs.exists || cs.data().association?.enabled !== true) return { found: false };
  const as = await col(ctx, i.club_id, 'aff').doc(i.user_id).get();
  if (!as.exists) return { found: false };
  const a = as.data();
  const st = m.membershipState({ status: a.status, valid_until: a.valid_until }, m.isoDateBR(ctx.now), ctx.now);
  const club = cs.data();
  return {
    found: true,
    name: a.user_name || '',
    photo_url: a.public_badge === false ? '' : (a.photo_url || ''),
    club: { id: cs.id, name: club.name, logo_url: club.logo_url || '' },
    category: a.category || '',
    plan_name: a.plan_name || '',
    member_number: a.member_number || '',
    status: st.status,
    valid_until: a.valid_until || '',
  };
}

module.exports = {
  X, INDEX, PERMS, LIVE, association, sweep, verify, permsDe, exigePerm, quemTem, aberta, sigla, validade, flagLigada, exigeFlag, falha, texto, col, aviso, auditoria, clube, plano,
};
