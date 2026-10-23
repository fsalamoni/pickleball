/**
 * ARBITRAGEM da federação (módulo `referees`) — só o SERVIDOR grava
 * `federation_referees` (o quadro) e `federation_assignments` (as escalas):
 * a regra é `allow write: if false`. Por que aqui: os alertas de uma
 * convocação (data indisponível, outra escala no mesmo dia, inscrito como
 * atleta, nível abaixo do mínimo) leem dados de outras pessoas e de outras
 * federações; a resposta, a súmula e a avaliação mudam o histórico; e a
 * diária paga vira despesa nas contas da federação.
 *
 * Callable `federationReferees`:
 *  - da EQUIPE (permissão `courses` ou `admin`): `roster_add` (de uma conta
 *    ou de uma credencial de curso), `roster_update` (também as notas da
 *    equipe, em `private/staff`), `roster_remove` (não apaga atuações; com
 *    escala aberta, recusa), `assign` (vários de uma vez num evento, com os
 *    alertas; avisa cada um), `reassign`, `cancel`, `close_event` (atuou /
 *    não compareceu; convocado sem resposta é cancelado), `evaluate`,
 *    `mark_paid` (e desfazer), `rules`, `promotion_decline` (recusa o
 *    pedido de promoção, com motivo; promover é mudar o nível no cadastro,
 *    que guarda o histórico em `level_history` e avisa);
 *  - do ÁRBITRO: `respond` (confirmar ou recusar; conflito de interesse
 *    declarado obriga a recusar), `report` (súmula/relatório), `self`
 *    (datas indisponíveis e se aparece no quadro público) e `crew` (a escala
 *    inteira do evento, quando a federação mostra), `promotion_request`
 *    (pede o próximo nível, quando cumpre os requisitos) e
 *    `evaluator_crew` (o AVALIADOR escalado no evento vê quem atuou para
 *    avaliar; `evaluate` aceita a nota dele, com `by_role: 'evaluator'`).
 *
 * Credencial (Bloco 4 da rodada 3): com `referee_rules.credential_policy`
 * exigindo, credencial de árbitro vencida (passada a carência) ou ausente
 * barra a convocação e a confirmação nas funções de arbitragem; com
 * `block_and_release`, a varredura também tira das escalas futuras em
 * aberto e avisa. O cadastro guarda uma cópia de leitura
 * (`credential_until`, `credential_policy`, `promotion_progress`) para o
 * árbitro ver sem ler a régua da federação; quem decide é o servidor.
 *
 * `publico` (callable sem conta `federationRefereesPublic`): o quadro
 * (só ativo E que aceitou aparecer: nome, nível, cidade) e quem apita cada
 * evento público (só confirmados/atuou: nome e função) — nunca valor, nota
 * nem conflito.
 *
 * `sweep` (na varredura diária das federações): lembra quem não respondeu,
 * um dia antes do prazo, uma vez só (`reminded`); avisa a credencial que
 * vai vencer (uma vez por validade, `cred_warned_for`); com
 * `block_and_release`, tira a credencial vencida das escalas futuras
 * (`cred_released_for`); e atualiza a cópia de leitura do cadastro.
 *
 * A conta pura é `federationRefereesPolicy.js` (cópia de
 * `src/modules/federations/domain/referees.js`, com paridade).
 */
const R = require('./federationRefereesPolicy.js');
const f = require('./federations.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto } = f;
const REFS = 'federation_referees';
const ASSIGN = 'federation_assignments';
const FUNCAO = Object.freeze({
  referee: 'Árbitro(a)', head_referee: 'Árbitro(a) geral', line_judge: 'Juiz(a) de linha', technical_delegate: 'Delegado(a) técnico(a)', tournament_director: 'Diretor(a) do torneio', evaluator: 'Avaliador(a) de arbitragem',
});
const LINK_ARBITRO = '/perfil?secao=federacoes&ancora=federacoes-escalas';
const linkEquipe = (fed) => `/federacoes/${fed.id}/gerir?aba=arbitragem`;
const br = (iso) => (R.isIsoDate(iso) ? iso.split('-').reverse().join('/') : '');
const reais = (c) => `R$ ${(Math.trunc(Number(c) || 0) / 100).toFixed(2).replace('.', ',')}`;
const sigla = (fed) => fed.acronym || fed.name;
const podeEquipe = (perms) => perms.includes('courses') || perms.includes('admin');

async function contexto(ctx, actor, data) {
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, data.federationId);
  if (fed.status !== 'approved') falha('failed-precondition', 'A federação ainda não foi aprovada pela plataforma.');
  if (!(fed.modules && fed.modules.referees === true)) falha('failed-precondition', 'Esta federação não tem a arbitragem ligada.');
  const perms = await f.staffPerms(ctx, fed.id, actor);
  return { fed, perms, hoje: R.isoDateBR(ctx.now), rules: R.normalizeRefereeRules(fed.referee_rules) };
}

const exigeEquipe = (c) => { if (!podeEquipe(c.perms)) falha('permission-denied', 'Você não tem permissão para a arbitragem desta federação.'); };

async function cadastro(ctx, fed, uid) {
  const ref = ctx.db.collection(REFS).doc(`${fed.id}_${texto(uid, 128)}`);
  const snap = await ref.get();
  return { ref, referee: snap.exists ? { id: snap.id, ...snap.data() } : null };
}

