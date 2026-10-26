/**
 * ELEIÇÕES DO CLUBE-ASSOCIAÇÃO (Bloco F2, flag `club_association`) — o SERVIDOR é o
 * único que escreve. É a eleição da federação (`federationElections.js`) com o colégio do
 * clube: "um associado, um voto" (`clubElectionsPolicy.js`; a régua do edital, da chapa,
 * da cédula, da apuração e do empate é a MESMA, `federationElectionsPolicy.js`).
 *
 * Dados: `club_x/{clube}/{elections, candidacies, voters, endorsements}` (todos
 * `write: if false`; a leitura direta é só da administração — quem lê de verdade é a
 * ação `overview`, que entrega a cada pessoa só o que ela pode ver) e a CÉDULA em
 * `club_ballots` (sem regra: ninguém lê pelo cliente, nem a administração).
 *
 * Ações (`clubElections`, campo `action`):
 *  - `overview`: a leitura de TODOS (eleições, chapas, colégio e o que é meu).
 *  - `preview`, `create`, `update`, `commission`, `publish`, `cancel` (administração).
 *  - `candidacy_info`, `candidacy_submit`, `candidacy_withdraw`, `endorse`, `challenge`,
 *    `defend` (associados, cada um na sua janela).
 *  - `judge`, `open_voting`, `close_voting`, `count`, `record_presential`,
 *    `publish_result` (a COMISSÃO; com a comissão vazia, a administração).
 *  - `vote` (o eleitor do colégio congelado).
 *  - `apply_governance` (administração): a POSSE — os eleitos recebem o cargo (clubStaff).
 *
 * SIGILO DO VOTO: a cédula tem id ALEATÓRIO, leva só a eleição, as escolhas e o peso (1)
 * — nenhum uid, nenhum horário — e nasce na MESMA transação que marca `voted_at_ms` no
 * eleitor. A auditoria e o aviso dizem "votou", nunca em quem. Limite conhecido (o mesmo da
 * federação): os metadados de criação do documento ficam visíveis a quem opera o projeto.
 */
const crypto = require('node:crypto');
const E = require('./federationElectionsPolicy.js');
const P = require('./clubElectionsPolicy.js');
const a = require('./clubAssociation.js');
const m = require('./federationMembership.js');
const { publicarAtoDeTexto } = require('./clubDocs.js');
const { darPosse } = require('./clubStaff.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto, col } = a;
const BALLOTS = 'club_ballots';
const LOTE = 400;
const LIVE = [E.CANDIDACY_STATUS.SUBMITTED, E.CANDIDACY_STATUS.ACCEPTED, E.CANDIDACY_STATUS.CHALLENGED];
const CHALLENGES_MAX = 20;
const PRESENTIAL_MAX = 5000;
const POSSES_MAX = 20;

const exigeValido = (r) => { if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0]); return r.value; };
const hojeDe = (ctx) => E.todayBr(ctx.now);
const motivo = (v, min = E.REASON_MIN) => {
  const t = texto(v, 1000);
  if (t.length < min) falha('invalid-argument', `Explique o motivo (mínimo ${min} caracteres).`);
  return t;
};
const historico = (e, actor, ctx, action, reason = '') => [...(Array.isArray(e.history) ? e.history : []), { action, at_ms: ctx.now, by: actor.uid, by_name: texto(actor.name, 80), reason }].slice(-E.HISTORY_MAX);
const sorteio = (bytes) => crypto.randomBytes(bytes).toString('hex');

async function contexto(ctx, actor, data) {
  await a.exigeFlag(ctx);
  const club = await a.clube(ctx, data.clubId);
  if (!(club.association && club.association.enabled === true)) falha('failed-precondition', 'Este clube ainda não abriu a associação.');
  const perms = await a.permsDe(ctx, club.id, actor.uid);
  return { club, perms, admin: perms.includes('admin') };
}

const C = (ctx, club, kind) => col(ctx, club.id, kind);
const limpa = (d) => Object.fromEntries(Object.entries(d).filter(([, v]) => !(v && typeof v === 'object' && typeof v.toMillis === 'function')));

