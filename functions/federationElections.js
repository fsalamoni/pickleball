/**
 * ELEIÇÕES da federação (módulo `elections`) — o SERVIDOR é o único que
 * escreve. Ações (`federationElections`, campo `action`):
 *
 *  - `preview`  (admin ou comissão): quem votaria hoje e o peso de cada grupo.
 *  - `create` / `update` / `commission` / `publish` / `cancel` (admin).
 *  - `candidacy_info` / `candidacy_submit` / `candidacy_withdraw` / `endorse`
 *    / `challenge` / `defend` (filiados, cada um na sua janela).
 *  - `judge` / `open_voting` / `close_voting` / `count` / `record_presential`
 *    / `publish_result` (a COMISSÃO; com a comissão vazia, o admin, com aviso).
 *  - `vote` (o eleitor do colégio congelado).
 *  - `apply_governance` (admin): os eleitos viram a governança da federação.
 *
 * SIGILO DO VOTO (o requisito central): a cédula (`federation_ballots`) tem
 * id ALEATÓRIO, leva só a eleição, as escolhas e o peso — nenhum uid, nenhum
 * horário — e nasce na MESMA transação que marca `voted_at_ms` no eleitor.
 * Ninguém lê cédula pelo cliente; a auditoria e o aviso dizem "votou", nunca
 * em quem. A apuração só soma pesos. Limite conhecido: os metadados de
 * criação do documento no Firestore ficam visíveis a quem opera o projeto
 * pelo console — ver docs/50-FEDERACAO.md §20.
 */
const crypto = require('node:crypto');
const E = require('./federationElectionsPolicy.js');
const f = require('./federations.js');
const { publicarAtoDeTexto } = require('./federationAcervo.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto } = f;
const ELECTIONS = 'federation_elections';
const CANDIDACIES = 'federation_candidacies';
const VOTERS = 'federation_election_voters';
const ENDORSEMENTS = 'federation_election_endorsements';
const BALLOTS = 'federation_ballots';
const LOTE = 400;
const LIVE = [E.CANDIDACY_STATUS.SUBMITTED, E.CANDIDACY_STATUS.ACCEPTED, E.CANDIDACY_STATUS.CHALLENGED];
const CHALLENGES_MAX = 20;
const PRESENTIAL_MAX = 5000;

const exigeValido = (r) => { if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0]); return r.value; };
const hojeDe = (ctx) => E.todayBr(ctx.now);
const motivo = (v, min = E.REASON_MIN) => {
  const m = texto(v, 1000);
  if (m.length < min) falha('invalid-argument', `Explique o motivo (mínimo ${min} caracteres).`);
  return m;
};
const historico = (e, actor, ctx, action, reason = '') => [...(Array.isArray(e.history) ? e.history : []), { action, at_ms: ctx.now, by: actor.uid, by_name: texto(actor.name, 80), reason }].slice(-E.HISTORY_MAX);
const sorteio = (bytes) => crypto.randomBytes(bytes).toString('hex');

async function contexto(ctx, actor, data) {
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, data.federationId);
  if (fed.status !== 'approved') falha('failed-precondition', 'A federação ainda não foi aprovada pela plataforma.');
  if (!(fed.modules && fed.modules.elections === true)) falha('failed-precondition', 'Esta federação não tem as eleições ligadas.');
  const perms = await f.staffPerms(ctx, fed.id, actor);
  return { fed, perms, admin: perms.includes('admin') };
}