async function escala(ctx, fed, id) {
  const ref = ctx.db.collection(ASSIGN).doc(texto(id, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== fed.id) falha('not-found', 'Escala não encontrada.');
  return { ref, a: { id: snap.id, ...snap.data() } };
}

/** As escalas de uma pessoa em TODAS as federações (outra escala no mesmo dia vale entre federações). */
const escalasDe = async (ctx, uid) => (await ctx.db.collection(ASSIGN).where('referee_uid', '==', uid).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

/** O evento escalável, lido do banco (nunca do navegador): torneio chancelado por esta federação ou evento esportivo da agenda. */
async function eventoEscalavel(ctx, fed, alvo = {}) {
  const id = texto(alvo.id, 80);
  if (!id) falha('invalid-argument', 'Escolha o evento.');
  if (alvo.kind === 'tournament') {
    const snap = await ctx.db.collection('tournaments').doc(id).get();
    const tt = snap.exists ? { id: snap.id, ...snap.data() } : null;
    if (!R.isScalableTournament(tt, fed.id)) falha('failed-precondition', 'Só se escala torneio chancelado por esta federação.');
    const ev = R.eventFromTournament(tt);
    if (!ev) falha('failed-precondition', 'O torneio ainda não tem data.');
    return ev;
  }
  if (alvo.kind === 'event') {
    const snap = await ctx.db.collection('federation_events').doc(id).get();
    const ev = snap.exists ? { id: snap.id, ...snap.data() } : null;
    if (!R.isScalableAgendaEvent(ev, fed.id)) falha('failed-precondition', 'Só se escala evento esportivo confirmado da agenda desta federação.');
    return R.eventFromAgenda(ev);
  }
  return falha('invalid-argument', 'Escolha o evento.');
}

async function atletasDo(ctx, event) {
  if (event.kind !== 'tournament') return new Set();
  const snap = await ctx.db.collection('tournament_registrations').where('tournament_id', '==', event.id).get();
  return R.athleteUidsOf(snap.docs.map((d) => d.data()));
}

function avisoConvocacao(ctx, batch, fed, uid, event, fn, respondBy) {
  f.aviso(ctx, batch, uid, {
    title: tx('{sigla} convocou você para arbitrar: {evento}', { sigla: sigla(fed), evento: texto(event.name, 120) }),
    message: tx('{funcao} em {data}. Responda até {prazo} em Minha área → Federações.', { funcao: FUNCAO[fn] || fn, data: br(event.date), prazo: br(respondBy) }),
    link: LINK_ARBITRO,
  });
}

/** Até quando vale a credencial de árbitro da pessoa nesta federação (`null` = nenhuma). */
async function credencialAte(ctx, fed, uid) {
  const snap = await ctx.db.collection(f.C.credentials).where('user_id', '==', uid).get();
  return R.refereeCredentialUntil(snap.docs.map((d) => d.data()), fed.id);
}

/** A cópia de leitura do cadastro: contagem, credencial e quanto falta para o próximo nível. */
function copiaDeLeitura(referee, suas, rules, hoje, until) {
  return {
    stats: R.refereeStats(suas),
    credential_until: until,
    credential_policy: rules.credential_policy,
    promotion_progress: R.promotionProgress(referee, suas, rules, hoje),
  };
}

/** Recalcula a cópia de leitura de cada árbitro tocado (só nesta federação). */
async function recontar(ctx, fed, uids) {
  const rules = R.normalizeRefereeRules(fed.referee_rules);
  const hoje = R.isoDateBR(ctx.now);
  for (const uid of new Set(uids)) {
    // eslint-disable-next-line no-await-in-loop
    const { ref, referee } = await cadastro(ctx, fed, uid);
    if (!referee) continue;
    // eslint-disable-next-line no-await-in-loop
    const [suas, until] = await Promise.all([
      ctx.db.collection(ASSIGN).where('federation_id', '==', fed.id).where('referee_uid', '==', uid).get().then((q) => q.docs.map((d) => d.data())),
      credencialAte(ctx, fed, uid),
    ]);
    // eslint-disable-next-line no-await-in-loop
    await ref.update({ ...copiaDeLeitura(referee, suas, rules, hoje, until), updated_at_ms: ctx.now });
  }
}

/** A credencial impede esta função? (só nas funções de arbitragem, pela regra da federação) */
async function semCredencial(ctx, fed, rules, hoje, uid, fn) {
  if (!R.CREDENTIAL_FUNCTIONS.includes(fn) || !rules.credential_policy.required) return '';
  return R.credentialBlocker(R.credentialStanding(await credencialAte(ctx, fed, uid), rules, hoje));
}

/**
 * Proteção de menores (Bloco 4): com o módulo ligado e o papel exigido na
 * régua da federação, quem não está em dia (curso + certidão) não é escalado.
 * O diretor do torneio responde como diretor; as demais funções, como árbitro.
 */
const semProtecao = (ctx, fed, uid, fn) => require('./federationCoaching.js').clearanceBlocker(ctx, fed, uid, fn === 'tournament_director' ? 'director' : 'referee');

function centavos(v, padrao) {
  if (v == null || v === '') return padrao;
  const n = R.normalizeCents(v);
  if (n == null) falha('invalid-argument', 'Valor inválido: use reais com até dois decimais, até R$ 10.000,00.');
  return n;
}

/** A nova escala (documento completo). */
function novaEscala(ctx, actor, fed, { event, fn, referee, fee, travel, respondBy, warnings, replaces = null }) {
  return {
    federation_id: fed.id, federation_acronym: fed.acronym || '', federation_name: fed.name || '',
    event, event_key: R.eventKey(event), function: fn,
    referee_uid: referee.user_id, referee_name: texto(referee.name, 120), referee_level: referee.level || '',
    status: R.ASSIGNMENT_STATUS.INVITED, respond_by: respondBy, fee_cents: fee, travel_cents: travel,
    warnings, conflict: null, decline_reason: '', report: null, evaluation: null, paid_at_ms: null, paid_by: null,
    replaces, replaced_by: null, reminded: false,
    created_by: actor.uid, created_at_ms: ctx.now, updated_at_ms: ctx.now,
  };
}

/* ---------------------------------------------------------- o quadro -- */

async function rosterAdd(ctx, actor, data, c) {
  exigeEquipe(c);
  const { fed, rules, hoje } = c;
  let uid = texto(data.userId, 128);
  let credIds = Array.isArray(data.referee && data.referee.credential_ids) ? data.referee.credential_ids : [];
  if (data.credentialId) {
    const cs = await ctx.db.collection(f.C.credentials).doc(texto(data.credentialId, 120)).get();
    const cred = cs.exists ? cs.data() : null;
    if (!cred || cred.federation_id !== fed.id || cred.status !== 'active') falha('failed-precondition', 'A credencial não é desta federação ou não está ativa.');
    uid = cred.user_id;
    credIds = [...new Set([cs.id, ...credIds])];
  }
  if (!uid) falha('invalid-argument', 'Escolha a pessoa.');
  const r = R.validateRosterInput({ ...(data.referee || {}), credential_ids: credIds }, rules);
  if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0]);
  const { ref, referee } = await cadastro(ctx, fed, uid);
  if (referee) falha('already-exists', 'Esta pessoa já está no quadro de arbitragem.');
  const conta = await ctx.db.collection('users').doc(uid).get();
  if (!conta.exists) falha('not-found', 'Conta não encontrada.');
  const u = conta.data();
  const batch = ctx.db.batch();
  batch.set(ref, {
    federation_id: fed.id, federation_acronym: fed.acronym || '', federation_name: fed.name || '', user_id: uid,
    name: texto(u.platform_name || u.full_name || u.display_name || 'Árbitro(a)', 120), photo_url: texto(u.photo_url || u.avatar_url, 500),
    city: texto(u.city, 80), state: texto(u.state, 2).toUpperCase(),
    ...r.value, since: r.value.since || hoje, public_listing: false, unavailable: [], stats: R.refereeStats([]),
    added_by: actor.uid, created_at_ms: ctx.now, updated_at_ms: ctx.now,
  });
  const notes = texto(data.notes, R.LIMITS.NOTES_MAX);
  if (notes) batch.set(ref.collection('private').doc('staff'), { notes, updated_at_ms: ctx.now, updated_by: actor.uid });
  f.aviso(ctx, batch, uid, {
    title: tx('Você entrou no quadro de arbitragem da {sigla}', { sigla: sigla(fed) }),
    message: tx('As convocações chegam aqui e em Minha área → Federações. Marque lá os dias em que não pode e se quer aparecer no quadro público.'),
    link: LINK_ARBITRO,
  });
  await batch.commit();
  await recontar(ctx, fed, [uid]);
  await f.auditoria(ctx, actor, 'federation_referee_add', { federation_id: fed.id, user_id: uid, level: r.value.level, from_credential: Boolean(data.credentialId) });
  return { ok: true, refereeId: ref.id };
}