async function eleicao(ctx, club, id) {
  const ref = C(ctx, club, 'elections').doc(texto(id, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().club_id !== club.id) falha('not-found', 'Eleição não encontrada.');
  return { ref, e: { id: snap.id, ...snap.data() } };
}

async function candidatura(ctx, club, e, id) {
  const ref = C(ctx, club, 'candidacies').doc(texto(id, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().election_id !== e.id) falha('not-found', 'Chapa não encontrada.');
  return { ref, c: { id: snap.id, ...snap.data() } };
}

const candidaturasDa = async (ctx, club, e) => (await C(ctx, club, 'candidacies').where('election_id', '==', e.id).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

/** Conduz: a comissão; com a comissão vazia, a administração do clube. */
function exigeConduzir(e, actor, admin) {
  const uids = Array.isArray(e.commission_uids) ? e.commission_uids : [];
  if (uids.includes(actor.uid) || (uids.length === 0 && admin)) return;
  falha('permission-denied', 'Só a comissão eleitoral conduz esta eleição.');
}
const exigeAdmin = (admin) => { if (!admin) falha('permission-denied', 'Só quem administra o clube faz isso.'); };

/** A filiação ativa e em dia desta pessoa (id da filiação = uid). */
async function filiacao(ctx, club, uid) {
  const snap = await C(ctx, club, 'aff').doc(uid).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}
async function exigeEleitor(ctx, club, e, uid) {
  const aff = await filiacao(ctx, club, uid);
  if (!P.clubVoterEligible(aff, { hoje: hojeDe(ctx), nowMs: ctx.now, minMonths: e.college && e.college.min_months })) falha('permission-denied', 'Só associados em dia, com direito a voto, no prazo do edital e sem suspensão.');
  return aff;
}

async function todasAsFiliacoes(ctx, club) {
  const snap = await C(ctx, club, 'aff').where('status', '==', 'active').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** O colégio de HOJE (prévia e congelamento na abertura). */
async function colegio(ctx, club, e) {
  const roll = P.buildClubRoll({ affs: await todasAsFiliacoes(ctx, club), election: e, hoje: hojeDe(ctx), nowMs: ctx.now });
  return { roll, balance: E.collegeBalance(roll, P.CLUB_WEIGHTS) };
}
const resumoBalanco = (b) => ({ voters: b.voters, total_weight: b.total, small: b.small.length > 0 });

/** Quem comissão: pessoas que ainda são membros do clube. */
async function exigeMembros(ctx, club, uids) {
  const snaps = await Promise.all(uids.map((u) => ctx.db.collection('club_members').doc(`${club.id}_${u}`).get()));
  if (snaps.some((s) => !s.exists)) falha('failed-precondition', 'A comissão eleitoral é de membros do clube.');
}

/** Aviso em lote: `uids` sem repetir. */
async function avisar(ctx, uids, msg) {
  const lista = [...new Set(uids.filter(Boolean))];
  for (let i = 0; i < lista.length; i += LOTE) {
    const batch = ctx.db.batch();
    lista.slice(i, i + LOTE).forEach((uid) => a.aviso(ctx, batch, uid, msg));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
  return lista.length;
}
async function associadosEmDia(ctx, club) {
  const hoje = m.isoDateBR(ctx.now);
  return (await todasAsFiliacoes(ctx, club)).filter((x) => m.membershipState(x, hoje, ctx.now).status === 'active').map((x) => x.user_id);
}
// No app, na página do clube: é lá que a pessoa vota, registra chapa e se defende.
const linkDa = (club) => `/clubes/${encodeURIComponent(club.id)}?tab=eleicoes`;
// As frases são as da federação (`{sigla}`), então a tradução já existe.
const params = (club, e) => ({ sigla: a.sigla(club) || club.name, titulo: texto(e.title, 120) });

/* --------------------------------------------------------------- leitura -- */

/**
 * O que ESTA pessoa pode ver: o membro do clube vê as eleições publicadas e as chapas
 * aceitas; a administração e a comissão veem tudo (rascunho, chapas em análise, colégio);
 * cada um vê as próprias chapas, apoios e a própria linha no colégio. Nenhuma cédula.
 */
async function overview(ctx, actor, data, { club, admin }) {
  const mem = await ctx.db.collection('club_members').doc(`${club.id}_${actor.uid}`).get();
  if (!mem.exists) return { ok: true, member: false, elections: [], candidacies: [], voters: [], mine: { voters: [], candidacies: [], endorsements: [] } };
  const [els, cands, mineVoters, mineEnd] = await Promise.all([
    C(ctx, club, 'elections').get(),
    C(ctx, club, 'candidacies').get(),
    C(ctx, club, 'voters').where('user_id', '==', actor.uid).get(),
    C(ctx, club, 'endorsements').where('user_id', '==', actor.uid).get(),
  ]);
  const todas = els.docs.map((d) => ({ id: d.id, ...limpa(d.data()) }));
  const conduz = (e) => (e.commission_uids || []).includes(actor.uid) || ((e.commission_uids || []).length === 0 && admin);
  const vejo = todas.filter((e) => e.public === true || admin || (e.commission_uids || []).includes(actor.uid));
  const conduzidas = vejo.filter(conduz).map((e) => e.id);
  const candidaturas = cands.docs.map((d) => ({ id: d.id, ...limpa(d.data()) }))
    .filter((c) => vejo.some((e) => e.id === c.election_id) && (c.public === true || conduzidas.includes(c.election_id) || admin || (c.member_uids || []).includes(actor.uid)));
  const colegios = await Promise.all(conduzidas.map((id) => C(ctx, club, 'voters').where('election_id', '==', id).get()));
  const voters = colegios.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...limpa(d.data()) })));
  const mine = {
    voters: mineVoters.docs.map((d) => ({ id: d.id, ...limpa(d.data()) })),
    candidacies: cands.docs.map((d) => ({ id: d.id, ...limpa(d.data()) })).filter((c) => (c.member_uids || []).includes(actor.uid)),
    endorsements: mineEnd.docs.map((d) => ({ id: d.id, ...limpa(d.data()) })),
  };
  return { ok: true, member: true, elections: vejo.sort((x, y) => (y.created_at_ms || 0) - (x.created_at_ms || 0)), candidacies: candidaturas, voters, mine };
}

/* --------------------------------------------------------------- edital -- */

async function preview(ctx, actor, data, { club, admin }) {
  let e = data.election ? { ...exigeValido(P.validateClubElection(data.election)), id: '' } : null;
  if (!e) {
    e = (await eleicao(ctx, club, data.electionId)).e;
    exigeConduzir(e, actor, admin);
  } else exigeAdmin(admin);
  const { balance } = await colegio(ctx, club, e);
  return { ok: true, balance: resumoBalanco(balance), endorsements_needed: E.endorsementsNeeded(e.endorsement_pct, balance.voters) };
}

async function create(ctx, actor, data, { club, admin }) {
  exigeAdmin(admin);
  const value = exigeValido(P.validateClubElection(data.election || {}));
  await exigeMembros(ctx, club, value.commission.map((p) => p.uid));
  const ref = C(ctx, club, 'elections').doc();
  const ts = ctx.Timestamp.fromMillis(ctx.now);
  await ref.set({
    club_id: club.id, ...value, commission_uids: value.commission.map((p) => p.uid), status: E.STATUS.DRAFT, public: false,
    created_by: actor.uid, created_by_name: texto(actor.name, 80), created_at: ts, created_at_ms: ctx.now, updated_at_ms: ctx.now,
    history: historico({}, actor, ctx, 'create'),
  });
  await a.auditoria(ctx, actor, 'club_election_create', { club_id: club.id, election_id: ref.id });
  return { ok: true, electionId: ref.id };
}

async function update(ctx, actor, data, { club, admin }) {
  exigeAdmin(admin);
  const { ref, e } = await eleicao(ctx, club, data.electionId);
  const entrada = data.election || {};
  if (e.status === E.STATUS.DRAFT) {
    const value = exigeValido(P.validateClubElection(entrada));
    await exigeMembros(ctx, club, value.commission.map((p) => p.uid));
    await ref.update({ ...value, commission_uids: value.commission.map((p) => p.uid), updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'update') });
  } else if (e.status === E.STATUS.PUBLISHED) {
    const reason = motivo(data.reason);
    const value = exigeValido(P.validateClubElection({ ...e, calendar: entrada.calendar || e.calendar, college: entrada.college || e.college, description: entrada.description ?? e.description, notice_min_days: entrada.notice_min_days ?? e.notice_min_days }));
    if (value.calendar.notice_on !== e.calendar.notice_on) falha('invalid-argument', 'A data do edital publicado não muda.');
    await ref.update({ calendar: value.calendar, college: value.college, description: value.description, notice_min_days: value.notice_min_days, updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'update', reason) });
  } else falha('failed-precondition', 'Com a votação aberta, o edital não muda mais.');
  await a.auditoria(ctx, actor, 'club_election_update', { club_id: club.id, election_id: e.id });
  return { ok: true };
}