async function eleicao(ctx, fed, id) {
  const ref = ctx.db.collection(ELECTIONS).doc(texto(id, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== fed.id) falha('not-found', 'Eleição não encontrada.');
  return { ref, e: { id: snap.id, ...snap.data() } };
}

async function candidatura(ctx, e, id) {
  const ref = ctx.db.collection(CANDIDACIES).doc(texto(id, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().election_id !== e.id) falha('not-found', 'Chapa não encontrada.');
  return { ref, c: { id: snap.id, ...snap.data() } };
}

const candidaturasDa = async (ctx, e) => (await ctx.db.collection(CANDIDACIES).where('election_id', '==', e.id).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

/** Conduz: a comissão; com a comissão vazia, o admin da federação. */
function exigeConduzir(e, actor, admin) {
  const uids = Array.isArray(e.commission_uids) ? e.commission_uids : [];
  if (uids.includes(actor.uid) || (uids.length === 0 && admin)) return;
  falha('permission-denied', 'Só a comissão eleitoral conduz esta eleição.');
}
const exigeAdmin = (admin) => { if (!admin) falha('permission-denied', 'Só o admin da federação faz isso.'); };

/** A filiação de pessoa (com conta) desta federação. */
async function filiacao(ctx, fed, uid) {
  const snap = await ctx.db.collection(f.C.members).where('federation_id', '==', fed.id).where('user_id', '==', uid).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).find((m) => m.status === 'active') || null;
}
async function exigeElegivel(ctx, fed, e, uid) {
  const m = await filiacao(ctx, fed, uid);
  if (!E.memberEligible(m, { hoje: hojeDe(ctx), nowMs: ctx.now, minMonths: e.college && e.college.min_months })) falha('permission-denied', 'Só filiados em dia, no prazo do edital e sem suspensão.');
  return m;
}

/** O colégio de HOJE (prévia e congelamento na abertura). */
async function colegio(ctx, fed, e) {
  const [members, affiliations] = await Promise.all([
    ctx.db.collection(f.C.members).where('federation_id', '==', fed.id).where('status', '==', 'active').get(),
    ctx.db.collection('federation_affiliations').where('federation_id', '==', fed.id).where('status', '==', 'approved').get(),
  ]);
  const roll = E.buildVoterRoll({ members: members.docs.map((d) => d.data()), affiliations: affiliations.docs.map((d) => d.data()), election: e, hoje: hojeDe(ctx), nowMs: ctx.now });
  return { roll, balance: E.collegeBalance(roll, (e.college && e.college.weights) || {}) };
}
const resumoBalanco = (b) => ({
  voters: b.voters, total_weight: b.total, athlete_share: Math.round(b.athleteShare * 1000) / 1000, athletes_ok: b.athletesOk, ratio_ok: b.ratioOk, small: b.small,
  by_category: Object.fromEntries(Object.entries(b.byCategory).map(([k, v]) => [k, { voters: v.voters, weight: v.weight, unit: v.unit }])),
});

/** Aviso em lote (mesmo mecanismo das notícias): `uids` sem repetir. */
async function avisar(ctx, uids, msg) {
  const lista = [...new Set(uids.filter(Boolean))];
  for (let i = 0; i < lista.length; i += LOTE) {
    const batch = ctx.db.batch();
    lista.slice(i, i + LOTE).forEach((uid) => f.aviso(ctx, batch, uid, msg));
    await batch.commit();
  }
  return lista.length;
}
async function filiadosAtivos(ctx, fed) {
  const snap = await ctx.db.collection(f.C.members).where('federation_id', '==', fed.id).where('status', '==', 'active').get();
  return snap.docs.map((d) => d.data().user_id || d.data().guardian_uid || d.data().representative_uid);
}
// No app (não na página pública): é lá que a pessoa vota, registra chapa e se defende.
const linkDa = (fed) => `/federacoes/${encodeURIComponent(fed.id)}?aba=eleicoes`;
const params = (fed, e) => ({ sigla: fed.acronym || fed.name, titulo: texto(e.title, 120) });

/* ------------------------------------------------------------- edital -- */

async function preview(ctx, actor, data, { fed, admin }) {
  let e = data.election ? { ...exigeValido(E.validateElection(data.election)), id: '' } : null;
  if (!e) {
    e = (await eleicao(ctx, fed, data.electionId)).e;
    exigeConduzir(e, actor, admin);
  } else exigeAdmin(admin);
  const { balance } = await colegio(ctx, fed, e);
  return { ok: true, balance: resumoBalanco(balance), endorsements_needed: E.endorsementsNeeded(e.endorsement_pct, balance.voters) };
}

async function create(ctx, actor, data, { fed, admin }) {
  exigeAdmin(admin);
  const value = exigeValido(E.validateElection(data.election || {}));
  const ref = ctx.db.collection(ELECTIONS).doc();
  const ts = ctx.Timestamp.fromMillis(ctx.now);
  await ref.set({
    federation_id: fed.id, ...value, commission_uids: value.commission.map((p) => p.uid), status: E.STATUS.DRAFT, public: false,
    created_by: actor.uid, created_by_name: texto(actor.name, 80), created_at: ts, created_at_ms: ctx.now, updated_at_ms: ctx.now,
    history: historico({}, actor, ctx, 'create'),
  });
  await f.auditoria(ctx, actor, 'federation_election_create', { federation_id: fed.id, election_id: ref.id });
  return { ok: true, electionId: ref.id };
}

async function update(ctx, actor, data, { fed, admin }) {
  exigeAdmin(admin);
  const { ref, e } = await eleicao(ctx, fed, data.electionId);
  const entrada = data.election || {};
  if (e.status === E.STATUS.DRAFT) {
    const value = exigeValido(E.validateElection(entrada));
    await ref.update({ ...value, commission_uids: value.commission.map((p) => p.uid), updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'update') });
  } else if (e.status === E.STATUS.PUBLISHED) {
    const reason = motivo(data.reason);
    const value = exigeValido(E.validateElection({ ...e, calendar: entrada.calendar || e.calendar, college: entrada.college || e.college, description: entrada.description ?? e.description, notice_min_days: entrada.notice_min_days ?? e.notice_min_days }));
    if (value.calendar.notice_on !== e.calendar.notice_on) falha('invalid-argument', 'A data do edital publicado não muda.');
    await ref.update({ calendar: value.calendar, college: value.college, description: value.description, notice_min_days: value.notice_min_days, updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'update', reason) });
  } else falha('failed-precondition', 'Com a votação aberta, o edital não muda mais.');
  await f.auditoria(ctx, actor, 'federation_election_update', { federation_id: fed.id, election_id: e.id });
  return { ok: true };
}