async function rosterUpdate(ctx, actor, data, c) {
  exigeEquipe(c);
  const { fed, rules } = c;
  const { ref, referee } = await cadastro(ctx, fed, data.userId);
  if (!referee) falha('not-found', 'Esta pessoa não está no quadro de arbitragem.');
  const r = R.validateRosterInput({ ...referee, ...(data.referee || {}) }, rules);
  if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0]);
  const batch = ctx.db.batch();
  const patch = { ...r.value, since: r.value.since || referee.since || '', updated_at_ms: ctx.now, updated_by: actor.uid };
  const mudouNivel = r.value.level !== referee.level;
  if (mudouNivel) {
    const motivo = texto(data.levelReason, R.LIMITS.REASON_MAX);
    const subiu = R.levelRank(rules, r.value.level) > R.levelRank(rules, referee.level);
    patch.level_since = c.hoje;
    patch.promotion_request = null;
    patch.level_history = [...(Array.isArray(referee.level_history) ? referee.level_history : []), {
      from: referee.level || '', to: r.value.level, at: c.hoje, at_ms: ctx.now, by: actor.uid, reason: motivo,
      met: referee.promotion_progress && referee.promotion_progress.next && referee.promotion_progress.next.id === r.value.level ? referee.promotion_progress.met : null,
    }].slice(-R.LIMITS.LEVEL_HISTORY_MAX);
    f.aviso(ctx, batch, referee.user_id, {
      title: subiu ? tx('Você subiu de nível na arbitragem da {sigla}', { sigla: sigla(fed) }) : tx('Seu nível na arbitragem da {sigla} mudou', { sigla: sigla(fed) }),
      message: motivo
        ? tx('Agora: {nivel}. {motivo}', { nivel: R.levelLabel(rules, r.value.level), motivo })
        : tx('Agora: {nivel}.', { nivel: R.levelLabel(rules, r.value.level) }),
      link: LINK_ARBITRO,
    });
  }
  batch.update(ref, patch);
  if (typeof data.notes === 'string') batch.set(ref.collection('private').doc('staff'), { notes: texto(data.notes, R.LIMITS.NOTES_MAX), updated_at_ms: ctx.now, updated_by: actor.uid });
  if (r.value.status !== referee.status && r.value.status !== R.REFEREE_STATUS.ACTIVE) {
    f.aviso(ctx, batch, referee.user_id, {
      title: tx('Sua situação no quadro de arbitragem da {sigla} mudou', { sigla: sigla(fed) }),
      message: r.value.status === R.REFEREE_STATUS.SUSPENDED ? tx('Você está suspenso do quadro: não recebe convocações até a equipe reativar.') : tx('Você está inativo no quadro: não recebe convocações até a equipe reativar.'),
      link: LINK_ARBITRO,
    });
  }
  await batch.commit();
  if (mudouNivel) await recontar(ctx, fed, [referee.user_id]);
  await f.auditoria(ctx, actor, 'federation_referee_update', { federation_id: fed.id, user_id: referee.user_id, status: r.value.status, level: r.value.level, level_changed: mudouNivel, notes_changed: typeof data.notes === 'string' });
  return { ok: true };
}

async function rosterRemove(ctx, actor, data, c) {
  exigeEquipe(c);
  const { fed } = c;
  const { ref, referee } = await cadastro(ctx, fed, data.userId);
  if (!referee) falha('not-found', 'Esta pessoa não está no quadro de arbitragem.');
  const abertas = (await escalasDe(ctx, referee.user_id)).filter((a) => a.federation_id === fed.id && R.LIVE_ASSIGNMENT.includes(a.status));
  if (abertas.length) falha('failed-precondition', 'O árbitro tem escala em aberto: cancele ou substitua antes de tirar do quadro.');
  const batch = ctx.db.batch();
  batch.delete(ref);
  batch.delete(ref.collection('private').doc('staff'));
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_referee_remove', { federation_id: fed.id, user_id: referee.user_id });
  return { ok: true };
}

/* ---------------------------------------------------------- escalas -- */