async function commission(ctx, actor, data, { club, admin }) {
  exigeAdmin(admin);
  const { ref, e } = await eleicao(ctx, club, data.electionId);
  if ([E.STATUS.CLOSED, E.STATUS.CANCELLED].includes(e.status)) falha('failed-precondition', 'Esta eleição já terminou.');
  const errors = {};
  const lista = E.validateCommission(data.commission, errors);
  if (errors.commission) falha('invalid-argument', errors.commission);
  const uids = lista.map((p) => p.uid);
  await exigeMembros(ctx, club, uids);
  const candidatos = (await candidaturasDa(ctx, club, e)).filter((c) => LIVE.includes(c.status)).flatMap((c) => c.member_uids || []);
  if (uids.some((u) => candidatos.includes(u))) falha('failed-precondition', 'Quem concorre não pode estar na comissão eleitoral.');
  await ref.update({ commission: lista, commission_uids: uids, updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'commission') });
  await a.auditoria(ctx, actor, 'club_election_commission', { club_id: club.id, election_id: e.id, size: uids.length });
  return { ok: true, warning: uids.length ? '' : 'Sem comissão, quem administra o clube conduz a eleição.' };
}

async function publish(ctx, actor, data, { club, admin }) {
  exigeAdmin(admin);
  const { ref, e } = await eleicao(ctx, club, data.electionId);
  if (e.status !== E.STATUS.DRAFT) falha('failed-precondition', 'Este edital já foi publicado.');
  const value = exigeValido(P.validateClubElection({ ...e, calendar: { ...e.calendar, notice_on: hojeDe(ctx) } }));
  const { balance } = await colegio(ctx, club, { ...e, ...value });
  if (!balance.voters) falha('failed-precondition', 'Ninguém votaria hoje: nenhum plano dá direito a voto, ou não há associados em dia no prazo do edital.');
  const notice_text = P.noticeText(club, value);
  const ato = await publicarAtoDeTexto(ctx, actor, club, { type: 'convocation', title: `Edital: ${value.title}`.slice(0, 120), summary: 'Convocação das eleições', body: notice_text, act_date: hojeDe(ctx), visibility: 'members', tags: ['eleições'], origin: 'elections' });
  await ref.update({
    ...value, commission_uids: value.commission.map((p) => p.uid), status: E.STATUS.PUBLISHED, public: true, notice_text,
    notice_doc_id: ato.docId, notice_code: ato.code, endorsements_needed: E.endorsementsNeeded(value.endorsement_pct, balance.voters),
    college_preview: resumoBalanco(balance), published_at_ms: ctx.now, published_by: actor.uid, updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'publish'),
  });
  const avisados = await avisar(ctx, await associadosEmDia(ctx, club), { title: tx('{sigla}: edital de eleição publicado', params(club, e)), message: tx('{titulo}: veja o calendário e como registrar chapa.', params(club, e)), link: linkDa(club) });
  await a.auditoria(ctx, actor, 'club_election_publish', { club_id: club.id, election_id: e.id, notice_doc_id: ato.docId, notified: avisados });
  return { ok: true, notified: avisados, noticeCode: ato.code };
}