async function commission(ctx, actor, data, { fed, admin }) {
  exigeAdmin(admin);
  const { ref, e } = await eleicao(ctx, fed, data.electionId);
  if ([E.STATUS.CLOSED, E.STATUS.CANCELLED].includes(e.status)) falha('failed-precondition', 'Esta eleição já terminou.');
  const errors = {};
  const lista = E.validateCommission(data.commission, errors);
  if (errors.commission) falha('invalid-argument', errors.commission);
  const uids = lista.map((p) => p.uid);
  const candidatos = (await candidaturasDa(ctx, e)).filter((c) => LIVE.includes(c.status)).flatMap((c) => c.member_uids || []);
  if (uids.some((u) => candidatos.includes(u))) falha('failed-precondition', 'Quem concorre não pode estar na comissão eleitoral.');
  await ref.update({ commission: lista, commission_uids: uids, updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'commission') });
  await f.auditoria(ctx, actor, 'federation_election_commission', { federation_id: fed.id, election_id: e.id, size: uids.length });
  return { ok: true, warning: uids.length ? '' : 'Sem comissão, o admin da federação conduz a eleição.' };
}

async function publish(ctx, actor, data, { fed, admin }) {
  exigeAdmin(admin);
  if (!f.publicada(fed)) falha('failed-precondition', 'Publique a página da federação antes de publicar o edital.');
  const { ref, e } = await eleicao(ctx, fed, data.electionId);
  if (e.status !== E.STATUS.DRAFT) falha('failed-precondition', 'Este edital já foi publicado.');
  const value = exigeValido(E.validateElection({ ...e, calendar: { ...e.calendar, notice_on: hojeDe(ctx) } }));
  const { balance } = await colegio(ctx, fed, { ...e, ...value });
  if (!balance.voters) falha('failed-precondition', 'Ninguém votaria hoje: não há filiados em dia no prazo do edital.');
  if (!balance.athletesOk) falha('failed-precondition', 'Os atletas precisam somar ao menos 1/3 do peso total dos votos. Ajuste os pesos.');
  const notice_text = E.noticeText(fed, value);
  let ato = null;
  if (fed.modules && fed.modules.official_docs === true) {
    ato = await publicarAtoDeTexto(ctx, actor, fed, { type: 'convocation', title: `Edital: ${value.title}`.slice(0, 120), summary: 'Convocação das eleições', body: notice_text, act_date: hojeDe(ctx), visibility: 'public', tags: ['eleições'], origin: 'elections' });
  }
  await ref.update({
    ...value, commission_uids: value.commission.map((p) => p.uid), status: E.STATUS.PUBLISHED, public: true, notice_text,
    notice_doc_id: ato ? ato.docId : null, notice_code: ato ? ato.code : '', endorsements_needed: E.endorsementsNeeded(value.endorsement_pct, balance.voters),
    college_preview: resumoBalanco(balance), published_at_ms: ctx.now, published_by: actor.uid, updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'publish'),
  });
  const avisados = await avisar(ctx, await filiadosAtivos(ctx, fed), { title: tx('{sigla}: edital de eleição publicado', params(fed, e)), message: tx('{titulo}: veja o calendário e como registrar chapa.', params(fed, e)), link: linkDa(fed) });
  await f.auditoria(ctx, actor, 'federation_election_publish', { federation_id: fed.id, election_id: e.id, notice_doc_id: ato ? ato.docId : null, notified: avisados });
  return { ok: true, notified: avisados, noticeCode: ato ? ato.code : '' };
}

async function cancel(ctx, actor, data, { fed, admin }) {
  exigeAdmin(admin);
  const { ref, e } = await eleicao(ctx, fed, data.electionId);
  if ([E.STATUS.CLOSED, E.STATUS.CANCELLED].includes(e.status)) falha('failed-precondition', 'Esta eleição já terminou.');
  const reason = motivo(data.reason);
  await ref.update({ status: E.STATUS.CANCELLED, cancel_reason: reason, cancelled_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'cancel', reason) });
  const avisados = e.public ? await avisar(ctx, await filiadosAtivos(ctx, fed), { title: tx('{sigla}: eleição cancelada', params(fed, e)), message: texto(reason, 300), link: linkDa(fed) }) : 0;
  await f.auditoria(ctx, actor, 'federation_election_cancel', { federation_id: fed.id, election_id: e.id, notified: avisados });
  return { ok: true };
}

/* ------------------------------------------------------------- chapas -- */

const posicao = (e, pid) => (e.positions || []).find((p) => p.id === pid) || null;

async function candidacyInfo(ctx, actor, data, { fed }) {
  const { e } = await eleicao(ctx, fed, data.electionId);
  if (!e.public) falha('not-found', 'Eleição não encontrada.');
  const { c } = await candidatura(ctx, e, data.candidacyId);
  const p = posicao(e, c.position_id);
  return {
    ok: true,
    candidacy: { id: c.id, name: c.name, status: c.status, position: p ? p.label : '', members: (c.members || []).map((m) => ({ name: m.name, role: m.role })), endorsement_count: c.endorsement_count || 0, endorsements_needed: e.endorsements_needed || 0 },
    canEndorse: c.status === E.CANDIDACY_STATUS.SUBMITTED && E.windowOpen(e, 'endorse', hojeDe(ctx)),
  };
}