async function assign(ctx, actor, data, c) {
  exigeEquipe(c);
  const { fed, rules, hoje } = c;
  const event = await eventoEscalavel(ctx, fed, data.event);
  if (R.eventDays(event).every((d) => d < hoje)) falha('failed-precondition', 'O evento já aconteceu.');
  const fn = R.REFEREE_FUNCTIONS.includes(data.function) ? data.function : falha('invalid-argument', 'Escolha a função.');
  const uids = [...new Set((Array.isArray(data.userIds) ? data.userIds : []).map((u) => texto(u, 128)).filter(Boolean))];
  if (!uids.length) falha('invalid-argument', 'Escolha quem convocar.');
  if (uids.length > R.LIMITS.ASSIGN_BATCH_MAX) falha('invalid-argument', `No máximo ${R.LIMITS.ASSIGN_BATCH_MAX} pessoas por vez.`);
  const fee = centavos(data.feeCents, rules.fee_default_cents[fn] || 0);
  const travel = centavos(data.travelCents, 0);
  const respondBy = R.isIsoDate(data.respondBy) && data.respondBy >= hoje ? data.respondBy : R.defaultRespondBy(event, rules, hoje);
  const atletas = await atletasDo(ctx, event);
  const batch = ctx.db.batch();
  const created = [];
  const skipped = [];
  for (const uid of uids) {
    // eslint-disable-next-line no-await-in-loop
    const [{ referee }, suas] = await Promise.all([cadastro(ctx, fed, uid), escalasDe(ctx, uid)]);
    // eslint-disable-next-line no-await-in-loop
    const bloqueio = R.assignBlocker({ referee, event, fn, assignments: suas }) || await semProtecao(ctx, fed, uid, fn) || await semCredencial(ctx, fed, rules, hoje, uid, fn);
    if (bloqueio) { skipped.push({ uid, reason: bloqueio }); continue; }
    const warnings = R.assignmentWarnings({ referee, event, fn, assignments: suas, athleteUids: atletas, rules });
    const ref = ctx.db.collection(ASSIGN).doc();
    batch.set(ref, novaEscala(ctx, actor, fed, { event, fn, referee, fee, travel, respondBy, warnings }));
    avisoConvocacao(ctx, batch, fed, uid, event, fn, respondBy);
    created.push({ uid, assignmentId: ref.id, warnings });
  }
  if (!created.length) falha('failed-precondition', skipped[0].reason);
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_referee_assign', { federation_id: fed.id, event_key: R.eventKey(event), function: fn, created: created.length, skipped: skipped.length, warnings: created.reduce((s, x) => s + x.warnings.length, 0) });
  return { ok: true, created, skipped };
}

async function reassign(ctx, actor, data, c) {
  exigeEquipe(c);
  const { fed, rules, hoje } = c;
  const { ref, a } = await escala(ctx, fed, data.assignmentId);
  if (!['invited', 'confirmed', 'declined'].includes(a.status)) falha('failed-precondition', 'Só se substitui escala em aberto ou recusada.');
  if (R.eventDays(a.event).every((d) => d < hoje)) falha('failed-precondition', 'O evento já aconteceu.');
  const uid = texto(data.userId, 128);
  if (!uid || uid === a.referee_uid) falha('invalid-argument', 'Escolha outra pessoa.');
  const [{ referee }, suas, atletas] = await Promise.all([cadastro(ctx, fed, uid), escalasDe(ctx, uid), atletasDo(ctx, a.event)]);
  const bloqueio = R.assignBlocker({ referee, event: a.event, fn: a.function, assignments: suas }) || await semProtecao(ctx, fed, uid, a.function) || await semCredencial(ctx, fed, rules, hoje, uid, a.function);
  if (bloqueio) falha('failed-precondition', bloqueio);
  const warnings = R.assignmentWarnings({ referee, event: a.event, fn: a.function, assignments: suas, athleteUids: atletas, rules });
  const respondBy = R.defaultRespondBy(a.event, rules, hoje);
  const novoRef = ctx.db.collection(ASSIGN).doc();
  const batch = ctx.db.batch();
  batch.update(ref, { status: R.ASSIGNMENT_STATUS.REPLACED, previous_status: a.status, replaced_by: novoRef.id, updated_at_ms: ctx.now, updated_by: actor.uid });
  batch.set(novoRef, novaEscala(ctx, actor, fed, { event: a.event, fn: a.function, referee, fee: a.fee_cents || 0, travel: a.travel_cents || 0, respondBy, warnings, replaces: a.id }));
  avisoConvocacao(ctx, batch, fed, uid, a.event, a.function, respondBy);
  if (R.LIVE_ASSIGNMENT.includes(a.status)) {
    f.aviso(ctx, batch, a.referee_uid, { title: tx('Sua escala em {evento} mudou', { evento: texto(a.event.name, 120) }), message: tx('A {sigla} escalou outra pessoa para a sua função. Você não precisa ir.', { sigla: sigla(fed) }), link: LINK_ARBITRO });
  }
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_referee_reassign', { federation_id: fed.id, assignment_id: a.id, new_assignment_id: novoRef.id, from: a.referee_uid, to: uid });
  return { ok: true, assignmentId: novoRef.id, warnings };
}

async function cancel(ctx, actor, data, c) {
  exigeEquipe(c);
  const { fed } = c;
  const { ref, a } = await escala(ctx, fed, data.assignmentId);
  if (!R.LIVE_ASSIGNMENT.includes(a.status)) falha('failed-precondition', 'Só se cancela escala em aberto.');
  const reason = texto(data.reason, R.LIMITS.REASON_MAX);
  if (reason.length < 3) falha('invalid-argument', 'Diga o motivo: ele vai no aviso ao árbitro.');
  const batch = ctx.db.batch();
  batch.update(ref, { status: R.ASSIGNMENT_STATUS.CANCELLED, cancel_reason: reason, updated_at_ms: ctx.now, updated_by: actor.uid });
  f.aviso(ctx, batch, a.referee_uid, { title: tx('Escala cancelada: {evento}', { evento: texto(a.event.name, 120) }), message: tx('A {sigla} cancelou a sua escala. Motivo: {motivo}', { sigla: sigla(fed), motivo: reason }), link: LINK_ARBITRO });
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_referee_cancel', { federation_id: fed.id, assignment_id: a.id, reason });
  return { ok: true };
}

/** Fecha o evento: confirmado → atuou (ou não compareceu); convocado sem resposta → cancelado. */
async function closeEvent(ctx, actor, data, c) {
  exigeEquipe(c);
  const { fed, hoje } = c;
  const key = R.eventKey({ kind: data.event && data.event.kind, id: texto(data.event && data.event.id, 80) });
  const lista = (await ctx.db.collection(ASSIGN).where('federation_id', '==', fed.id).where('event_key', '==', key).get()).docs.map((d) => ({ ref: d.ref, a: { id: d.id, ...d.data() } }));
  if (!lista.length) falha('not-found', 'Este evento não tem escala.');
  if (!R.assignmentState(lista[0].a, hoje).started) falha('failed-precondition', 'O evento ainda não começou.');
  const results = data.results && typeof data.results === 'object' ? data.results : {};
  const batch = ctx.db.batch();
  const conta = { done: 0, no_show: 0, cancelled: 0 };
  const tocados = [];
  lista.forEach(({ ref, a }) => {
    if (a.status === R.ASSIGNMENT_STATUS.CONFIRMED) {
      const st = results[a.id] === 'no_show' ? R.ASSIGNMENT_STATUS.NO_SHOW : R.ASSIGNMENT_STATUS.DONE;
      batch.update(ref, { status: st, closed_at_ms: ctx.now, updated_at_ms: ctx.now, updated_by: actor.uid });
      conta[st] += 1;
      tocados.push(a.referee_uid);
    } else if (a.status === R.ASSIGNMENT_STATUS.INVITED) {
      batch.update(ref, { status: R.ASSIGNMENT_STATUS.CANCELLED, cancel_reason: 'Sem resposta até o evento.', updated_at_ms: ctx.now, updated_by: actor.uid });
      conta.cancelled += 1;
    }
  });
  await batch.commit();
  await recontar(ctx, fed, tocados);
  await f.auditoria(ctx, actor, 'federation_referee_close_event', { federation_id: fed.id, event_key: key, ...conta });
  return { ok: true, ...conta };
}