async function cancel(ctx, actor, data, { club, admin }) {
  exigeAdmin(admin);
  const { ref, e } = await eleicao(ctx, club, data.electionId);
  if ([E.STATUS.CLOSED, E.STATUS.CANCELLED].includes(e.status)) falha('failed-precondition', 'Esta eleição já terminou.');
  const reason = motivo(data.reason);
  await ref.update({ status: E.STATUS.CANCELLED, cancel_reason: reason, cancelled_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'cancel', reason) });
  const avisados = e.public ? await avisar(ctx, await associadosEmDia(ctx, club), { title: tx('{sigla}: eleição cancelada', params(club, e)), message: texto(reason, 300), link: linkDa(club) }) : 0;
  await a.auditoria(ctx, actor, 'club_election_cancel', { club_id: club.id, election_id: e.id, notified: avisados });
  return { ok: true };
}

/* --------------------------------------------------------------- chapas -- */

const posicao = (e, pid) => (e.positions || []).find((p) => p.id === pid) || null;

async function candidacyInfo(ctx, actor, data, { club }) {
  const { e } = await eleicao(ctx, club, data.electionId);
  if (!e.public) falha('not-found', 'Eleição não encontrada.');
  const { c } = await candidatura(ctx, club, e, data.candidacyId);
  const p = posicao(e, c.position_id);
  return {
    ok: true,
    candidacy: { id: c.id, name: c.name, status: c.status, position: p ? p.label : '', members: (c.members || []).map((x) => ({ name: x.name, role: x.role })), endorsement_count: c.endorsement_count || 0, endorsements_needed: e.endorsements_needed || 0 },
    canEndorse: c.status === E.CANDIDACY_STATUS.SUBMITTED && E.windowOpen(e, 'endorse', hojeDe(ctx)),
  };
}

async function candidacySubmit(ctx, actor, data, { club }) {
  const { e } = await eleicao(ctx, club, data.electionId);
  if (!E.windowOpen(e, 'candidacy', hojeDe(ctx))) falha('failed-precondition', 'O registro de chapas não está aberto.');
  const value = exigeValido(E.validateCandidacy(data.candidacy || {}, posicao(e, (data.candidacy || {}).position_id)));
  const uids = value.members.map((x) => x.uid);
  if (!uids.includes(actor.uid)) falha('permission-denied', 'Quem registra a chapa faz parte dela.');
  if (uids.some((u) => (e.commission_uids || []).includes(u))) falha('failed-precondition', 'Membro da comissão eleitoral não concorre.');
  for (const x of value.members) {
    const aff = await filiacao(ctx, club, x.uid); // eslint-disable-line no-await-in-loop
    if (!P.clubCandidateEligible(aff, { hoje: hojeDe(ctx), nowMs: ctx.now })) falha('failed-precondition', `${x.name} não é associado em dia neste clube.`);
  }
  const vivas = (await candidaturasDa(ctx, club, e)).filter((c) => LIVE.includes(c.status));
  const repetido = value.members.find((x) => vivas.some((c) => (c.member_uids || []).includes(x.uid)));
  if (repetido) falha('failed-precondition', `${repetido.name} já está em outra chapa desta eleição.`);
  const pres = (await C(ctx, club, 'staff').where('role', '==', 'president').get()).docs.map((d) => ({ uid: d.id }))[0];
  const alerts = E.candidacyAlerts(value, posicao(e, value.position_id), { presidentUid: pres ? pres.uid : null, presidentTerms: 1 });
  const ref = C(ctx, club, 'candidacies').doc();
  await ref.set({
    election_id: e.id, club_id: club.id, ...value, member_uids: uids, status: E.CANDIDACY_STATUS.SUBMITTED, public: false,
    endorsement_count: 0, challenges: [], alerts, submitted_by: actor.uid, submitted_by_name: texto(actor.name, 80), submitted_at_ms: ctx.now, updated_at_ms: ctx.now,
  });
  await a.auditoria(ctx, actor, 'club_candidacy_submit', { club_id: club.id, election_id: e.id, candidacy_id: ref.id });
  return { ok: true, candidacyId: ref.id, endorsementsNeeded: e.endorsements_needed || 0 };
}

