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
 *  - VERIFICAÇÃO (`verify`, pública): o mínimo da carteirinha — ou da
 *    CREDENCIAL de curso (PR 3) — pelo código.
 *
 * PR 3: o pedido grava CPF (se a federação pede) e o responsável do menor em
 * `federation_members/{id}/private/data`; o responsável filia DEPENDENTES
 * (`{fed}_dep_{id}`, `user_id` nulo, `guardian_uid`) e paga por eles; quem já
 * é federado em outra federação só entra por TRANSFERÊNCIA; a cobrança aplica
 * o desconto do plano (menor, 60+, família — cópia `planPrice`); cobrança de
 * CURSO confirma a inscrição e de MULTA quita a sanção. Transferências,
 * importação, cursos, disciplina e documentos: `federationTransfers.js`,
 * `federationCourses.js`, `federationDiscipline.js`, `federationSecretariat.js`.
 *
 * ⚠️ A conta da validade é CÓPIA de `src/modules/federations/domain/
 * membership.js` (`federationMembership.js`, com paridade).
 */
const crypto = require('node:crypto');
const m = require('./federationMembership.js');
const { tx, textoDoAviso, i18nDoAviso } = require('./avisoI18n.js');
const P = require('./federationStaffPolicy.js');
const O = require('./federationOrgMembers.js');
const { resolveMemberType } = require('./federationMemberTypes.js');
const RG = require('./federationRegularityPolicy.js');
const IP = require('./federationInsurancePolicy.js');

class FederationError extends Error {
  constructor(code, message) { super(message); this.code = code; this.name = 'FederationError'; }
}
const falha = (code, msg) => { throw new FederationError(code, msg); };

const C = Object.freeze({
  federations: 'federations', staff: 'federation_staff', plans: 'federation_plans',
  members: 'federation_members', charges: 'federation_charges', cardIndex: 'federation_card_index',
  transfers: 'federation_transfers', documents: 'federation_documents_submitted', imports: 'federation_imports',
  courses: 'federation_courses', enrollments: 'federation_course_enrollments', credentials: 'federation_credentials',
  sanctions: 'federation_sanctions', reports: 'federation_reports', invites: 'federation_invites',
});
const MINOR_AGE = 18;
const GUARDIAN_ONLY_AGE = 12;
// Cargo → permissões, mandato e admin master: `federationStaffPolicy.js` (cópia do cliente, com paridade).
const PERMS = P.PERMS;
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

/**
 * As permissões de quem age NESTA federação: o cargo com o mandato valendo.
 * O admin da plataforma só tem poder com o acesso JUSTIFICADO valendo
 * (`federation_admin_grants`, aberto por `federationAdminAccess`).
 */
async function staffPerms(ctx, fedId, actor) {
  if (actor.isPlatformAdmin) {
    const g = await ctx.db.collection('federation_admin_grants').doc(`${fedId}_${actor.uid}`).get();
    if (g.exists && P.grantActive(g.data(), ctx.now)) return [...P.ALL];
  }
  const snap = await ctx.db.collection(C.staff).doc(`${fedId}_${actor.uid}`).get();
  return snap.exists ? P.permsOf(snap.data(), ctx.now) : [];
}

async function exigePerm(ctx, fedId, actor, perm) {
  const perms = await staffPerms(ctx, fedId, actor);
  if (!perms.includes(perm)) falha('permission-denied', 'Você não tem permissão para isso nesta federação.');
}

/**
 * PUBLICADA: aprovada pela plataforma E aberta pelo admin dela (`published`,
 * ausente = oculta). Mesma conta de `fedPublic` na regra e de
 * `isFederationPublic` no cliente. Oculta, a equipe trabalha; quem é de fora
 * não se filia, não transfere para ela, não comenta nem assina a agenda.
 */
const publicada = (fed) => Boolean(fed) && fed.status === 'approved' && fed.published === true;

async function federacao(ctx, fedId) {
  const snap = await ctx.db.collection(C.federations).doc(texto(fedId, 80)).get();
  if (!snap.exists) falha('not-found', 'Federação não encontrada.');
  return { id: snap.id, ...snap.data() };
}

const staffIds = async (ctx, fedId, perm) => {
  const snap = await ctx.db.collection(C.staff).where('federation_id', '==', fedId).get();
  return snap.docs.map((d) => d.data()).filter((s) => P.permsOf(s, ctx.now).includes(perm)).map((s) => s.user_id);
};

const novoCodigo = () => m.cardCodeFromBytes(crypto.randomBytes(m.CARD_CODE_LENGTH));

/**
 * O termo do seguro (módulo `insurance`, `docs/50` §42) no pedido e na
 * renovação: exigido, a tela manda a versão que mostrou; devolve o que gravar
 * (`{}` se já aceitou a de hoje, `null` se não é exigido).
 */
function aceiteDoTermo(fed, member, data, uid, now) {
  const st = IP.termState(member, fed);
  if (!st.required) return null;
  if (st.accepted) return {};
  if (String((data && data.insuranceTermVersion) || '') !== st.version) falha('failed-precondition', 'Leia e aceite o termo do seguro para continuar (ele pode ter mudado agora há pouco).');
  return IP.termAcceptancePatch(member, st.version, uid, now);
}

/* ------------------------------------------------------------- review -- */

const REVIEW = Object.freeze({
  approve: { from: ['pending', 'suspended', 'rejected'], patch: { status: 'approved' } },
  reject: { from: ['pending'], patch: { status: 'rejected' }, needsReason: true },
  suspend: { from: ['approved'], patch: { status: 'suspended' }, needsReason: true },
  verify: { from: ['approved'], patch: { verified: true } },
  unverify: { from: ['approved'], patch: { verified: false } },
  official: { from: ['approved'], patch: { official: true } },
  unofficial: { from: ['approved'], patch: { official: false } },
  // Bloco 6: a confederação recebe as estaduais como filiadas (`federationNational.js`).
  confederation: { from: ['approved'], patch: { confederation: true } },
  unconfederation: { from: ['approved'], patch: { confederation: false } },
});

/**
 * `{ 'modules.<id>': true }` para cada módulo marcado em `default_modules`.
 * A tela do admin já normaliza (só os disponíveis, e o que um exige vai
 * junto); aqui só se confere o formato da chave — módulo desconhecido ligado
 * não aparece em lugar nenhum (`fedModuleOn` só lê os disponíveis).
 */
function modulosIniciais(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(Object.keys(raw).filter((k) => /^[a-z_]{2,30}$/.test(k) && raw[k] === true).map((k) => [`modules.${k}`, true]));
}