/** O AVALIADOR escalado (confirmado ou que atuou) neste evento, nesta federação. */
async function avaliadorDoEvento(ctx, fed, uid, eventKey) {
  const snap = await ctx.db.collection(ASSIGN).where('federation_id', '==', fed.id).where('event_key', '==', eventKey).get();
  return snap.docs.some((d) => { const x = d.data(); return x.referee_uid === uid && x.function === 'evaluator' && ['confirmed', 'done'].includes(x.status); });
}

async function evaluate(ctx, actor, data, c) {
  const { fed } = c;
  const { ref, a } = await escala(ctx, fed, data.assignmentId);
  const equipe = podeEquipe(c.perms);
  if (!equipe) {
    if (a.referee_uid === actor.uid || a.function === 'evaluator' || !(await avaliadorDoEvento(ctx, fed, actor.uid, a.event_key))) falha('permission-denied', 'Só a equipe ou o avaliador escalado neste evento avaliam.');
    if (a.evaluation && a.evaluation.by !== actor.uid) falha('failed-precondition', 'Esta atuação já foi avaliada por outra pessoa.');
  }
  if (a.status !== R.ASSIGNMENT_STATUS.DONE) falha('failed-precondition', 'Só se avalia quem atuou (feche o evento antes).');
  const r = R.validateEvaluation({ scores: data.scores, comment: data.comment });
  if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0]);
  const batch = ctx.db.batch();
  batch.update(ref, { evaluation: { by: actor.uid, by_name: texto(actor.name, 80), by_role: equipe ? 'staff' : 'evaluator', ...r.value, at_ms: ctx.now }, updated_at_ms: ctx.now });
  if (!a.evaluation) f.aviso(ctx, batch, a.referee_uid, { title: tx('Avaliação da sua atuação: {evento}', { evento: texto(a.event.name, 120) }), message: tx('A {sigla} registrou a avaliação. Veja as notas e o comentário em Minha área → Federações.', { sigla: sigla(fed) }), link: LINK_ARBITRO });
  await batch.commit();
  await recontar(ctx, fed, [a.referee_uid]);
  await f.auditoria(ctx, actor, 'federation_referee_evaluate', { federation_id: fed.id, assignment_id: a.id, avg: r.value.avg, corrected: Boolean(a.evaluation), by_role: equipe ? 'staff' : 'evaluator' });
  return { ok: true, avg: r.value.avg };
}

async function markPaid(ctx, actor, data, c) {
  exigeEquipe(c);
  const { fed } = c;
  const ids = [...new Set((Array.isArray(data.assignmentIds) ? data.assignmentIds : []).map((x) => texto(x, 80)).filter(Boolean))];
  if (!ids.length || ids.length > 100) falha('invalid-argument', 'Escolha de 1 a 100 diárias.');
  const pagar = data.paid !== false;
  const lidas = [];
  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop
    const e = await escala(ctx, fed, id);
    if (e.a.status !== R.ASSIGNMENT_STATUS.DONE || R.amountOf(e.a) <= 0) falha('failed-precondition', 'Só se paga diária de quem atuou, com valor.');
    lidas.push(e);
  }
  const batch = ctx.db.batch();
  let n = 0;
  lidas.forEach(({ ref, a }) => {
    if (pagar === Boolean(a.paid_at_ms)) return;
    batch.update(ref, pagar ? { paid_at_ms: ctx.now, paid_by: actor.uid, updated_at_ms: ctx.now } : { paid_at_ms: null, paid_by: null, updated_at_ms: ctx.now });
    if (pagar) f.aviso(ctx, batch, a.referee_uid, { title: tx('Diária paga: {evento}', { evento: texto(a.event.name, 120) }), message: tx('A {sigla} registrou o pagamento de {valor}.', { sigla: sigla(fed), valor: reais(R.amountOf(a)) }), link: LINK_ARBITRO });
    n += 1;
  });
  if (n) await batch.commit();
  await f.auditoria(ctx, actor, pagar ? 'federation_referee_paid' : 'federation_referee_unpaid', { federation_id: fed.id, assignment_ids: ids, changed: n });
  return { ok: true, changed: n };
}