async function candidacyWithdraw(ctx, actor, data, { club }) {
  const { e } = await eleicao(ctx, club, data.electionId);
  const { ref, c } = await candidatura(ctx, club, e, data.candidacyId);
  if (!((c.member_uids || []).includes(actor.uid) || c.submitted_by === actor.uid)) falha('permission-denied', 'Só quem está na chapa a retira.');
  if (!LIVE.includes(c.status) || !E.windowOpen(e, 'withdraw', hojeDe(ctx))) falha('failed-precondition', 'A chapa só sai antes de a votação abrir.');
  await ref.update({ status: E.CANDIDACY_STATUS.WITHDRAWN, withdrawn_at_ms: ctx.now, updated_at_ms: ctx.now });
  await a.auditoria(ctx, actor, 'club_candidacy_withdraw', { club_id: club.id, election_id: e.id, candidacy_id: c.id });
  return { ok: true };
}

async function endorse(ctx, actor, data, { club }) {
  const { e } = await eleicao(ctx, club, data.electionId);
  if (!E.windowOpen(e, 'endorse', hojeDe(ctx))) falha('failed-precondition', 'O apoio a chapas só vale no prazo de registro.');
  const { ref, c } = await candidatura(ctx, club, e, data.candidacyId);
  if (c.status !== E.CANDIDACY_STATUS.SUBMITTED) falha('failed-precondition', 'Esta chapa não recebe mais apoio.');
  if ((c.member_uids || []).includes(actor.uid)) falha('failed-precondition', 'Quem está na chapa não a apoia.');
  await exigeEleitor(ctx, club, e, actor.uid);
  const apoioRef = C(ctx, club, 'endorsements').doc(`${e.id}_${c.position_id}_${actor.uid}`);
  const count = await ctx.db.runTransaction(async (tr) => {
    const [apoio, cSnap] = await Promise.all([tr.get(apoioRef), tr.get(ref)]);
    if (apoio.exists) falha('already-exists', 'Você já apoiou uma chapa para este cargo.');
    const n = (Number(cSnap.data().endorsement_count) || 0) + 1;
    tr.set(apoioRef, { election_id: e.id, club_id: club.id, position_id: c.position_id, candidacy_id: c.id, candidacy_name: c.name, user_id: actor.uid, at_ms: ctx.now });
    tr.update(ref, { endorsement_count: n, updated_at_ms: ctx.now });
    return n;
  });
  await a.auditoria(ctx, actor, 'club_candidacy_endorse', { club_id: club.id, election_id: e.id, candidacy_id: c.id });
  return { ok: true, count, needed: e.endorsements_needed || 0 };
}

async function challenge(ctx, actor, data, { club }) {
  const { e } = await eleicao(ctx, club, data.electionId);
  if (!E.windowOpen(e, 'challenge', hojeDe(ctx))) falha('failed-precondition', 'O prazo de impugnação está fechado.');
  const { ref, c } = await candidatura(ctx, club, e, data.candidacyId);
  if (![E.CANDIDACY_STATUS.ACCEPTED, E.CANDIDACY_STATUS.CHALLENGED].includes(c.status)) falha('failed-precondition', 'Só se impugna chapa com registro aceito.');
  const reason = motivo(data.reason, E.CHALLENGE_MIN);
  const aff = await exigeEleitor(ctx, club, e, actor.uid);
  const lista = Array.isArray(c.challenges) ? c.challenges : [];
  if (lista.length >= CHALLENGES_MAX) falha('resource-exhausted', 'Esta chapa já tem impugnações demais.');
  if (lista.some((x) => x.by_uid === actor.uid && !x.decision)) falha('already-exists', 'Você já tem uma impugnação aberta contra esta chapa.');
  const item = { id: `i${lista.length + 1}`, by_uid: actor.uid, by_name: texto(aff.user_name || actor.name, 80), reason, at_ms: ctx.now, defense: '', defense_at_ms: null, decision: null };
  await ref.update({ challenges: [...lista, item], status: E.CANDIDACY_STATUS.CHALLENGED, updated_at_ms: ctx.now });
  await avisar(ctx, c.member_uids || [], { title: tx('{sigla}: sua chapa foi impugnada', params(club, e)), message: tx('Apresente a defesa até {data}.', { data: e.calendar.defense_to.split('-').reverse().join('/') }), link: linkDa(club) });
  await a.auditoria(ctx, actor, 'club_candidacy_challenge', { club_id: club.id, election_id: e.id, candidacy_id: c.id, challenge_id: item.id });
  return { ok: true, challengeId: item.id };
}