async function candidacySubmit(ctx, actor, data, { fed }) {
  const { e } = await eleicao(ctx, fed, data.electionId);
  if (!E.windowOpen(e, 'candidacy', hojeDe(ctx))) falha('failed-precondition', 'O registro de chapas não está aberto.');
  const value = exigeValido(E.validateCandidacy(data.candidacy || {}, posicao(e, (data.candidacy || {}).position_id)));
  const uids = value.members.map((m) => m.uid);
  if (!uids.includes(actor.uid)) falha('permission-denied', 'Quem registra a chapa faz parte dela.');
  if (uids.some((u) => (e.commission_uids || []).includes(u))) falha('failed-precondition', 'Membro da comissão eleitoral não concorre.');
  for (const m of value.members) {
    if (!(await filiacao(ctx, fed, m.uid))) falha('failed-precondition', `${m.name} não tem filiação ativa nesta federação.`);
  }
  const vivas = (await candidaturasDa(ctx, e)).filter((c) => LIVE.includes(c.status));
  const repetido = value.members.find((m) => vivas.some((c) => (c.member_uids || []).includes(m.uid)));
  if (repetido) falha('failed-precondition', `${repetido.name} já está em outra chapa desta eleição.`);
  const pres = (await ctx.db.collection(f.C.staff).where('federation_id', '==', fed.id).where('role', '==', 'president').get()).docs.map((d) => d.data())[0];
  const alerts = E.candidacyAlerts(value, posicao(e, value.position_id), { presidentUid: pres ? pres.user_id : null, presidentTerms: 1 });
  const ref = ctx.db.collection(CANDIDACIES).doc();
  await ref.set({
    election_id: e.id, federation_id: fed.id, ...value, member_uids: uids, status: E.CANDIDACY_STATUS.SUBMITTED, public: false,
    endorsement_count: 0, challenges: [], alerts, submitted_by: actor.uid, submitted_by_name: texto(actor.name, 80), submitted_at_ms: ctx.now, updated_at_ms: ctx.now,
  });
  await f.auditoria(ctx, actor, 'federation_candidacy_submit', { federation_id: fed.id, election_id: e.id, candidacy_id: ref.id });
  return { ok: true, candidacyId: ref.id, endorsementsNeeded: e.endorsements_needed || 0 };
}

async function candidacyWithdraw(ctx, actor, data, { fed }) {
  const { e } = await eleicao(ctx, fed, data.electionId);
  const { ref, c } = await candidatura(ctx, e, data.candidacyId);
  if (!((c.member_uids || []).includes(actor.uid) || c.submitted_by === actor.uid)) falha('permission-denied', 'Só quem está na chapa a retira.');
  if (!LIVE.includes(c.status) || !E.windowOpen(e, 'withdraw', hojeDe(ctx))) falha('failed-precondition', 'A chapa só sai antes de a votação abrir.');
  await ref.update({ status: E.CANDIDACY_STATUS.WITHDRAWN, withdrawn_at_ms: ctx.now, updated_at_ms: ctx.now });
  await f.auditoria(ctx, actor, 'federation_candidacy_withdraw', { federation_id: fed.id, election_id: e.id, candidacy_id: c.id });
  return { ok: true };
}

async function endorse(ctx, actor, data, { fed }) {
  const { e } = await eleicao(ctx, fed, data.electionId);
  if (!E.windowOpen(e, 'endorse', hojeDe(ctx))) falha('failed-precondition', 'O apoio a chapas só vale no prazo de registro.');
  const { ref, c } = await candidatura(ctx, e, data.candidacyId);
  if (c.status !== E.CANDIDACY_STATUS.SUBMITTED) falha('failed-precondition', 'Esta chapa não recebe mais apoio.');
  if ((c.member_uids || []).includes(actor.uid)) falha('failed-precondition', 'Quem está na chapa não a apoia.');
  await exigeElegivel(ctx, fed, e, actor.uid);
  const apoioRef = ctx.db.collection(ENDORSEMENTS).doc(`${e.id}_${c.position_id}_${actor.uid}`);
  const count = await ctx.db.runTransaction(async (tr) => {
    const [apoio, cSnap] = await Promise.all([tr.get(apoioRef), tr.get(ref)]);
    if (apoio.exists) falha('already-exists', 'Você já apoiou uma chapa para este cargo.');
    const n = (Number(cSnap.data().endorsement_count) || 0) + 1;
    tr.set(apoioRef, { election_id: e.id, federation_id: fed.id, position_id: c.position_id, candidacy_id: c.id, candidacy_name: c.name, user_id: actor.uid, at_ms: ctx.now });
    tr.update(ref, { endorsement_count: n, updated_at_ms: ctx.now });
    return n;
  });
  await f.auditoria(ctx, actor, 'federation_candidacy_endorse', { federation_id: fed.id, election_id: e.id, candidacy_id: c.id });
  return { ok: true, count, needed: e.endorsements_needed || 0 };
}