async function review(ctx, actor, data) {
  if (!actor.isPlatformAdmin) falha('permission-denied', 'Só o admin da plataforma revisa federações.');
  if (!(await flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const acao = REVIEW[data.action];
  if (!acao) falha('invalid-argument', 'Ação desconhecida.');
  const reason = texto(data.reason, 500);
  if (acao.needsReason && reason.length < 3) falha('invalid-argument', 'Diga o motivo.');
  const fed = await federacao(ctx, data.federationId);
  if (!acao.from.includes(fed.status)) falha('failed-precondition', 'A federação já mudou de estado. Atualize a página.');
  if (data.action === 'confederation' && fed.national_body && fed.national_body.id) falha('failed-precondition', 'Esta federação é filiada a uma confederação. Ela se desfilia antes de virar confederação.');
  if (data.action === 'unconfederation') {
    // Tirar o papel com estaduais filiadas deixaria o selo "Filiada à" apontando para quem não é mais confederação.
    const filiadas = await ctx.db.collection('federation_national_links').where('conf_id', '==', fed.id).where('status', '==', 'approved').get();
    if (!filiadas.empty) falha('failed-precondition', `A confederação tem ${filiadas.size} federação(ões) filiada(s). Elas se desfiliam (ou são desligadas) antes.`);
  }

  if (data.action === 'approve' && fed.slug) {
    // O endereço público (`/f/:slug`) é único entre as APROVADAS — duas no ar com o mesmo slug é uma página só.
    const mesmoSlug = await ctx.db.collection(C.federations).where('slug', '==', fed.slug).where('status', '==', 'approved').get();
    if (mesmoSlug.docs.some((d) => d.id !== fed.id)) falha('already-exists', `Já existe uma federação aprovada com o endereço "${fed.slug}". Peça outro endereço antes de aprovar.`);
  }
  const batch = ctx.db.batch();
  const ref = ctx.db.collection(C.federations).doc(fed.id);
  const patch = { ...acao.patch, review: { action: data.action, reason, by: actor.uid, at_ms: ctx.now }, updated_at: ctx.Timestamp.fromMillis(ctx.now) };
  // Primeira aprovação (pendente ou recusada antes): os módulos que o admin da
  // plataforma marcou para nascer ligados (`platform_settings/federations.default_modules`).
  // Suspensa reaprovada mantém os dela.
  if (data.action === 'approve' && fed.status !== 'suspended') {
    const cfg = await ctx.db.collection('platform_settings').doc('federations').get();
    Object.assign(patch, modulosIniciais(cfg.exists ? cfg.data().default_modules : null));
  }
  batch.update(ref, patch);
  // Aprovar pela primeira vez cria o presidente: quem pediu a abertura — se a conta ainda existe.
  if (data.action === 'approve' && fed.created_by) {
    const staffRef = ctx.db.collection(C.staff).doc(`${fed.id}_${fed.created_by}`);
    const [atual, conta] = await Promise.all([staffRef.get(), ctx.db.collection('users').doc(fed.created_by).get()]);
    if (!atual.exists && conta.exists) {
      // O primeiro admin master (cargo de presidente), sem data de fim — a federação monta os mandatos depois.
      const pres = P.effectiveRoles(fed).find((r) => r.is_master) || P.DEFAULT_ROLES[0];
      batch.set(staffRef, {
        federation_id: fed.id, federation_name: fed.name, federation_acronym: fed.acronym || '', user_id: fed.created_by, user_name: fed.created_by_name || '',
        role: pres.id, role_id: pres.id, role_name: pres.name, perms: [...pres.perms], is_master: true,
        term_start: m.isoDateBR(ctx.now), term_end: '', term_end_ms: 0, term_history: [], term_warned: [],
        added_by: actor.uid, created_at: ctx.Timestamp.fromMillis(ctx.now),
      });
    }
  }
  const link = `/federacoes/${fed.id}/gerir`;
  const avisos = {
    approve: [tx('{sigla} foi aprovada'), tx('A federação foi aprovada e segue oculta até você publicar. Configure o Pix, os planos e a equipe na Central e, quando estiver pronta, publique em Página pública → Publicação.')],
    reject: [tx('O pedido da {sigla} foi recusado'), tx('Motivo: {motivo}. Corrija e peça de novo.')],
    suspend: [tx('{sigla} foi suspensa'), tx('Motivo: {motivo}. A página e as filiações ficam fora do ar até a revisão.')],
    verify: [tx('{sigla} recebeu o selo de verificada'), tx('O CNPJ e o estatuto foram conferidos pela plataforma.')],
    official: [tx('{sigla} foi marcada como oficial'), tx('A federação aparece com o selo de oficial no diretório e na página.')],
    confederation: [tx('{sigla} agora é uma confederação'), tx('As federações estaduais podem se filiar a ela. Convide-as e defina as regras da rede na Central, em Rede nacional.')],
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

/**
 * Ativa (ou renova) numa transação: número sequencial, validade, código novo,
 * índice da carteirinha. ⚠️ Lê a federação ANTES de qualquer escrita — numa
 * transação do Admin SDK toda leitura precede toda escrita, e quem gravava o
 * documento antes de chamar aqui (pedido gratuito, importação) recebia
 * "Firestore transactions require all reads to be executed before all writes".
 * `novo: true` CRIA a filiação (`set`) em vez de atualizá-la.
 */
async function ativar(ctx, tr, { fed, memberRef, member, plan, hoje, novo = false }) {
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
  // Clube/arena: a data da filiação (colégio eleitoral) é a da PRIMEIRA ativação.
  if (O.isOrg(member)) patch.affiliated_since_ms = Number(member.affiliated_since_ms) || ctx.now;
  // O código GIRA a cada ativação: carteirinha antiga clonada não continua "em dia".
  const code = novoCodigo();
  if (member.card_code) tr.delete(ctx.db.collection(C.cardIndex).doc(member.card_code));
  tr.set(ctx.db.collection(C.cardIndex).doc(code), { member_id: memberRef.id, federation_id: fed.id, created_at_ms: ctx.now });
  patch.card_code = code;
  if (novo) tr.set(memberRef, { ...member, ...patch });
  else tr.update(memberRef, patch);
  O.espelhar(ctx, tr, { ...member, ...patch }, memberRef.id, 'active');
  return { ...member, ...patch };
}

/**
 * Uma cobrança. `amount` já vem com o desconto (`valorDoPlano`); o pagador é o
 * RESPONSÁVEL quando a filiação é de um dependente. `extra` leva o vínculo da
 * origem (`enrollment_id`, `sanction_id`).
 */
function novaCobranca(ctx, batchOrTr, { fed, member, memberId, plan, origin, hoje, amount, extra = {} }) {
  const ref = ctx.db.collection(C.charges).doc();
  const base = plan ? Math.max(0, Math.trunc(Number(plan.price_cents) || 0)) : 0;
  const data = {
    federation_id: fed.id, member_id: memberId, payer_uid: destinatario(member), payer_name: (member && (member.guardian_name || member.user_name)) || '',
    member_name: (member && member.user_name) || '',
    origin, plan_id: plan ? plan.id : null, plan_name: plan ? plan.name : (extra.plan_name || ''), amount_cents: amount == null ? base : Math.max(0, Math.trunc(Number(amount) || 0)),
    status: 'open', due_date: m.chargeDueDate(hoje), created_at: ctx.Timestamp.fromMillis(ctx.now), created_at_ms: ctx.now, ...extra,
  };
  batchOrTr.set(ref, data);
  return { id: ref.id, ...data };
}

/** Quem recebe aviso e cobrança da filiação: o responsável do dependente, o representante do clube/arena, senão a pessoa. */
const destinatario = (member) => (member && (member.guardian_uid || member.user_id || member.representative_uid)) || null;

/** Id curto para documentos sem id natural (dependente). */
const novoId = () => crypto.randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g, 'x').slice(0, 8);

/** A idade do filiado hoje: do cadastro (conta própria) ou do subdocumento privado (dependente). */
async function idadeDoMembro(ctx, member, hoje) {
  if (member.user_id) {
    const u = await ctx.db.collection('users').doc(member.user_id).get();
    return idadeDe(u.exists ? u.data().birth_date : null, hoje);
  }
  const priv = await ctx.db.collection(C.members).doc(member.id).collection('private').doc('data').get();
  return idadeDe(priv.exists ? priv.data().birth_date : null, hoje);
}

/** Posição desta filiação na FAMÍLIA (quem paga): 1 = a primeira; a 2ª em diante ganha o desconto família. */
async function indiceFamilia(ctx, fedId, member) {
  const pagador = destinatario(member);
  // Clube e arena não têm família: o representante tem a filiação dele, que não conta aqui.
  if (!pagador || O.isOrg(member)) return 1;
  const [proprias, dependentes] = await Promise.all([
    ctx.db.collection(C.members).where('federation_id', '==', fedId).where('user_id', '==', pagador).get(),
    ctx.db.collection(C.members).where('federation_id', '==', fedId).where('guardian_uid', '==', pagador).get(),
  ]);
  const outras = [...proprias.docs, ...dependentes.docs].filter((d) => d.id !== member.id && LIVE.includes(d.data().status) && d.data().status !== 'pending');
  return outras.length + 1;
}

/** O valor que a cobrança leva: o preço do plano para ESTA pessoa (a mesma conta da tela). */
async function valorDoPlano(ctx, fed, member, plan, hoje) {
  const [age, familyIndex] = await Promise.all([idadeDoMembro(ctx, member, hoje), indiceFamilia(ctx, fed.id, member)]);
  return m.planPrice(plan, { age, familyIndex }).total;
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
  const propria = ['request', 'renew', 'cancel', 'invite_decline', 'represent'].includes(acao);
  if (!propria) await exigePerm(ctx, fed.id, actor, 'members');
  const reason = texto(data.reason, 500);
  const link = `/perfil?secao=federacoes`;

  if (acao === 'request') return pedirFiliacao(ctx, actor, data, { fed, hoje });
  if (['invite', 'invite_cancel', 'invite_decline'].includes(acao)) return convite(ctx, actor, acao, data, { fed });

  // A filiação alvo: pelo id (dependente, ou a equipe apontando) ou a da própria conta.
  const memberId = texto(data.memberId, 120) || `${fed.id}_${propria ? actor.uid : texto(data.userId, 128)}`;
  const memberRef = ctx.db.collection(C.members).doc(memberId);
  const snap = await memberRef.get();
  if (!snap.exists || snap.data().federation_id !== fed.id) falha('not-found', 'Filiação não encontrada.');
  const member = { id: snap.id, ...snap.data() };
  if (propria && member.user_id !== actor.uid && member.guardian_uid !== actor.uid && !(O.isOrg(member) && (await O.gereOrg(ctx, member.org_kind, member.org_id, actor.uid)))) falha('permission-denied', 'Esta filiação não é sua.');
  const destino = destinatario(member);
  const uid = member.user_id || destino;
  const p = member.plan_id ? await plano(ctx, fed.id, member.plan_id).catch(() => null) : null;

  // Clube/arena: outro gestor da entidade passa a responder pela filiação
  // (o representante saiu, mudou o cargo ou excluiu a conta). As cobranças em
  // aberto vão para ele, porque só quem paga declara o pagamento.
  if (acao === 'represent') {
    if (!O.isOrg(member)) falha('failed-precondition', 'Só a filiação de clube ou arena tem representante.');
    if (!LIVE.includes(member.status)) falha('failed-precondition', 'Esta filiação já está encerrada.');
    if (member.representative_uid === actor.uid) falha('failed-precondition', 'Você já é o representante desta filiação.');
    const perfil = await ctx.db.collection('users').doc(actor.uid).get();
    const u = perfil.exists ? perfil.data() : {};
    const nome = texto(u.platform_name || u.full_name || u.display_name || 'Gestor', 120);
    const cargo = texto(data.representativeRole, 60);
    const antes = (Array.isArray(member.representatives) ? member.representatives : []).filter((r) => r && r.uid && r.uid !== actor.uid);
    const batch = ctx.db.batch();
    batch.update(memberRef, {
      representative_uid: actor.uid, representative_name: nome,
      representatives: [{ uid: actor.uid, name: nome, role: cargo }, ...antes].slice(0, 10),
      updated_at: ctx.Timestamp.fromMillis(ctx.now),
    });
    const abertas = await ctx.db.collection(C.charges).where('member_id', '==', memberRef.id).get();
    abertas.docs.filter((d) => ['open', 'declared'].includes(d.data().status)).forEach((d) => batch.update(d.ref, { payer_uid: actor.uid }));
    O.espelhar(ctx, batch, { ...member, representative_uid: actor.uid }, memberRef.id, member.status);
    if (member.representative_uid) {
      aviso(ctx, batch, member.representative_uid, { title: tx('{nome} passou a representar {entidade} na {sigla}', { nome, entidade: member.org_name || member.user_name, sigla: fed.acronym }), message: tx('As cobranças e os avisos da filiação vão para essa pessoa daqui em diante.'), link });
    }
    await batch.commit();
    await auditoria(ctx, actor, 'federation_membership_represent', { federation_id: fed.id, member_id: memberRef.id, from: member.representative_uid || null, to: actor.uid });
    return { ok: true };
  }

  if (acao === 'approve') {
    if (member.status !== 'pending') falha('failed-precondition', 'Este pedido já foi decidido.');
    if (!p) falha('failed-precondition', 'O plano deste pedido não existe mais.');
    await exigeSemOutraFederacao(ctx, member.user_id, fed.id, p);
    const valor = Number(p.price_cents) > 0 ? await valorDoPlano(ctx, fed, member, p, hoje) : 0;
    const gratis = !(valor > 0);
    let charge = null;
    if (gratis) {
      await ctx.db.runTransaction(async (tr) => {
        await ativar(ctx, tr, { fed, memberRef, member, plan: p, hoje });
        tr.update(memberRef, { decided_by: actor.uid, decided_at_ms: ctx.now });
      });
    } else {
      const batch = ctx.db.batch();
      batch.update(memberRef, { status: 'awaiting_payment', decided_by: actor.uid, decided_at_ms: ctx.now, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
      charge = novaCobranca(ctx, batch, { fed, member, memberId: memberRef.id, plan: p, origin: 'membership', hoje, amount: valor });
      await batch.commit();
    }
    const batch = ctx.db.batch();
    const quem = member.user_id ? '' : ` (${member.user_name})`;
    aviso(ctx, batch, destino, gratis
      ? { title: tx('Sua filiação na {sigla} foi aprovada', { sigla: fed.acronym }), message: tx('A carteirinha digital já está na sua Minha área.{quem}', { quem }), link }
      : { title: tx('Sua filiação na {sigla} foi aprovada', { sigla: fed.acronym }), message: tx('Falta o pagamento: pague pelo Pix e toque em "Já paguei". A carteirinha sai quando o financeiro confirmar.{quem}', { quem }), link });
    await batch.commit();
    await auditoria(ctx, actor, 'federation_membership_approve', { federation_id: fed.id, user_id: uid, member_id: memberRef.id });
    return { ok: true, chargeId: charge ? charge.id : null };
  }

  if (acao === 'reject') {
    if (member.status !== 'pending') falha('failed-precondition', 'Este pedido já foi decidido.');
    if (reason.length < 3) falha('invalid-argument', 'Diga o motivo da recusa.');
    const batch = ctx.db.batch();
    batch.update(memberRef, { status: 'rejected', reject_reason: reason, decided_by: actor.uid, decided_at_ms: ctx.now, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
    aviso(ctx, batch, destino, { title: tx('Sua filiação na {sigla} foi recusada', { sigla: fed.acronym }), message: tx('Motivo: {motivo}. Você pode corrigir e pedir de novo.', { motivo: reason }), link });
    await batch.commit();
    await auditoria(ctx, actor, 'federation_membership_reject', { federation_id: fed.id, user_id: uid, member_id: memberRef.id, reason });
    return { ok: true };
  }

  if (acao === 'renew') {
    const st = m.membershipState(member, hoje, ctx.now);
    if (!st.canRenew) falha('failed-precondition', 'A renovação abre 30 dias antes do vencimento.');
    if (!p || p.active === false) falha('failed-precondition', 'O plano desta filiação não está mais disponível. Fale com a federação.');
    const termo = aceiteDoTermo(fed, member, data, actor.uid, ctx.now);
    if (termo && Object.keys(termo).length) await memberRef.update(termo);
    const aberta = await ctx.db.collection(C.charges).where('member_id', '==', memberRef.id).get();
    if (aberta.docs.some((d) => ['open', 'declared'].includes(d.data().status) && d.data().origin === 'renewal')) falha('already-exists', 'Já existe uma cobrança de renovação em aberto.');
    const valor = Number(p.price_cents) > 0 ? await valorDoPlano(ctx, fed, member, p, hoje) : 0;
    if (!(valor > 0)) {
      await ctx.db.runTransaction(async (tr) => { await ativar(ctx, tr, { fed, memberRef, member, plan: p, hoje }); });
      return { ok: true, chargeId: null };
    }
    const batch = ctx.db.batch();
    const charge = novaCobranca(ctx, batch, { fed, member, memberId: memberRef.id, plan: p, origin: 'renewal', hoje, amount: valor });
    await batch.commit();
    return { ok: true, chargeId: charge.id };
  }

  if (acao === 'cancel') {
    if (!LIVE.includes(member.status)) falha('failed-precondition', 'Esta filiação já está encerrada.');
    const batch = ctx.db.batch();
    encerrarFiliacao(ctx, batch, memberRef, member, { status: 'cancelled', cancelled_at_ms: ctx.now, cancelled_by: actor.uid });
    const abertas = await ctx.db.collection(C.charges).where('member_id', '==', memberRef.id).get();
    abertas.docs.filter((d) => ['open', 'declared'].includes(d.data().status)).forEach((d) => batch.update(d.ref, { status: 'cancelled', cancelled_at_ms: ctx.now }));
    await O.tirarEspelho(ctx, batch, member, memberRef.id);
    await batch.commit();
    await auditoria(ctx, actor, 'federation_membership_cancel', { federation_id: fed.id, user_id: uid, member_id: memberRef.id });
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
      O.espelhar(ctx, tr, { ...member, ...patch }, memberRef.id, patch.status, { reason });
    });
    const batch = ctx.db.batch();
    aviso(ctx, batch, destino, acao === 'suspend'
      ? { title: tx('Sua filiação na {sigla} foi suspensa', { sigla: fed.acronym }), message: tx('Motivo: {motivo}. Enquanto suspensa, a carteirinha mostra "Suspensa".', { motivo: reason }), link }
      : { title: tx('Sua filiação na {sigla} voltou a valer', { sigla: fed.acronym }), message: tx('A suspensão foi encerrada e a carteirinha voltou a valer.'), link });
    await batch.commit();
    await auditoria(ctx, actor, `federation_membership_${acao}`, { federation_id: fed.id, user_id: uid, member_id: memberRef.id, reason });
    return { ok: true };
  }

  return falha('invalid-argument', 'Ação desconhecida.');
}

const INVITE_DAYS = 30;
const INVITE_MAX = 50;
const conviteValido = (cv, now) => Boolean(cv) && cv.status === 'pending' && Number(cv.expires_at_ms) > now;

/**
 * Convite para filiar: a secretaria escolhe pessoas na lista da plataforma.
 * NÃO cria filiação — ninguém vira filiado sem querer. A pessoa aceita
 * pedindo a filiação no plano do convite, e esse pedido entra sem esperar a
 * secretaria (`pedirFiliacao`); ou recusa. O convite vale 30 dias.
 */
async function convite(ctx, actor, acao, data, { fed }) {
  const agora = ctx.Timestamp.fromMillis(ctx.now);
  if (acao === 'invite_decline' || acao === 'invite_cancel') {
    const uid = acao === 'invite_decline' ? actor.uid : texto(data.userId, 128);
    const ref = ctx.db.collection(C.invites).doc(`${fed.id}_${uid}`);
    const snap = await ref.get();
    if (!snap.exists || snap.data().status !== 'pending') falha('not-found', 'Convite não encontrado.');
    const recusou = acao === 'invite_decline';
    await ref.update({ status: recusou ? 'declined' : 'cancelled', decided_by: actor.uid, decided_at_ms: ctx.now, updated_at: agora });
    await auditoria(ctx, actor, recusou ? 'federation_invite_decline' : 'federation_invite_cancel', { federation_id: fed.id, user_id: uid });
    return { ok: true };
  }
  if (!publicada(fed)) falha('failed-precondition', 'Publique a federação antes de convidar: o convite leva à página de filiação.');
  const p = await plano(ctx, fed.id, data.planId);
  if (p.active === false) falha('failed-precondition', 'Este plano não está mais disponível.');
  const ids = [...new Set((Array.isArray(data.userIds) ? data.userIds : []).map((x) => texto(x, 128)).filter(Boolean))];
  if (!ids.length) falha('invalid-argument', 'Escolha ao menos uma pessoa.');
  if (ids.length > INVITE_MAX) falha('invalid-argument', `No máximo ${INVITE_MAX} pessoas por vez.`);
  const note = texto(data.note, 300);
  const convidados = [];
  const pulados = [];
  const batch = ctx.db.batch();
  for (const uid of ids) {
    const invRef = ctx.db.collection(C.invites).doc(`${fed.id}_${uid}`);
    // eslint-disable-next-line no-await-in-loop
    const [u, mem, inv] = await Promise.all([
      ctx.db.collection('users').doc(uid).get(),
      ctx.db.collection(C.members).doc(`${fed.id}_${uid}`).get(),
      invRef.get(),
    ]);
    if (!u.exists) { pulados.push({ uid, reason: 'Conta não encontrada' }); continue; }
    if (mem.exists && LIVE.includes(mem.data().status)) { pulados.push({ uid, reason: 'Já tem filiação nesta federação' }); continue; }
    if (inv.exists && conviteValido(inv.data(), ctx.now)) { pulados.push({ uid, reason: 'Já tem convite em aberto' }); continue; }
    const ud = u.data() || {};
    batch.set(invRef, {
      federation_id: fed.id, federation_name: fed.name, federation_acronym: fed.acronym || '', user_id: uid,
      user_name: texto(ud.platform_name || ud.full_name || ud.display_name || 'Atleta', 120), photo_url: texto(ud.photo_url || ud.avatar_url, 500),
      plan_id: p.id, plan_name: p.name, note, status: 'pending', invited_by: actor.uid,
      created_at_ms: ctx.now, expires_at_ms: ctx.now + INVITE_DAYS * 86400000, updated_at: agora,
    });
    aviso(ctx, batch, uid, {
      title: tx('A {sigla} convidou você para se filiar', { sigla: fed.acronym || fed.name }),
      message: tx('Plano {plano}. Para aceitar, peça a filiação neste plano: ela entra sem esperar a secretaria. O convite vale 30 dias.', { plano: p.name }),
      link: `/federacoes/${fed.id}/filiar`,
    });
    convidados.push(uid);
  }
  if (convidados.length) await batch.commit();
  await auditoria(ctx, actor, 'federation_invite', { federation_id: fed.id, plan_id: p.id, invited: convidados, skipped: pulados.length });
  return { ok: true, invited: convidados.length, skipped: pulados };
}

/** Encerra a filiação (cancelamento, exclusão, liberação por transferência): estado + o código deixa de verificar. */
function encerrarFiliacao(ctx, batch, memberRef, member, patch) {
  batch.update(memberRef, { ...patch, card_code: null, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  if (member.card_code) batch.delete(ctx.db.collection(C.cardIndex).doc(member.card_code));
}

/**
 * O pedido de filiação (PR 3): da própria pessoa ou de um DEPENDENTE menor
 * (`data.dependent = { name, birth_date }`). Confere plano e idade; menor de
 * 12 só entra como dependente; de 12 a 17 só com o responsável declarado
 * (`data.guardian`); CPF quando a federação pede (`rules.ask_cpf`); quem já é
 * federado em outra federação só entra por transferência (D9). CPF,
 * responsável e nascimento do dependente vão para `private/data`.
 */
async function pedirFiliacao(ctx, actor, data, { fed, hoje }) {
  if (!publicada(fed)) falha('failed-precondition', 'Esta federação não está recebendo filiações.');
  const uid = actor.uid;
  const p = await plano(ctx, fed.id, data.planId);
  if (p.active === false) falha('failed-precondition', 'Este plano não está mais disponível.');
  const perfil = await ctx.db.collection('users').doc(uid).get();
  const u = perfil.exists ? perfil.data() : {};
  const nomeConta = texto(u.platform_name || u.full_name || u.display_name || 'Atleta', 120);
  const dependente = data.dependent && typeof data.dependent === 'object' ? data.dependent : null;
  const orgPedida = data.org && typeof data.org === 'object' ? { kind: texto(data.org.kind, 10), id: texto(data.org.id, 80) } : null;
  // O tipo do plano decide quem pode pedir: pessoa, clube ou arena (catálogo da plataforma).
  const cfg = await ctx.db.collection('platform_settings').doc('federations').get().catch(() => null);
  const tipo = resolveMemberType(cfg && cfg.exists ? cfg.data() : {}, p);
  if (orgPedida && tipo.entity !== orgPedida.kind) falha('failed-precondition', 'Este plano não é para este tipo de entidade.');
  if (!orgPedida && tipo.entity !== 'person') falha('failed-precondition', tipo.entity === 'club' ? 'Este plano é para clubes: peça pela gestão do clube.' : 'Este plano é para arenas: peça pela Central da arena.');
  if (orgPedida && dependente) falha('invalid-argument', 'Pedido inválido.');
  const privado = {};
  let memberRef;
  let idade;
  let alvo;
  let conviteRef = null;
  let importado = null; // convite nascido da importação: a pessoa já era filiada fora da plataforma

  if (orgPedida) {
    if (!(await O.gereOrg(ctx, orgPedida.kind, orgPedida.id, uid))) falha('permission-denied', orgPedida.kind === 'club' ? 'Só quem administra o clube pede a filiação dele.' : 'Só quem gere a arena pede a filiação dela.');
    const org = await O.dadosDaOrg(ctx, orgPedida.kind, orgPedida.id);
    if (!org) falha('not-found', 'Clube ou arena não encontrado.');
    memberRef = ctx.db.collection(C.members).doc(O.orgMemberId(fed.id, orgPedida.kind, orgPedida.id));
    const atual = await memberRef.get();
    if (atual.exists && LIVE.includes(atual.data().status)) falha('already-exists', 'Esta entidade já tem uma filiação nesta federação.');
    const anterior = atual.exists ? atual.data() : {};
    // Já era filiada pelo pedido sem plano: a data da filiação continua a de antes.
    const aff = await ctx.db.collection('federation_affiliations').doc(memberRef.id).get();
    const desde = aff.exists && aff.data().status === 'approved' && !aff.data().member_id ? Number(aff.data().review && aff.data().review.at_ms) || null : null;
    const cargo = texto(data.representativeRole, 60);
    idade = null;
    alvo = {
      user_id: null, user_name: org.name, photo_url: org.logo || '', guardian_uid: null, is_minor: false, minor_photo_consent: null,
      org_kind: orgPedida.kind, org_id: orgPedida.id, org_name: org.name, org_city: org.city, org_state: org.state, org_logo: org.logo,
      representative_uid: uid, representative_name: nomeConta, representatives: [{ uid, name: nomeConta, role: cargo }],
      affiliated_since_ms: Number(anterior.affiliated_since_ms) || desde || null, member_number: anterior.member_number || null,
    };
  } else if (dependente) {
    const nome = texto(dependente.name, 120);
    const nasc = texto(dependente.birth_date, 10);
    idade = idadeDe(nasc, hoje);
    if (nome.length < 3) falha('invalid-argument', 'Informe o nome do dependente.');
    if (idade == null || idade < 0) falha('invalid-argument', 'Informe a data de nascimento do dependente.');
    if (idade >= MINOR_AGE) falha('invalid-argument', 'Dependente só até 17 anos. Maior de idade pede a própria filiação.');
    memberRef = ctx.db.collection(C.members).doc(`${fed.id}_dep_${novoId()}`);
    alvo = { user_id: null, user_name: nome, photo_url: '', guardian_uid: uid, guardian_name: nomeConta, is_minor: true, minor_photo_consent: data.minorPhotoConsent === true };
    privado.birth_date = nasc;
    privado.guardian = { name: nomeConta, contact: texto(data.guardian && data.guardian.contact, 160) || texto(u.phone || u.email, 160) };
  } else {
    memberRef = ctx.db.collection(C.members).doc(`${fed.id}_${uid}`);
    const atual = await memberRef.get();
    if (atual.exists && LIVE.includes(atual.data().status)) falha('already-exists', 'Você já tem uma filiação nesta federação.');
    idade = idadeDe(u.birth_date, hoje);
    if (idade != null && idade < GUARDIAN_ONLY_AGE) falha('failed-precondition', 'Menor de 12 anos: o responsável filia como dependente, pela conta dele.');
    const menor = idade != null && idade < MINOR_AGE;
    if (menor) {
      const g = data.guardian && typeof data.guardian === 'object' ? data.guardian : {};
      if (texto(g.name, 120).length < 3 || texto(g.contact, 160).length < 5 || g.consent !== true) falha('invalid-argument', 'Menor de 18 anos: informe o nome e o contato do responsável, que precisa estar ciente.');
      privado.guardian = { name: texto(g.name, 120), contact: texto(g.contact, 160) };
      privado.guardian_consent = true;
    }
    alvo = {
      user_id: uid, user_name: nomeConta, photo_url: texto(u.photo_url || u.avatar_url, 500), guardian_uid: null, is_minor: menor,
      minor_photo_consent: menor ? data.minorPhotoConsent === true : null, member_number: (atual.exists && atual.data().member_number) || null,
    };
    // A suspensão disciplinar em vigor atravessa o cancelamento: desistir e pedir de novo não a apaga.
    const anterior = atual.exists ? atual.data() : {};
    if (Number(anterior.discipline_until_ms) > ctx.now) Object.assign(alvo, { discipline_until_ms: anterior.discipline_until_ms, discipline_sanction_id: anterior.discipline_sanction_id || null });
    // Quem já é FEDERADO em outra federação só muda por transferência (a antiga libera).
    await exigeSemOutraFederacao(ctx, uid, fed.id, p);
    // Convidado pela secretaria para ESTE plano: o pedido entra sem esperar a aprovação.
    const convRef = ctx.db.collection(C.invites).doc(`${fed.id}_${uid}`);
    const conv = await convRef.get();
    if (conv.exists && conviteValido(conv.data(), ctx.now) && conv.data().plan_id === p.id) {
      conviteRef = convRef;
      if (conv.data().source === 'import') importado = conv.data();
    }
  }
  // Plano por faixa de idade exige a idade conhecida (sem ela, "Juvenil" ficaria ao alcance de qualquer conta).
  if ((p.age_min != null || p.age_max != null) && idade == null) falha('failed-precondition', 'Este plano é por faixa de idade: informe a data de nascimento no seu perfil.');
  if (p.age_min != null && idade != null && idade < p.age_min) falha('failed-precondition', 'Este plano exige idade mínima maior.');
  if (p.age_max != null && idade != null && idade > p.age_max) falha('failed-precondition', 'Este plano tem idade máxima menor.');
  const cpf = orgPedida ? '' : String(data.cpf == null ? '' : data.cpf).replace(/\D/g, '');
  if (fed.rules && fed.rules.ask_cpf === true && !orgPedida) {
    if (!cpf && !dependente) falha('invalid-argument', 'Esta federação pede o CPF.');
    if (cpf && !m.isValidCpf(cpf)) falha('invalid-argument', 'CPF inválido.');
  }
  if (cpf && m.isValidCpf(cpf)) privado.cpf = cpf;

  const doc = {
    federation_id: fed.id, federation_name: fed.name, federation_acronym: fed.acronym || '', ...alvo,
    person_type: tipo.id, person_type_label: tipo.label, person_category: tipo.category, tier: p.tier || 'federated',
    plan_id: p.id, plan_name: p.name, billing: p.billing || 'annual', status: 'pending',
    public_badge: data.publicBadge !== false, show_in_directory: data.showInDirectory === true, public_photo: true,
    represented_club_id: orgPedida ? null : (texto(data.clubId, 80) || null), note: texto(data.note, 300),
    requested_at: ctx.Timestamp.fromMillis(ctx.now), requested_at_ms: ctx.now, updated_at: ctx.Timestamp.fromMillis(ctx.now),
    member_number: alvo.member_number || null, card_code: null, valid_from: null, valid_until: null, expiry_notified: {},
  };
  // Consentimentos (LGPD) marcados no pedido: cada um com a hora do servidor e quem marcou.
  const consentimentos = RG.consentsPatch(fed, null, data.consents, uid, ctx.now);
  if (consentimentos) Object.assign(doc, { consents: consentimentos.consents, consents_log: consentimentos.consents_log });
  const termo = aceiteDoTermo(fed, doc, data, uid, ctx.now);
  if (termo) Object.assign(doc, termo);
  const privRef = memberRef.collection('private').doc('data');
  const gravaPrivado = (w) => {
    if (Object.keys(privado).length) w.set(privRef, { ...privado, updated_at_ms: ctx.now }, { merge: true });
    if (conviteRef) w.update(conviteRef, { status: 'accepted', member_id: memberRef.id, decided_at_ms: ctx.now, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  };
  const valor = Number(p.price_cents) > 0 ? m.planPrice(p, { age: idade, familyIndex: await indiceFamilia(ctx, fed.id, { id: memberRef.id, ...doc }) }).total : 0;
  let charge = null;
  if (importado) {
    // Como a importação de quem já tinha conta: ATIVA, sem cobrança, com o número e a validade da lista.
    Object.assign(doc, { invited: true, imported: true, imported_by: importado.invited_by || null, imported_at_ms: ctx.now });
    if (importado.member_number) doc.member_number = importado.member_number;
    await ctx.db.runTransaction(async (tr) => {
      const ativo = await ativar(ctx, tr, { fed, memberRef, member: doc, plan: p, hoje, novo: true });
      if (importado.valid_until && importado.valid_until !== ativo.valid_until) tr.update(memberRef, { valid_until: importado.valid_until });
      gravaPrivado(tr);
    });
  } else if (p.auto_approve || conviteRef) {
    if (conviteRef) doc.invited = true;
    if (!(valor > 0)) {
      await ctx.db.runTransaction(async (tr) => {
        await ativar(ctx, tr, { fed, memberRef, member: doc, plan: p, hoje, novo: true });
        gravaPrivado(tr);
      });
    } else {
      const batch = ctx.db.batch();
      batch.set(memberRef, { ...doc, status: 'awaiting_payment' });
      gravaPrivado(batch);
      charge = novaCobranca(ctx, batch, { fed, member: doc, memberId: memberRef.id, plan: p, origin: 'membership', hoje, amount: valor });
      await batch.commit();
    }
  } else {
    const batch = ctx.db.batch();
    batch.set(memberRef, doc);
    gravaPrivado(batch);
    const secretaria = await staffIds(ctx, fed.id, 'members');
    secretaria.forEach((sid) => aviso(ctx, batch, sid, {
      title: tx('Novo pedido de filiação na {sigla}', { sigla: fed.acronym }),
      message: orgPedida
        ? tx('{nome} ({tipo}) pediu filiação no plano {plano}. Analise na Central da federação.', { nome: doc.user_name, tipo: orgPedida.kind === 'club' ? tx('clube') : tx('arena'), plano: p.name })
        : tx('{nome} pediu filiação no plano {plano}. Analise na Central da federação.', { nome: doc.user_name, plano: p.name }),
      link: `/federacoes/${fed.id}/gerir?aba=pedidos`,
    }));
    await batch.commit();
  }
  await auditoria(ctx, actor, 'federation_membership_request', { federation_id: fed.id, user_id: uid, member_id: memberRef.id, plan_id: p.id, dependent: Boolean(dependente), org_kind: orgPedida ? orgPedida.kind : null, org_id: orgPedida ? orgPedida.id : null });
  return { ok: true, memberId: memberRef.id, chargeId: charge ? charge.id : null };
}

/**
 * D9: quem já é FEDERADO (ativo) em outra federação só muda por transferência.
 * Conferido no PEDIDO e na APROVAÇÃO — entre um e outro a pessoa pode ter
 * entrado em outra federação.
 */
async function exigeSemOutraFederacao(ctx, uid, fedId, plan) {
  if (!uid || (plan.tier || 'federated') !== 'federated') return;
  const outras = await ctx.db.collection(C.members).where('user_id', '==', uid).where('status', '==', 'active').get();
  const presa = outras.docs.map((d) => d.data()).find((x) => x.federation_id !== fedId && (x.tier || 'federated') === 'federated');
  if (presa) falha('failed-precondition', `Já é federado na ${presa.federation_acronym || presa.federation_name}. A troca é por transferência (Minha área → Federações).`);
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
  return fecharCobranca(ctx, actor, { fed, snap, charge, action: data.action, note: texto(data.note, 300) });
}

/**
 * Os EFEITOS de confirmar/cancelar uma cobrança, por origem — um caminho só,
 * usado pelo financeiro (`chargeConfirm`) e pela baixa automática do Pix
 * (`federationPayments.js`, ator `gateway`). Quem chama confere a permissão.
 */
async function fecharCobranca(ctx, actor, { fed, snap, charge, action, note = '' }) {
  const data = { action };
  if (!['open', 'declared'].includes(charge.status)) falha('failed-precondition', 'Esta cobrança já foi fechada.');
  const hoje = m.isoDateBR(ctx.now);
  // Cobrança de CURSO de quem não é filiado não tem `member_id` — `doc(null)` derrubava a função.
  const memberRef = charge.member_id ? ctx.db.collection(C.members).doc(charge.member_id) : null;
  if (!['confirm', 'cancel'].includes(data.action)) falha('invalid-argument', 'Ação desconhecida.');

  // Cobrança de CURSO: confirmar inscreve de fato; cancelar devolve a vaga. De MULTA: quita a sanção.
  if (charge.origin === 'course' || charge.origin === 'fine' || charge.origin === 'sanction') {
    const batch = ctx.db.batch();
    const confirmou = data.action === 'confirm';
    batch.update(snap.ref, confirmou
      ? { status: 'paid', paid_at: hoje, paid_at_ms: ctx.now, confirmed_by: actor.uid, confirmed_by_name: actor.name || '', confirm_note: note }
      : { status: 'cancelled', cancelled_at_ms: ctx.now, cancelled_by: actor.uid, cancel_note: note });
    if (charge.origin === 'course' && charge.enrollment_id) {
      const enrRef = ctx.db.collection(C.enrollments).doc(charge.enrollment_id);
      const enr = await enrRef.get();
      if (enr.exists && enr.data().status === 'awaiting_payment') {
        batch.update(enrRef, { status: confirmou ? 'confirmed' : 'cancelled', paid_at_ms: confirmou ? ctx.now : null, updated_at_ms: ctx.now });
        if (!confirmou && enr.data().course_id) batch.update(ctx.db.collection(C.courses).doc(enr.data().course_id), { enrolled_count: ctx.FieldValue.increment(-1) });
      }
    }
    if (charge.origin === 'fine' && charge.sanction_id) {
      const sRef = ctx.db.collection(C.sanctions).doc(charge.sanction_id);
      if ((await sRef.get()).exists) batch.update(sRef, confirmou ? { fine_paid_at_ms: ctx.now, updated_at_ms: ctx.now } : { fine_charge_cancelled_at_ms: ctx.now, updated_at_ms: ctx.now });
    }
    // Taxa de CHANCELA (Bloco 2): o pedido no torneio fica sabendo (paga ou dispensada) e competições é avisada.
    if (charge.origin === 'sanction' && charge.tournament_id) {
      const tRef = ctx.db.collection('tournaments').doc(charge.tournament_id);
      const tSnap = await tRef.get();
      if (tSnap.exists && tSnap.data().federation_id === fed.id && tSnap.data().federation_sanction) {
        batch.update(tRef, confirmou ? { 'federation_sanction.fee_paid_at_ms': ctx.now } : { 'federation_sanction.fee_cancelled_at_ms': ctx.now });
      }
      if (confirmou) {
        (await staffIds(ctx, fed.id, 'competitions')).filter((uid) => uid !== actor.uid).forEach((uid) => aviso(ctx, batch, uid, {
          title: tx('Taxa de chancela paga: {torneio}', { torneio: charge.plan_name }), message: tx('O pedido de chancela já pode ser analisado.'), link: `/federacoes/${fed.id}/gerir?aba=chancelas`,
        }));
      }
    }
    const mensagemPaga = { course: tx('Sua inscrição no curso {curso} está confirmada.', { curso: charge.plan_name }), sanction: tx('A taxa de chancela foi paga. A federação vai analisar o pedido.') }[charge.origin] || tx('A multa foi quitada.');
    const linkPago = { course: `/federacoes/${fed.id}?ancora=fed-cursos`, sanction: `/torneios/${charge.tournament_id}/gerenciar` }[charge.origin] || '/perfil?secao=federacoes';
    aviso(ctx, batch, charge.payer_uid, confirmou
      ? { title: tx('Pagamento confirmado — {sigla}', { sigla: fed.acronym }), message: mensagemPaga, link: linkPago }
      : { title: tx('Cobrança da {sigla} cancelada', { sigla: fed.acronym }), message: note ? tx('Motivo: {motivo}.', { motivo: note }) : tx('A federação cancelou a cobrança.'), link: '/perfil?secao=federacoes' });
    await batch.commit();
    await auditoria(ctx, actor, `federation_charge_${data.action}`, { federation_id: fed.id, charge_id: charge.id, user_id: charge.payer_uid, origin: charge.origin, note });
    return { ok: true };
  }

  if (data.action === 'cancel') {
    const batch = ctx.db.batch();
    batch.update(snap.ref, { status: 'cancelled', cancelled_at_ms: ctx.now, cancelled_by: actor.uid, cancel_note: note });
    const ms = memberRef ? await memberRef.get() : null;
    // A filiação que esperava este pagamento volta a "aguardando aprovação" (a secretaria decide de novo) — nunca fica presa.
    if (ms && ms.exists && ms.data().status === 'awaiting_payment' && charge.origin === 'membership') batch.update(memberRef, { status: 'pending', updated_at: ctx.Timestamp.fromMillis(ctx.now) });
    aviso(ctx, batch, charge.payer_uid, { title: tx('Cobrança da {sigla} cancelada', { sigla: fed.acronym }), message: note ? tx('Motivo: {motivo}.', { motivo: note }) : tx('A federação cancelou a cobrança.'), link: '/perfil?secao=federacoes' });
    await batch.commit();
    await auditoria(ctx, actor, 'federation_charge_cancel', { federation_id: fed.id, charge_id: charge.id, user_id: charge.payer_uid, note });
    return { ok: true };
  }

  if (!memberRef) falha('failed-precondition', 'Esta cobrança não está ligada a uma filiação.');
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
    const st = m.membershipState(mem, hoje, ctx.now);
    const link = '/perfil?secao=federacoes';
    // Vence pela DATA: `membershipState` devolve "suspended" para quem tem sanção em vigor,
    // e a filiação vencida ficaria "active" para sempre enquanto a sanção durasse.
    if (st.daysLeft != null && st.daysLeft < 0) {
      batch.update(d.ref, { status: 'expired', expired_at_ms: ctx.now });
      O.espelhar(ctx, batch, mem, d.id, 'expired', { reason: 'Filiação vencida.' });
      // eslint-disable-next-line no-await-in-loop
      aviso(ctx, batch, destinatario(mem), { title: tx('Sua filiação na {sigla} venceu', { sigla: await sigla(mem.federation_id) }), message: tx('Renove para continuar em dia e pontuando. A carteirinha mostra "Vencida" até lá.'), link });
      vencidas += 1; n += 2;
    } else {
      porFed[mem.federation_id] = (porFed[mem.federation_id] || 0) + 1;
      const marcos = m.EXPIRY_NOTICE_DAYS.filter((dias) => st.daysLeft != null && st.daysLeft <= dias && !(mem.expiry_notified || {})[String(dias)]);
      if (marcos.length) {
        // eslint-disable-next-line no-await-in-loop
        const s = await sigla(mem.federation_id);
        const title = st.daysLeft === 0 ? tx('Sua filiação na {sigla} vence hoje', { sigla: s }) : tx('Sua filiação na {sigla} vence em {dias} dias', { sigla: s, dias: st.daysLeft });
        aviso(ctx, batch, destinatario(mem), { title, message: tx('Renove pela Minha área → Federações para não ficar fora do ranking e dos torneios chancelados.'), link });
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
  // Cobrança em ABERTO que venceu: um aviso no vencimento e outro 7 dias depois, a quem paga
  // (`payer_uid`: o responsável, no dependente). "Já paguei" (declared) não é cobrado de novo.
  let lembretes = 0;
  const abertas = await ctx.db.collection(C.charges).where('status', '==', 'open').get();
  for (const d of abertas.docs) {
    const c = d.data();
    if (!c.due_date || !c.payer_uid) continue;
    const atraso = m.daysBetween(c.due_date, hoje);
    const feitos = c.overdue_notified || {};
    const marco = [7, 0].find((x) => atraso >= x && !feitos[String(x)]);
    if (marco == null) continue;
    // eslint-disable-next-line no-await-in-loop
    const s = await sigla(c.federation_id);
    aviso(ctx, batch, c.payer_uid, {
      title: marco === 0 ? tx('Cobrança da {sigla} vence hoje', { sigla: s }) : tx('Cobrança da {sigla} vencida há {dias} dias', { sigla: s, dias: atraso }),
      message: tx('{oque}: pague pelo Pix e toque em "Já paguei". O financeiro da federação confirma.', { oque: c.plan_name || tx('Filiação') }),
      link: '/perfil?secao=federacoes',
    });
    // Os dois marcos de uma vez quando o primeiro já passou (varredura parada): um aviso só.
    batch.update(d.ref, { overdue_notified: { ...feitos, 0: true, ...(marco === 7 ? { 7: true } : {}) } });
    lembretes += 1; n += 2;
    // eslint-disable-next-line no-await-in-loop
    if (n >= 400) await flush();
  }
  await flush();
  const feds = await ctx.db.collection(C.federations).where('status', '==', 'approved').get();
  const contagem = ctx.db.batch();
  feds.docs.forEach((f) => contagem.update(f.ref, { member_count: porFed[f.id] || 0 }));
  if (feds.size) await contagem.commit();
  if (ctx.logger) ctx.logger.info('Federações: varredura diária.', { vencidas, avisos, lembretes, federacoes: feds.size });
  return { vencidas, avisos, lembretes };
}

/* ------------------------------------------------------------- verify -- */

/** Verificação pública pelo código: carteirinha ou credencial de curso — só o mínimo (D11, LGPD). */
async function verify(ctx, data) {
  if (!(await flagLigada(ctx))) return { found: false };
  const code = m.normalizeCardCode(data && data.code);
  if (!code) return { found: false };
  const idx = await ctx.db.collection(C.cardIndex).doc(code).get();
  if (!idx.exists) return { found: false };
  const i = idx.data();
  const fs = await ctx.db.collection(C.federations).doc(i.federation_id).get();
  if (!fs.exists || fs.data().status !== 'approved') return { found: false };
  const hoje = m.isoDateBR(ctx.now);
  if (i.kind === 'insurance_certificate') return require('./federationInsurance.js').verifyCertificate(ctx, i, fs.data(), hoje);
  if (i.kind === 'credential') {
    const cs = await ctx.db.collection(C.credentials).doc(i.credential_id).get();
    return cs.exists ? m.publicCredentialVerification(cs.data(), fs.data(), hoje) : { found: false };
  }
  const ms = await ctx.db.collection(C.members).doc(i.member_id).get();
  if (!ms.exists) return { found: false };
  return m.publicVerification(ms.data(), fs.data(), hoje, ctx.now);
}

module.exports = {
  FederationError, PERMS, REVIEW, LIVE, C, MINOR_AGE, review, membership, chargeConfirm, fecharCobranca, sweep, verify, idadeDe,
  // Compartilhado com os módulos do PR 3 (`federationTransfers.js`, `federationCourses.js`, `federationDiscipline.js`, `federationSecretariat.js`).
  falha, texto, aviso, auditoria, flagLigada, staffPerms, exigePerm, federacao, publicada, staffIds, plano, novoCodigo, novoId, novaCobranca, destinatario, encerrarFiliacao, ativar, idadeDoMembro, exigeSemOutraFederacao,
};