async function defend(ctx, actor, data, { club }) {
  const { e } = await eleicao(ctx, club, data.electionId);
  const { ref, c } = await candidatura(ctx, club, e, data.candidacyId);
  if (!(c.member_uids || []).includes(actor.uid)) falha('permission-denied', 'Só quem está na chapa apresenta a defesa.');
  if (!E.windowOpen(e, 'defense', hojeDe(ctx))) falha('failed-precondition', 'O prazo de defesa terminou.');
  const lista = Array.isArray(c.challenges) ? c.challenges : [];
  const alvo = lista.find((x) => x.id === data.challengeId);
  if (!alvo || alvo.decision || alvo.defense) falha('failed-precondition', 'Esta impugnação não aceita defesa.');
  const defense = motivo(data.defense);
  await ref.update({ challenges: lista.map((x) => (x.id === alvo.id ? { ...x, defense, defense_at_ms: ctx.now, defense_by: actor.uid } : x)), updated_at_ms: ctx.now });
  await a.auditoria(ctx, actor, 'club_candidacy_defend', { club_id: club.id, election_id: e.id, candidacy_id: c.id, challenge_id: alvo.id });
  return { ok: true };
}

async function judge(ctx, actor, data, { club, admin }) {
  const { e } = await eleicao(ctx, club, data.electionId);
  exigeConduzir(e, actor, admin);
  if (e.status !== E.STATUS.PUBLISHED) falha('failed-precondition', 'O julgamento das chapas acontece antes da votação.');
  const { ref, c } = await candidatura(ctx, club, e, data.candidacyId);
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
  await avisar(ctx, c.member_uids || [], { title: tx('{sigla}: decisão sobre a sua chapa', params(club, e)), message: resultado === E.CANDIDACY_STATUS.REJECTED ? tx('A comissão indeferiu a chapa.') : tx('A chapa segue na eleição.'), link: linkDa(club) });
  await a.auditoria(ctx, actor, 'club_candidacy_judge', { club_id: club.id, election_id: e.id, candidacy_id: c.id, challenge_id: data.challengeId || null, result: resultado });
  return { ok: true, status: resultado };
}

/* -------------------------------------------------------------- votação -- */

async function openVoting(ctx, actor, data, { club, admin }) {
  const { ref, e } = await eleicao(ctx, club, data.electionId);
  exigeConduzir(e, actor, admin);
  if (e.status !== E.STATUS.PUBLISHED) falha('failed-precondition', 'A votação só abre com o edital publicado.');
  if (ctx.now < E.votingOpensMs(e)) falha('failed-precondition', 'Ainda não chegou a hora de abrir a votação.');
  if ((await candidaturasDa(ctx, club, e)).some((c) => [E.CANDIDACY_STATUS.SUBMITTED, E.CANDIDACY_STATUS.CHALLENGED].includes(c.status))) falha('failed-precondition', 'Ainda há chapas em análise ou impugnações sem julgamento.');
  const { roll, balance } = await colegio(ctx, club, e);
  if (!balance.voters) falha('failed-precondition', 'O colégio eleitoral está vazio.');
  for (let i = 0; i < roll.length; i += LOTE) {
    const batch = ctx.db.batch();
    roll.slice(i, i + LOTE).forEach((v) => batch.set(C(ctx, club, 'voters').doc(v.id), {
      election_id: e.id, club_id: club.id, user_id: v.user_id, name: v.name, category: v.category, weight: v.weight, kind: v.kind, org_id: v.org_id,
      voted_at_ms: null, receipt: null, channel: null,
    }));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
  await ref.update({ status: E.STATUS.VOTING, college_frozen: resumoBalanco(balance), voted_count: 0, voted_weight: 0, voting_opened_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'open_voting') });
  const avisados = e.mode === 'presential' ? 0 : await avisar(ctx, roll.map((v) => v.user_id), { title: tx('{sigla}: a votação está aberta', params(club, e)), message: tx('{titulo}: seu voto é secreto. Vote até o fim do prazo.', params(club, e)), link: linkDa(club) });
  await a.auditoria(ctx, actor, 'club_election_open_voting', { club_id: club.id, election_id: e.id, voters: roll.length, notified: avisados });
  return { ok: true, voters: roll.length, notified: avisados };
}

async function vote(ctx, actor, data, { club }) {
  const { ref, e } = await eleicao(ctx, club, data.electionId);
  if (e.status !== E.STATUS.VOTING || e.mode === 'presential') falha('failed-precondition', 'A votação pelo aplicativo não está aberta.');
  if (ctx.now >= E.votingClosesMs(e)) falha('failed-precondition', 'O horário de votação terminou.');
  const aceitas = {};
  (await candidaturasDa(ctx, club, e)).filter((c) => c.status === E.CANDIDACY_STATUS.ACCEPTED).forEach((c) => { (aceitas[c.position_id] = aceitas[c.position_id] || []).push(c.id); });
  const choices = exigeValido(E.validateBallot(data.choices, e.positions, aceitas));
  const voterRef = C(ctx, club, 'voters').doc(`${e.id}_${actor.uid}`);
  const ballotRef = ctx.db.collection(BALLOTS).doc(sorteio(16));
  const receipt = sorteio(6).toUpperCase().match(/.{4}/g).join('-');
  await ctx.db.runTransaction(async (tr) => {
    const [vSnap, eSnap] = await Promise.all([tr.get(voterRef), tr.get(ref)]);
    const v = vSnap.exists ? vSnap.data() : null;
    if (!v || v.election_id !== e.id || v.user_id !== actor.uid) falha('permission-denied', 'Você não está no colégio eleitoral desta eleição.');
    if (v.voted_at_ms) falha('already-exists', 'Este voto já foi registrado.');
    const atual = eSnap.data();
    if (atual.status !== E.STATUS.VOTING) falha('failed-precondition', 'A votação não está aberta.');
    tr.set(ballotRef, { club_id: club.id, election_id: e.id, choices, weight: Number(v.weight) || 0 });
    tr.update(voterRef, { voted_at_ms: ctx.now, receipt, channel: 'online' });
    tr.update(ref, { voted_count: (Number(atual.voted_count) || 0) + 1, voted_weight: (Number(atual.voted_weight) || 0) + (Number(v.weight) || 0) });
  });
  await a.auditoria(ctx, actor, 'club_election_vote', { club_id: club.id, election_id: e.id });
  return { ok: true, receipt };
}