async function challenge(ctx, actor, data, { fed }) {
  const { e } = await eleicao(ctx, fed, data.electionId);
  if (!E.windowOpen(e, 'challenge', hojeDe(ctx))) falha('failed-precondition', 'O prazo de impugnação está fechado.');
  const { ref, c } = await candidatura(ctx, e, data.candidacyId);
  if (![E.CANDIDACY_STATUS.ACCEPTED, E.CANDIDACY_STATUS.CHALLENGED].includes(c.status)) falha('failed-precondition', 'Só se impugna chapa com registro aceito.');
  const reason = motivo(data.reason, E.CHALLENGE_MIN);
  const m = await exigeElegivel(ctx, fed, e, actor.uid);
  const lista = Array.isArray(c.challenges) ? c.challenges : [];
  if (lista.length >= CHALLENGES_MAX) falha('resource-exhausted', 'Esta chapa já tem impugnações demais.');
  if (lista.some((x) => x.by_uid === actor.uid && !x.decision)) falha('already-exists', 'Você já tem uma impugnação aberta contra esta chapa.');
  const item = { id: `i${lista.length + 1}`, by_uid: actor.uid, by_name: texto(m.user_name || actor.name, 80), reason, at_ms: ctx.now, defense: '', defense_at_ms: null, decision: null };
  await ref.update({ challenges: [...lista, item], status: E.CANDIDACY_STATUS.CHALLENGED, updated_at_ms: ctx.now });
  await avisar(ctx, c.member_uids || [], { title: tx('{sigla}: sua chapa foi impugnada', params(fed, e)), message: tx('Apresente a defesa até {data}.', { data: e.calendar.defense_to.split('-').reverse().join('/') }), link: linkDa(fed) });
  await f.auditoria(ctx, actor, 'federation_candidacy_challenge', { federation_id: fed.id, election_id: e.id, candidacy_id: c.id, challenge_id: item.id });
  return { ok: true, challengeId: item.id };
}

async function defend(ctx, actor, data, { fed }) {
  const { e } = await eleicao(ctx, fed, data.electionId);
  const { ref, c } = await candidatura(ctx, e, data.candidacyId);
  if (!(c.member_uids || []).includes(actor.uid)) falha('permission-denied', 'Só quem está na chapa apresenta a defesa.');
  if (!E.windowOpen(e, 'defense', hojeDe(ctx))) falha('failed-precondition', 'O prazo de defesa terminou.');
  const lista = Array.isArray(c.challenges) ? c.challenges : [];
  const alvo = lista.find((x) => x.id === data.challengeId);
  if (!alvo || alvo.decision || alvo.defense) falha('failed-precondition', 'Esta impugnação não aceita defesa.');
  const defense = motivo(data.defense);
  await ref.update({ challenges: lista.map((x) => (x.id === alvo.id ? { ...x, defense, defense_at_ms: ctx.now, defense_by: actor.uid } : x)), updated_at_ms: ctx.now });
  await f.auditoria(ctx, actor, 'federation_candidacy_defend', { federation_id: fed.id, election_id: e.id, candidacy_id: c.id, challenge_id: alvo.id });
  return { ok: true };
}

async function judge(ctx, actor, data, { fed, admin }) {
  const { e } = await eleicao(ctx, fed, data.electionId);
  exigeConduzir(e, actor, admin);
  if (e.status !== E.STATUS.PUBLISHED) falha('failed-precondition', 'O julgamento das chapas acontece antes da votação.');
  const { ref, c } = await candidatura(ctx, e, data.candidacyId);
  const decisao = { by: actor.uid, by_name: texto(actor.name, 80), at_ms: ctx.now };
  let patch;
  let resultado;
  if (data.challengeId) {
    const lista = Array.isArray(c.challenges) ? c.challenges : [];
    const alvo = lista.find((x) => x.id === data.challengeId);
    if (!alvo || !E.challengeReady(alvo, e, hojeDe(ctx))) falha('failed-precondition', 'Julgue depois da defesa da chapa (ou do fim do prazo de defesa).');
    const upheld = data.upheld === true;
    const reason = motivo(data.reason);
    const novas = lista.map((x) => (x.id === alvo.id ? { ...x, decision: { ...decisao, upheld, reason } } : x));
    const abertas = novas.some((x) => !x.decision);
    resultado = upheld ? E.CANDIDACY_STATUS.REJECTED : (abertas ? E.CANDIDACY_STATUS.CHALLENGED : E.CANDIDACY_STATUS.ACCEPTED);
    patch = { challenges: novas, status: resultado };
  } else {
    if (c.status !== E.CANDIDACY_STATUS.SUBMITTED) falha('failed-precondition', 'Esta chapa já foi analisada.');
    const accept = data.decision === 'accept';
    if (accept && (Number(c.endorsement_count) || 0) < (Number(e.endorsements_needed) || 0)) falha('failed-precondition', `A chapa ainda não tem os ${e.endorsements_needed} apoios exigidos.`);
    const reason = accept ? texto(data.reason, 1000) : motivo(data.reason);
    resultado = accept ? E.CANDIDACY_STATUS.ACCEPTED : E.CANDIDACY_STATUS.REJECTED;
    patch = { status: resultado, review: { ...decisao, reason }, ...(accept ? { public: true } : {}) };
  }
  await ref.update({ ...patch, updated_at_ms: ctx.now });
  await avisar(ctx, c.member_uids || [], { title: tx('{sigla}: decisão sobre a sua chapa', params(fed, e)), message: resultado === E.CANDIDACY_STATUS.REJECTED ? tx('A comissão indeferiu a chapa.') : tx('A chapa segue na eleição.'), link: linkDa(fed) });
  await f.auditoria(ctx, actor, 'federation_candidacy_judge', { federation_id: fed.id, election_id: e.id, candidacy_id: c.id, challenge_id: data.challengeId || null, result: resultado });
  return { ok: true, status: resultado };
}