async function rules(ctx, actor, data, c) {
  exigeEquipe(c);
  const r = R.validateRefereeRules(data.rules || {});
  if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0]);
  await ctx.db.collection(f.C.federations).doc(c.fed.id).update({ referee_rules: r.value, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  const quadro = await ctx.db.collection(REFS).where('federation_id', '==', c.fed.id).get();
  await recontar(ctx, { ...c.fed, referee_rules: r.value }, quadro.docs.map((d) => d.data().user_id).filter(Boolean));
  await f.auditoria(ctx, actor, 'federation_referee_rules', { federation_id: c.fed.id, levels: r.value.levels.length, respond_days: r.value.respond_days, crew_visible: r.value.crew_visible });
  return { ok: true, rules: r.value };
}

/* ----------------------------------------------------------- o árbitro -- */

async function minhaEscala(ctx, actor, c, id) {
  const e = await escala(ctx, c.fed, id);
  if (e.a.referee_uid !== actor.uid) falha('not-found', 'Escala não encontrada.');
  return e;
}

async function respond(ctx, actor, data, c) {
  const { fed, hoje } = c;
  const { ref, a } = await minhaEscala(ctx, actor, c, data.assignmentId);
  const st = R.assignmentState(a, hoje);
  if (!st.canRespond) falha('failed-precondition', 'Esta escala não espera mais a sua resposta.');
  const aceitar = data.accept === true;
  const declarado = Boolean(data.conflict && data.conflict.declared === true);
  const motivoConflito = texto(data.conflict && data.conflict.reason, R.LIMITS.CONFLICT_MAX);
  if (declarado && motivoConflito.length < 5) falha('invalid-argument', 'Diga qual é o conflito de interesse.');
  if (aceitar && declarado) falha('invalid-argument', 'Com conflito de interesse declarado, não se aceita a escala: recuse.');
  if (aceitar && a.status === R.ASSIGNMENT_STATUS.CONFIRMED) falha('failed-precondition', 'Você já confirmou esta escala.');
  if (aceitar) {
    const { referee } = await cadastro(ctx, fed, actor.uid);
    if (!referee || referee.status !== R.REFEREE_STATUS.ACTIVE) falha('failed-precondition', 'Você não está ativo no quadro de arbitragem desta federação.');
    if (await semCredencial(ctx, fed, c.rules, hoje, actor.uid, a.function)) falha('failed-precondition', 'Sua credencial de árbitro venceu ou falta: renove para confirmar a escala.');
  }
  const batch = ctx.db.batch();
  batch.update(ref, aceitar
    ? { status: R.ASSIGNMENT_STATUS.CONFIRMED, responded_at_ms: ctx.now, updated_at_ms: ctx.now }
    : { status: R.ASSIGNMENT_STATUS.DECLINED, decline_reason: texto(data.reason, R.LIMITS.REASON_MAX), conflict: declarado ? { declared: true, reason: motivoConflito } : null, previous_status: a.status, responded_at_ms: ctx.now, updated_at_ms: ctx.now });
  if (!aceitar) {
    const equipe = await f.staffIds(ctx, fed.id, 'courses');
    const params = { nome: texto(a.referee_name, 80), evento: texto(a.event.name, 120) };
    equipe.filter((u) => u && u !== actor.uid).forEach((u) => f.aviso(ctx, batch, u, {
      title: declarado ? tx('{nome} declarou conflito e recusou: {evento}', params) : tx('{nome} recusou a escala: {evento}', params),
      message: tx('{funcao}. Escale outra pessoa em Arbitragem → Escalas.', { funcao: FUNCAO[a.function] || a.function }),
      link: linkEquipe(fed),
    }));
  }
  await batch.commit();
  await f.auditoria(ctx, actor, aceitar ? 'federation_referee_confirm' : 'federation_referee_decline', { federation_id: fed.id, assignment_id: a.id, conflict: declarado });
  return { ok: true, status: aceitar ? 'confirmed' : 'declined' };
}

async function report(ctx, actor, data, c) {
  const { fed, hoje } = c;
  const { ref, a } = await minhaEscala(ctx, actor, c, data.assignmentId);
  if (!R.assignmentState(a, hoje).canReport) falha('failed-precondition', 'A súmula é enviada por quem foi confirmado, a partir do dia do evento.');
  const r = R.validateReport(data.text);
  if (!r.ok) falha('invalid-argument', r.error);
  const batch = ctx.db.batch();
  batch.update(ref, { report: { text: r.value, at_ms: ctx.now, first_at_ms: (a.report && a.report.first_at_ms) || ctx.now }, updated_at_ms: ctx.now });
  if (!a.report) {
    const equipe = await f.staffIds(ctx, fed.id, 'courses');
    equipe.filter((u) => u && u !== actor.uid).forEach((u) => f.aviso(ctx, batch, u, {
      title: tx('Súmula recebida: {evento}', { evento: texto(a.event.name, 120) }), message: tx('{nome} enviou a súmula. Veja em Arbitragem → Avaliações e súmulas.', { nome: texto(a.referee_name, 80) }), link: linkEquipe(fed),
    }));
  }
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_referee_report', { federation_id: fed.id, assignment_id: a.id, corrected: Boolean(a.report) });
  return { ok: true };
}

async function self(ctx, actor, data, c) {
  const { fed, hoje } = c;
  const { ref, referee } = await cadastro(ctx, fed, actor.uid);
  if (!referee) falha('not-found', 'Você não está no quadro de arbitragem desta federação.');
  const patch = { updated_at_ms: ctx.now };
  if (Array.isArray(data.unavailable)) patch.unavailable = R.normalizeUnavailable(data.unavailable, hoje);
  if (typeof data.publicListing === 'boolean') patch.public_listing = data.publicListing;
  await ref.update(patch);
  return { ok: true, unavailable: patch.unavailable, public_listing: patch.public_listing };
}

async function crew(ctx, actor, data, c) {
  const { fed, rules: regra } = c;
  const { a } = await minhaEscala(ctx, actor, c, data.assignmentId);
  if (!regra.crew_visible && !podeEquipe(c.perms)) falha('failed-precondition', 'A federação não mostra a escala inteira do evento.');
  const lista = (await ctx.db.collection(ASSIGN).where('federation_id', '==', fed.id).where('event_key', '==', a.event_key).get()).docs.map((d) => d.data());
  const vivos = lista.filter((x) => ['invited', 'confirmed', 'done'].includes(x.status));
  return { ok: true, crew: vivos.map((x) => ({ name: texto(x.referee_name, 120), function: x.function, status: x.status === 'done' ? 'confirmed' : x.status })) };
}

/** O avaliador escalado vê quem atuou no evento para avaliar (nunca valores nem conflitos). */
async function evaluatorCrew(ctx, actor, data, c) {
  const { fed } = c;
  const { a } = await minhaEscala(ctx, actor, c, data.assignmentId);
  if (a.function !== 'evaluator' || !['confirmed', 'done'].includes(a.status)) falha('failed-precondition', 'Só o avaliador confirmado no evento avalia a equipe.');
  const lista = (await ctx.db.collection(ASSIGN).where('federation_id', '==', fed.id).where('event_key', '==', a.event_key).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  return {
    ok: true,
    crew: lista.filter((x) => x.referee_uid !== actor.uid && x.function !== 'evaluator' && ['confirmed', 'done'].includes(x.status)).map((x) => ({
      id: x.id, name: texto(x.referee_name, 120), function: x.function, status: x.status,
      evaluation: x.evaluation && x.evaluation.by === actor.uid ? { scores: x.evaluation.scores, comment: x.evaluation.comment || '', avg: x.evaluation.avg } : null,
      evaluated_by_other: Boolean(x.evaluation && x.evaluation.by !== actor.uid),
    })),
  };
}

/** O árbitro pede o próximo nível (com requisitos, só quando cumpre). */
async function promotionRequest(ctx, actor, data, c) {
  const { fed, rules: regra, hoje } = c;
  const { ref, referee } = await cadastro(ctx, fed, actor.uid);
  if (!referee || referee.status !== R.REFEREE_STATUS.ACTIVE) falha('failed-precondition', 'Você não está ativo no quadro de arbitragem desta federação.');
  if (referee.promotion_request) falha('failed-precondition', 'Você já pediu a promoção: a equipe vai responder.');
  const suas = (await ctx.db.collection(ASSIGN).where('federation_id', '==', fed.id).where('referee_uid', '==', actor.uid).get()).docs.map((d) => d.data());
  const p = R.promotionProgress(referee, suas, regra, hoje);
  if (!p.next) falha('failed-precondition', 'Você já está no nível mais alto do quadro.');
  if (p.met === false) falha('failed-precondition', 'Você ainda não cumpre os requisitos do próximo nível.');
  const note = texto(data.note, R.LIMITS.REASON_MAX);
  const batch = ctx.db.batch();
  batch.update(ref, { promotion_request: { to: p.next.id, at: hoje, at_ms: ctx.now, met: p.met, note }, promotion_progress: p, updated_at_ms: ctx.now });
  const equipe = await f.staffIds(ctx, fed.id, 'courses');
  equipe.filter((u) => u && u !== actor.uid).forEach((u) => f.aviso(ctx, batch, u, {
    title: tx('{nome} pediu promoção na arbitragem', { nome: texto(referee.name, 80) }),
    message: tx('Para {nivel}. Decida em Arbitragem → Quadro.', { nivel: p.next.label }),
    link: linkEquipe(fed),
  }));
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_referee_promotion_request', { federation_id: fed.id, to: p.next.id, met: p.met });
  return { ok: true, to: p.next.id };
}

/** A equipe recusa o pedido de promoção (com motivo, que vai no aviso). */
async function promotionDecline(ctx, actor, data, c) {
  exigeEquipe(c);
  const { fed } = c;
  const { ref, referee } = await cadastro(ctx, fed, data.userId);
  if (!referee || !referee.promotion_request) falha('failed-precondition', 'Não há pedido de promoção em aberto.');
  const reason = texto(data.reason, R.LIMITS.REASON_MAX);
  if (reason.length < 3) falha('invalid-argument', 'Diga o motivo: ele vai no aviso ao árbitro.');
  const batch = ctx.db.batch();
  batch.update(ref, {
    promotion_request: null,
    level_history: [...(Array.isArray(referee.level_history) ? referee.level_history : []), { from: referee.level || '', to: referee.promotion_request.to, at: c.hoje, at_ms: ctx.now, by: actor.uid, reason, declined: true }].slice(-R.LIMITS.LEVEL_HISTORY_MAX),
    updated_at_ms: ctx.now,
  });
  f.aviso(ctx, batch, referee.user_id, { title: tx('Pedido de promoção na arbitragem da {sigla}', { sigla: sigla(fed) }), message: tx('A equipe não aprovou agora. Motivo: {motivo}', { motivo: reason }), link: LINK_ARBITRO });
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_referee_promotion_decline', { federation_id: fed.id, user_id: referee.user_id, reason });
  return { ok: true };
}

const EQUIPE = { roster_add: rosterAdd, roster_update: rosterUpdate, roster_remove: rosterRemove, assign, reassign, cancel, close_event: closeEvent, mark_paid: markPaid, rules, promotion_decline: promotionDecline };
const ARBITRO = { respond, report, self, crew, evaluate, evaluator_crew: evaluatorCrew, promotion_request: promotionRequest };

async function referees(ctx, actor, data = {}) {
  const fn = EQUIPE[data.action] || ARBITRO[data.action];
  if (!fn) falha('invalid-argument', 'Ação desconhecida.');
  const c = await contexto(ctx, actor, data);
  return fn(ctx, actor, data, c);
}

/* ------------------------------------------------------------ público -- */

/**
 * O que o público vê (também sem conta): o quadro e quem apita cada evento
 * público — ou só o de um torneio (`tournamentId`). Federação oculta: só a
 * equipe e quem é filiado (como `fedSees`).
 */
async function publico(ctx, actor, data = {}) {
  const nada = { available: false, board: [], crews: [], crew: [] };
  if (!(await f.flagLigada(ctx))) return nada;
  const snap = await ctx.db.collection(f.C.federations).doc(texto(data.federationId, 80)).get();
  if (!snap.exists) return nada;
  const fed = { id: snap.id, ...snap.data() };
  if (fed.status !== 'approved' || !(fed.modules && fed.modules.referees === true)) return nada;
  if (!f.publicada(fed)) {
    if (!actor) return nada;
    const perms = await f.staffPerms(ctx, fed.id, actor);
    const ms = await ctx.db.collection(f.C.members).doc(`${fed.id}_${actor.uid}`).get();
    if (!perms.length && !(ms.exists && ms.data().status === 'active')) return nada;
  }
  const regra = R.normalizeRefereeRules(fed.referee_rules);
  const daFed = ctx.db.collection(ASSIGN).where('federation_id', '==', fed.id);
  if (data.tournamentId) {
    const ts = await ctx.db.collection('tournaments').doc(texto(data.tournamentId, 80)).get();
    const tt = ts.exists ? { id: ts.id, ...ts.data() } : null;
    if (!R.isScalableTournament(tt, fed.id) || tt.visibility !== 'public') return nada;
    const lista = (await daFed.where('event_key', '==', `tournament_${tt.id}`).get()).docs.map((d) => d.data());
    return { ...nada, available: true, crew: R.publicCrew(lista) };
  }
  const [refs, escalas] = await Promise.all([ctx.db.collection(REFS).where('federation_id', '==', fed.id).get(), daFed.get()]);
  const desde = R.addDaysISO(R.isoDateBR(ctx.now), -30);
  const porEvento = new Map();
  escalas.docs.map((d) => d.data())
    .filter((a) => a.event && a.event.public === true && ['confirmed', 'done'].includes(a.status) && (a.event.end_date || a.event.date) >= desde)
    .forEach((a) => { if (!porEvento.has(a.event_key)) porEvento.set(a.event_key, { event: a.event, lista: [] }); porEvento.get(a.event_key).lista.push(a); });
  const crews = [...porEvento.values()]
    .sort((a, b) => String(a.event.date).localeCompare(String(b.event.date)))
    .slice(0, 12)
    .map(({ event, lista }) => ({ event: { kind: event.kind, id: event.id, name: event.name, date: event.date, end_date: event.end_date, city: event.city }, people: R.publicCrew(lista) }));
  return { ...nada, available: true, board: R.publicBoard(refs.docs.map((d) => d.data()), regra), crews };
}

/* -------------------------------------------------------------- sweep -- */

/** Lembra quem foi convocado e ainda não respondeu, um dia antes do prazo (uma vez). */
async function sweep(ctx) {
  if (!(await f.flagLigada(ctx))) return { skipped: 'flag' };
  const hoje = R.isoDateBR(ctx.now);
  const amanha = R.addDaysISO(hoje, 1);
  const abertas = await ctx.db.collection(ASSIGN).where('status', '==', 'invited').get();
  const feds = {};
  const fedDe = async (id) => {
    if (!(id in feds)) { const s = await ctx.db.collection(f.C.federations).doc(id).get(); feds[id] = s.exists ? { id: s.id, ...s.data() } : null; }
    return feds[id];
  };
  let batch = ctx.db.batch();
  let n = 0;
  let lembretes = 0;
  for (const d of abertas.docs) {
    const a = d.data();
    if (a.reminded || a.respond_by !== amanha) continue;
    // eslint-disable-next-line no-await-in-loop
    const fed = await fedDe(a.federation_id);
    if (!fed || !(fed.modules && fed.modules.referees === true)) continue;
    f.aviso(ctx, batch, a.referee_uid, {
      title: tx('Responda até amanhã: {evento}', { evento: texto(a.event && a.event.name, 120) }),
      message: tx('A {sigla} espera a sua resposta à convocação ({funcao}, {data}).', { sigla: sigla(fed), funcao: FUNCAO[a.function] || a.function, data: br(a.event && a.event.date) }),
      link: LINK_ARBITRO,
    });
    batch.update(d.ref, { reminded: true });
    lembretes += 1; n += 2;
    if (n >= 400) {
      // eslint-disable-next-line no-await-in-loop
      await batch.commit(); batch = ctx.db.batch(); n = 0;
    }
  }
  if (n) await batch.commit();
  const cred = await sweepCredenciais(ctx, hoje, fedDe);
  if (ctx.logger) ctx.logger.info('Arbitragem: varredura diária.', { lembretes, ...cred });
  return { lembretes, ...cred };
}

/**
 * A credencial de cada árbitro ativo: avisa a que vai vencer (uma vez por
 * validade), tira a vencida das escalas futuras em aberto quando a regra é
 * `block_and_release` (uma vez por validade) e atualiza a cópia de leitura.
 */
async function sweepCredenciais(ctx, hoje, fedDe) {
  const ativos = await ctx.db.collection(REFS).where('status', '==', 'active').get();
  let avisos = 0;
  let liberadas = 0;
  for (const d of ativos.docs) {
    const r = { id: d.id, ...d.data() };
    // eslint-disable-next-line no-await-in-loop
    const fed = await fedDe(r.federation_id);
    if (!fed || fed.status !== 'approved' || !(fed.modules && fed.modules.referees === true)) continue;
    const rules = R.normalizeRefereeRules(fed.referee_rules);
    // eslint-disable-next-line no-await-in-loop
    const until = await credencialAte(ctx, fed, r.user_id);
    const st = R.credentialStanding(until, rules, hoje);
    const marca = until == null ? 'none' : (until || 'forever');
    const batch = ctx.db.batch();
    const patch = {};
    if (until !== r.credential_until) patch.credential_until = until;
    if (JSON.stringify(rules.credential_policy) !== JSON.stringify(r.credential_policy || null)) patch.credential_policy = rules.credential_policy;
    if (rules.credential_policy.required && st.state === R.CREDENTIAL_STANDING.EXPIRING && r.cred_warned_for !== marca) {
      patch.cred_warned_for = marca;
      f.aviso(ctx, batch, r.user_id, {
        title: tx('Sua credencial de árbitro da {sigla} vence em {data}', { sigla: sigla(fed), data: br(until) }),
        message: rules.credential_policy.on_expire === 'warn'
          ? tx('Faça a reciclagem para continuar em dia.')
          : tx('Faça a reciclagem: vencida, você deixa de receber convocações.'),
        link: LINK_ARBITRO,
      });
      avisos += 1;
    }
    if (st.releases && r.cred_released_for !== marca) {
      patch.cred_released_for = marca;
      // eslint-disable-next-line no-await-in-loop
      const futuras = (await ctx.db.collection(ASSIGN).where('federation_id', '==', fed.id).where('referee_uid', '==', r.user_id).get()).docs
        .filter((x) => { const a = x.data(); return R.LIVE_ASSIGNMENT.includes(a.status) && R.CREDENTIAL_FUNCTIONS.includes(a.function) && !R.assignmentState(a, hoje).started; });
      futuras.forEach((x) => batch.update(x.ref, { status: R.ASSIGNMENT_STATUS.CANCELLED, cancel_reason: 'Credencial de árbitro vencida.', updated_at_ms: ctx.now, updated_by: 'system' }));
      if (futuras.length) {
        f.aviso(ctx, batch, r.user_id, {
          title: tx('Sua credencial de árbitro da {sigla} venceu', { sigla: sigla(fed) }),
          message: tx('Pela regra da federação, você saiu de {n} escala(s) futura(s). Renove para voltar a ser convocado.', { n: futuras.length }),
          link: LINK_ARBITRO,
        });
        // eslint-disable-next-line no-await-in-loop
        const equipe = await f.staffIds(ctx, fed.id, 'courses');
        equipe.filter(Boolean).forEach((u) => f.aviso(ctx, batch, u, {
          title: tx('{nome} saiu das escalas: credencial vencida', { nome: texto(r.name, 80) }),
          message: tx('{n} escala(s) futura(s) cancelada(s). Escale outra pessoa em Arbitragem → Escalas.', { n: futuras.length }),
          link: linkEquipe(fed),
        }));
        liberadas += futuras.length;
      }
    }
    if (!Object.keys(patch).length) continue;
    batch.update(d.ref, { ...patch, updated_at_ms: ctx.now });
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
  return { credencial_avisos: avisos, escalas_liberadas: liberadas };
}

module.exports = { referees, publico, sweep, REFS, ASSIGN };