async function closeVoting(ctx, actor, data, { club, admin }) {
  const { ref, e } = await eleicao(ctx, club, data.electionId);
  exigeConduzir(e, actor, admin);
  if (e.status !== E.STATUS.VOTING) falha('failed-precondition', 'A votação não está aberta.');
  if (ctx.now < E.votingClosesMs(e)) falha('failed-precondition', 'O horário de votação do edital ainda não terminou.');
  await ref.update({ status: E.STATUS.COUNTING, voting_closed_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'close_voting') });
  await a.auditoria(ctx, actor, 'club_election_close_voting', { club_id: club.id, election_id: e.id });
  return { ok: true };
}

async function recordPresential(ctx, actor, data, { club, admin }) {
  const { ref, e } = await eleicao(ctx, club, data.electionId);
  exigeConduzir(e, actor, admin);
  if (e.status !== E.STATUS.COUNTING || e.mode === 'online') falha('failed-precondition', 'O lançamento presencial é depois de encerrar a votação, em eleição presencial ou mista.');
  if (e.presential) falha('failed-precondition', 'A votação presencial já foi lançada.');
  const ids = [...new Set((Array.isArray(data.voterIds) ? data.voterIds : []).map((x) => texto(x, 200)))];
  if (ids.length > PRESENTIAL_MAX) falha('invalid-argument', 'Eleitores demais num lançamento.');
  const refs = ids.map((id) => C(ctx, club, 'voters').doc(id));
  const snaps = await Promise.all(refs.map((r) => r.get()));
  let peso = 0;
  snaps.forEach((s, i) => {
    const v = s.exists ? s.data() : null;
    if (!v || v.election_id !== e.id) falha('invalid-argument', 'Há eleitor fora do colégio desta eleição.');
    if (v.voted_at_ms) falha('failed-precondition', `${v.name || ids[i]} já votou pelo aplicativo.`);
    peso += Number(v.weight) || 0;
  });
  const aceitas = (await candidaturasDa(ctx, club, e)).filter((c) => c.status === E.CANDIDACY_STATUS.ACCEPTED);
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
    if (soma !== peso) falha('invalid-argument', `Em ${p.label} os totais somam ${soma}, e o número de quem votou na mesa é ${peso}.`);
    totals[p.id] = porOpcao;
  }
  for (let i = 0; i < refs.length; i += LOTE) {
    const batch = ctx.db.batch();
    refs.slice(i, i + LOTE).forEach((r) => batch.update(r, { voted_at_ms: ctx.now, channel: 'presential' }));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
  await ref.update({
    presential: { voters: ids.length, weight: peso, totals, recorded_at_ms: ctx.now, recorded_by: actor.uid },
    voted_count: (Number(e.voted_count) || 0) + ids.length, voted_weight: (Number(e.voted_weight) || 0) + peso, updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'record_presential'),
  });
  await a.auditoria(ctx, actor, 'club_election_presential', { club_id: club.id, election_id: e.id, voters: ids.length });
  return { ok: true, voters: ids.length, weight: peso };
}