/* ------------------------------------------------------------ votação -- */

async function openVoting(ctx, actor, data, { fed, admin }) {
  const { ref, e } = await eleicao(ctx, fed, data.electionId);
  exigeConduzir(e, actor, admin);
  if (e.status !== E.STATUS.PUBLISHED) falha('failed-precondition', 'A votação só abre com o edital publicado.');
  if (ctx.now < E.votingOpensMs(e)) falha('failed-precondition', 'Ainda não chegou a hora de abrir a votação.');
  if ((await candidaturasDa(ctx, e)).some((c) => [E.CANDIDACY_STATUS.SUBMITTED, E.CANDIDACY_STATUS.CHALLENGED].includes(c.status))) falha('failed-precondition', 'Ainda há chapas em análise ou impugnações sem julgamento.');
  const { roll, balance } = await colegio(ctx, fed, e);
  if (!balance.voters) falha('failed-precondition', 'O colégio eleitoral está vazio.');
  if (!balance.athletesOk) falha('failed-precondition', 'Os atletas somam menos de 1/3 do peso total: a votação não pode abrir assim.');
  for (let i = 0; i < roll.length; i += LOTE) {
    const batch = ctx.db.batch();
    roll.slice(i, i + LOTE).forEach((v) => batch.set(ctx.db.collection(VOTERS).doc(v.id), {
      election_id: e.id, federation_id: fed.id, user_id: v.user_id, name: v.name, category: v.category, weight: v.weight, kind: v.kind, org_id: v.org_id,
      voted_at_ms: null, receipt: null, channel: null,
    }));
    await batch.commit();
  }
  await ref.update({ status: E.STATUS.VOTING, college_frozen: resumoBalanco(balance), voted_count: 0, voted_weight: 0, voting_opened_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'open_voting') });
  const avisados = e.mode === 'presential' ? 0 : await avisar(ctx, roll.map((v) => v.user_id), { title: tx('{sigla}: a votação está aberta', params(fed, e)), message: tx('{titulo}: seu voto é secreto. Vote até o fim do prazo.', params(fed, e)), link: linkDa(fed) });
  await f.auditoria(ctx, actor, 'federation_election_open_voting', { federation_id: fed.id, election_id: e.id, voters: roll.length, notified: avisados });
  return { ok: true, voters: roll.length, notified: avisados };
}

async function vote(ctx, actor, data, { fed }) {
  const { ref, e } = await eleicao(ctx, fed, data.electionId);
  if (e.status !== E.STATUS.VOTING || e.mode === 'presential') falha('failed-precondition', 'A votação pelo aplicativo não está aberta.');
  if (ctx.now >= E.votingClosesMs(e)) falha('failed-precondition', 'O horário de votação terminou.');
  const aceitas = {};
  (await candidaturasDa(ctx, e)).filter((c) => c.status === E.CANDIDACY_STATUS.ACCEPTED).forEach((c) => { (aceitas[c.position_id] = aceitas[c.position_id] || []).push(c.id); });
  const choices = exigeValido(E.validateBallot(data.choices, e.positions, aceitas));
  const voterRef = ctx.db.collection(VOTERS).doc(texto(data.voterId || `${e.id}_${actor.uid}`, 200));
  const ballotRef = ctx.db.collection(BALLOTS).doc(sorteio(16));
  const receipt = sorteio(6).toUpperCase().match(/.{4}/g).join('-');
  await ctx.db.runTransaction(async (tr) => {
    const [vSnap, eSnap] = await Promise.all([tr.get(voterRef), tr.get(ref)]);
    const v = vSnap.exists ? vSnap.data() : null;
    if (!v || v.election_id !== e.id || v.user_id !== actor.uid) falha('permission-denied', 'Você não está no colégio eleitoral desta eleição.');
    if (v.voted_at_ms) falha('already-exists', 'Este voto já foi registrado.');
    const atual = eSnap.data();
    if (atual.status !== E.STATUS.VOTING) falha('failed-precondition', 'A votação não está aberta.');
    tr.set(ballotRef, { election_id: e.id, choices, weight: Number(v.weight) || 0 });
    tr.update(voterRef, { voted_at_ms: ctx.now, receipt, channel: 'online' });
    tr.update(ref, { voted_count: (Number(atual.voted_count) || 0) + 1, voted_weight: (Number(atual.voted_weight) || 0) + (Number(v.weight) || 0) });
  });
  await f.auditoria(ctx, actor, 'federation_election_vote', { federation_id: fed.id, election_id: e.id });
  return { ok: true, receipt };
}

async function closeVoting(ctx, actor, data, { fed, admin }) {
  const { ref, e } = await eleicao(ctx, fed, data.electionId);
  exigeConduzir(e, actor, admin);
  if (e.status !== E.STATUS.VOTING) falha('failed-precondition', 'A votação não está aberta.');
  if (ctx.now < E.votingClosesMs(e)) falha('failed-precondition', 'O horário de votação do edital ainda não terminou.');
  await ref.update({ status: E.STATUS.COUNTING, voting_closed_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'close_voting') });
  await f.auditoria(ctx, actor, 'federation_election_close_voting', { federation_id: fed.id, election_id: e.id });
  return { ok: true };
}

async function recordPresential(ctx, actor, data, { fed, admin }) {
  const { ref, e } = await eleicao(ctx, fed, data.electionId);
  exigeConduzir(e, actor, admin);
  if (e.status !== E.STATUS.COUNTING || e.mode === 'online') falha('failed-precondition', 'O lançamento presencial é depois de encerrar a votação, em eleição presencial ou mista.');
  if (e.presential) falha('failed-precondition', 'A votação presencial já foi lançada.');
  const ids = [...new Set((Array.isArray(data.voterIds) ? data.voterIds : []).map((x) => texto(x, 200)))];
  if (ids.length > PRESENTIAL_MAX) falha('invalid-argument', 'Eleitores demais num lançamento.');
  const refs = ids.map((id) => ctx.db.collection(VOTERS).doc(id));
  const snaps = await Promise.all(refs.map((r) => r.get()));
  let peso = 0;
  snaps.forEach((s, i) => {
    const v = s.exists ? s.data() : null;
    if (!v || v.election_id !== e.id) falha('invalid-argument', 'Há eleitor fora do colégio desta eleição.');
    if (v.voted_at_ms) falha('failed-precondition', `${v.name || ids[i]} já votou pelo aplicativo.`);
    peso += Number(v.weight) || 0;
  });
  const aceitas = (await candidaturasDa(ctx, e)).filter((c) => c.status === E.CANDIDACY_STATUS.ACCEPTED);
  const entrada = data.totals && typeof data.totals === 'object' ? data.totals : {};
  const totals = {};
  for (const p of e.positions) {
    const validas = new Set([...E.SPECIAL_CHOICES, ...aceitas.filter((c) => c.position_id === p.id).map((c) => c.id)]);
    const porOpcao = {};
    let soma = 0;
    Object.entries(entrada[p.id] || {}).forEach(([op, w]) => {
      const n = Number(w);
      if (!validas.has(op) || !Number.isInteger(n) || n < 0) falha('invalid-argument', `Total inválido em ${p.label}.`);
      if (n > 0) { porOpcao[op] = n; soma += n; }
    });
    if (soma !== peso) falha('invalid-argument', `Em ${p.label} os totais somam ${soma}, e o peso de quem votou na mesa é ${peso}.`);
    totals[p.id] = porOpcao;
  }
  for (let i = 0; i < refs.length; i += LOTE) {
    const batch = ctx.db.batch();
    refs.slice(i, i + LOTE).forEach((r) => batch.update(r, { voted_at_ms: ctx.now, channel: 'presential' }));
    await batch.commit();
  }
  await ref.update({
    presential: { voters: ids.length, weight: peso, totals, recorded_at_ms: ctx.now, recorded_by: actor.uid },
    voted_count: (Number(e.voted_count) || 0) + ids.length, voted_weight: (Number(e.voted_weight) || 0) + peso, updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'record_presential'),
  });
  await f.auditoria(ctx, actor, 'federation_election_presential', { federation_id: fed.id, election_id: e.id, voters: ids.length });
  return { ok: true, voters: ids.length, weight: peso };
}

/** A apuração: soma as cédulas e a mesa; empate pela regra do edital. */
async function apurar(ctx, e) {
  const [ballots, cands] = await Promise.all([ctx.db.collection(BALLOTS).where('election_id', '==', e.id).get(), candidaturasDa(ctx, e)]);
  const tallied = E.tally(ballots.docs.map((d) => d.data()), e.presential || null, e.positions);
  const births = {};
  if (e.tie_rule === 'oldest') {
    await Promise.all(cands.filter((c) => c.status === E.CANDIDACY_STATUS.ACCEPTED).map(async (c) => {
      const uid = c.members && c.members[0] && c.members[0].uid;
      const u = uid ? await ctx.db.collection('users').doc(uid).get() : null;
      if (u && u.exists && u.data().birth_date) births[c.id] = String(u.data().birth_date).slice(0, 10);
    }));
  }
  return { results: E.decideWinners(tallied, e.positions, cands, { tieRule: e.tie_rule, births }), cands };
}