/** A apuração: soma as cédulas e a mesa; empate pela regra do edital. */
async function apurar(ctx, club, e) {
  const [ballots, cands] = await Promise.all([ctx.db.collection(BALLOTS).where('election_id', '==', e.id).get(), candidaturasDa(ctx, club, e)]);
  const tallied = E.tally(ballots.docs.filter((d) => d.data().club_id === club.id).map((d) => d.data()), e.presential || null, e.positions);
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

async function count(ctx, actor, data, { club, admin }) {
  const { e } = await eleicao(ctx, club, data.electionId);
  exigeConduzir(e, actor, admin);
  if (e.status !== E.STATUS.COUNTING) falha('failed-precondition', 'A apuração começa depois de encerrar a votação.');
  const { results } = await apurar(ctx, club, e);
  await a.auditoria(ctx, actor, 'club_election_count', { club_id: club.id, election_id: e.id });
  return { ok: true, results, pendingPresential: e.mode !== 'online' && !e.presential };
}

async function publishResult(ctx, actor, data, { club, admin }) {
  const { ref, e } = await eleicao(ctx, club, data.electionId);
  exigeConduzir(e, actor, admin);
  if (e.status !== E.STATUS.COUNTING) falha('failed-precondition', 'O resultado sai depois de encerrar a votação.');
  if (e.mode !== 'online' && !e.presential) falha('failed-precondition', 'Lance a votação presencial antes de publicar o resultado.');
  const { results } = await apurar(ctx, club, e);
  const totals = { voters: (e.college_frozen && e.college_frozen.voters) || 0, total_weight: (e.college_frozen && e.college_frozen.total_weight) || 0, voted: Number(e.voted_count) || 0, voted_weight: Number(e.voted_weight) || 0 };
  const minutes_text = P.minutesText(club, e, results, totals);
  const ato = await publicarAtoDeTexto(ctx, actor, club, { type: 'minutes', title: `Ata da apuração: ${e.title}`.slice(0, 120), summary: 'Resultado das eleições', body: minutes_text, act_date: hojeDe(ctx), visibility: 'members', tags: ['eleições'], origin: 'elections' });
  await ref.update({
    status: E.STATUS.CLOSED, results, totals, minutes_text, minutes_doc_id: ato.docId, minutes_code: ato.code,
    governance_applied: false, results_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'publish_result'),
  });
  const avisados = await avisar(ctx, await associadosEmDia(ctx, club), { title: tx('{sigla}: resultado da eleição', params(club, e)), message: tx('{titulo}: veja quem foi eleito.', params(club, e)), link: linkDa(club) });
  await a.auditoria(ctx, actor, 'club_election_result', { club_id: club.id, election_id: e.id, minutes_doc_id: ato.docId, notified: avisados });
  return { ok: true, results, notified: avisados };
}

/**
 * A POSSE: a administração dá a cada eleito o cargo do clube que escolher. Só vale para
 * quem ESTÁ no resultado publicado (o servidor reconfere), uma pessoa por linha, e cada um
 * precisa ser membro do clube. Pode ser feita aos poucos; `governance_applied` marca que
 * ao menos um foi empossado.
 */
async function applyGovernance(ctx, actor, data, { club, admin }) {
  exigeAdmin(admin);
  const { ref, e } = await eleicao(ctx, club, data.electionId);
  if (e.status !== E.STATUS.CLOSED) falha('failed-precondition', 'A posse só vale para eleição com resultado publicado.');
  const eleitos = P.electedPeople(e.results || [], e.positions || [], await candidaturasDa(ctx, club, e));
  const linhas = Array.isArray(data.appointments) ? data.appointments.slice(0, POSSES_MAX) : [];
  if (!linhas.length) falha('invalid-argument', 'Escolha o cargo de ao menos um eleito.');
  const vistos = new Set();
  for (const l of linhas) {
    const uid = texto(l && l.userId, 128);
    if (!eleitos.some((x) => x.uid === uid)) falha('failed-precondition', 'A posse é só de quem foi eleito nesta eleição.');
    if (vistos.has(uid)) falha('invalid-argument', 'A mesma pessoa aparece duas vezes.');
    vistos.add(uid);
  }
  const posse = e.calendar.inauguration_on || e.calendar.result_on;
  const inicio = posse && posse <= hojeDe(ctx) ? posse : hojeDe(ctx);
  const dadas = [];
  for (const l of linhas) {
    const uid = texto(l.userId, 128);
    const eleito = eleitos.find((x) => x.uid === uid);
    // eslint-disable-next-line no-await-in-loop
    await darPosse(ctx, actor, club, { userId: uid, roleId: l.roleId, termStart: inicio, termEnd: l.termEnd === undefined ? undefined : texto(l.termEnd, 10), userName: eleito.name });
    dadas.push({ user_id: uid, role_id: texto(l.roleId, 40), at_ms: ctx.now });
  }
  const anteriores = Array.isArray(e.appointed) ? e.appointed.filter((x) => !vistos.has(x.user_id)) : [];
  await ref.update({ governance_applied: true, appointed: [...anteriores, ...dadas].slice(-POSSES_MAX * 2), updated_at_ms: ctx.now, history: historico(e, actor, ctx, 'apply_governance') });
  await a.auditoria(ctx, actor, 'club_election_governance', { club_id: club.id, election_id: e.id, appointed: dadas.length });
  return { ok: true, appointed: dadas.length };
}

const ACOES = {
  overview, preview, create, update, commission, publish, cancel,
  candidacy_info: candidacyInfo, candidacy_submit: candidacySubmit, candidacy_withdraw: candidacyWithdraw, endorse, challenge, defend, judge,
  open_voting: openVoting, vote, close_voting: closeVoting, count, record_presential: recordPresential, publish_result: publishResult, apply_governance: applyGovernance,
};

async function elections(ctx, actor, data = {}) {
  const fn = ACOES[data.action];
  if (!fn) falha('invalid-argument', 'Ação desconhecida.');
  const c = await contexto(ctx, actor, data);
  return fn(ctx, actor, data, c);
}

module.exports = { elections, BALLOTS };