async function count(ctx, actor, data, { fed, admin }) {
  const { e } = await eleicao(ctx, fed, data.electionId);
  exigeConduzir(e, actor, admin);
  if (e.status !== E.STATUS.COUNTING) falha('failed-precondition', 'A apuração começa depois de encerrar a votação.');
  const { results } = await apurar(ctx, e);
  await f.auditoria(ctx, actor, 'federation_election_count', { federation_id: fed.id, election_id: e.id });
  return { ok: true, results, pendingPresential: e.mode !== 'online' && !e.presential };
}

async function aplicarGovernanca(ctx, fed, e, results, cands, mandateEnd) {
  const g = E.governanceFromResults(results, e.positions, cands);
  if (g.error) falha('failed-precondition', g.error);
  const start = e.calendar.inauguration_on || e.calendar.result_on;
  const end = /^\d{4}-\d{2}-\d{2}$/.test(String(mandateEnd || '')) && mandateEnd > start ? mandateEnd : '';
  const gov = fed.governance || {};
  await ctx.db.collection(f.C.federations).doc(fed.id).update({ governance: { ...gov, board: g.board, women_count: g.women_count, mandate: { start, end } } });
  return g.board.length;
}

async function publishResult(ctx, actor, data, { fed, admin }) {
  const { ref, e } = await eleicao(ctx, fed, data.electionId);
  exigeConduzir(e, actor, admin);
  if (e.status !== E.STATUS.COUNTING) falha('failed-precondition', 'O resultado sai depois de encerrar a votação.');
  if (e.mode !== 'online' && !e.presential) falha('failed-precondition', 'Lance a votação presencial antes de publicar o resultado.');
  if (data.applyGovernance && !admin) falha('permission-denied', 'Só o admin da federação atualiza a governança.');
  const { results, cands } = await apurar(ctx, e);
  const totals = { voters: (e.college_frozen && e.college_frozen.voters) || 0, total_weight: (e.college_frozen && e.college_frozen.total_weight) || 0, voted: Number(e.voted_count) || 0, voted_weight: Number(e.voted_weight) || 0 };
  const minutes_text = E.minutesText(fed, e, results, totals);
  let ato = null;
  if (fed.modules && fed.modules.official_docs === true) {
    ato = await publicarAtoDeTexto(ctx, actor, fed, { type: 'minutes', title: `Ata da apuração: ${e.title}`.slice(0, 120), summary: 'Resultado das eleições', body: minutes_text, act_date: hojeDe(ctx), visibility: 'public', tags: ['eleições'], origin: 'elections' });
  }
  const aplicados = data.applyGovernance ? await aplicarGovernanca(ctx, fed, e, results, cands, data.mandateEnd) : 0;
  await ref.update({
    status: E.STATUS.CLOSED, results, totals, minutes_text, minutes_doc_id: ato ? ato.docId : null, minutes_code: ato ? ato.code : '',
    governance_applied: aplicados > 0, results_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'publish_result'),
  });
  const avisados = await avisar(ctx, await filiadosAtivos(ctx, fed), { title: tx('{sigla}: resultado da eleição', params(fed, e)), message: tx('{titulo}: veja quem foi eleito.', params(fed, e)), link: linkDa(fed) });
  await f.auditoria(ctx, actor, 'federation_election_result', { federation_id: fed.id, election_id: e.id, minutes_doc_id: ato ? ato.docId : null, governance: aplicados, notified: avisados });
  return { ok: true, results, notified: avisados, governance: aplicados };
}

async function applyGovernance(ctx, actor, data, { fed, admin }) {
  exigeAdmin(admin);
  const { ref, e } = await eleicao(ctx, fed, data.electionId);
  if (e.status !== E.STATUS.CLOSED) falha('failed-precondition', 'A governança só recebe eleitos de resultado publicado.');
  const cands = await candidaturasDa(ctx, e);
  const n = await aplicarGovernanca(ctx, fed, e, e.results || [], cands, data.mandateEnd);
  await ref.update({ governance_applied: true, updated_at_ms: ctx.now });
  await f.auditoria(ctx, actor, 'federation_election_governance', { federation_id: fed.id, election_id: e.id, board: n });
  return { ok: true, board: n };
}

const ACOES = {
  preview, create, update, commission, publish, cancel,
  candidacy_info: candidacyInfo, candidacy_submit: candidacySubmit, candidacy_withdraw: candidacyWithdraw, endorse, challenge, defend, judge,
  open_voting: openVoting, vote, close_voting: closeVoting, count, record_presential: recordPresential, publish_result: publishResult, apply_governance: applyGovernance,
};

async function elections(ctx, actor, data = {}) {
  const fn = ACOES[data.action];
  if (!fn) falha('invalid-argument', 'Ação desconhecida.');
  const c = await contexto(ctx, actor, data);
  return fn(ctx, actor, data, c);
}

module.exports = { elections, ELECTIONS, CANDIDACIES, VOTERS, ENDORSEMENTS, BALLOTS };
