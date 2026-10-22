/**
 * Arbitragem da federação — a conta PURA (sem banco): a régua
 * (`federations.referee_rules`), os eventos escaláveis, os alertas de uma
 * convocação, a situação de uma escala, a avaliação, as estatísticas do
 * árbitro e o que o público pode ver.
 *
 * ⚠️ CÓPIA de `src/modules/federations/domain/referees.js` (o pacote de
 * Functions é publicado isolado), com paridade em
 * `federationReferees.parity.test.js`. Os ids são GRAVADOS: nunca renomeie.
 */
const REFEREE_FUNCTIONS = Object.freeze(['referee', 'head_referee', 'line_judge', 'technical_delegate', 'tournament_director']);
const REFEREE_STATUS = Object.freeze({ ACTIVE: 'active', INACTIVE: 'inactive', SUSPENDED: 'suspended' });
const ASSIGNMENT_STATUS = Object.freeze({
  INVITED: 'invited', CONFIRMED: 'confirmed', DECLINED: 'declined', REPLACED: 'replaced', DONE: 'done', NO_SHOW: 'no_show', CANCELLED: 'cancelled',
});
const LIVE_ASSIGNMENT = Object.freeze(['invited', 'confirmed']);
const WARNING = Object.freeze({ UNAVAILABLE: 'unavailable', SAME_DAY: 'same_day', ATHLETE: 'athlete', LEVEL_BELOW: 'level_below' });
const EVAL_CRITERIA = Object.freeze(['rules', 'positioning', 'communication', 'punctuality', 'presentation']);
const DEFAULT_REFEREE_LEVELS = Object.freeze([
  { id: 'trainee', label: 'Trainee' }, { id: 'l1', label: 'Nível 1' }, { id: 'l2', label: 'Nível 2' }, { id: 'certified', label: 'Certificado' },
]);
const SCALABLE_EVENT_KINDS = Object.freeze(['competition', 'selection', 'sport_other']);
const LIMITS = Object.freeze({
  UNAVAILABLE_MAX: 60, REPORT_MAX: 4000, NOTES_MAX: 2000, COMMENT_MAX: 1000, CONFLICT_MAX: 500, REASON_MAX: 500,
  ASSIGN_BATCH_MAX: 20, LEVELS_MAX: 8, LEVEL_LABEL_MAX: 40, NEED_MAX: 50, FEE_MAX_CENTS: 1000000, RESPOND_DAYS_MAX: 30, CREDENTIALS_MAX: 10, EVENT_DAYS_MAX: 31,
});
const RESPOND_DAYS_DEFAULT = 3;

/* --------------------------------------------------------------- datas -- */

const ISO = /^\d{4}-\d{2}-\d{2}$/;
function isIsoDate(s) {
  if (!ISO.test(String(s || ''))) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
function addDaysISO(iso, n) {
  if (!isIsoDate(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
const isoDateBR = (ms = Date.now()) => new Date(ms - 3 * 3600000).toISOString().slice(0, 10);

function eventDays(event = {}) {
  if (!event || !isIsoDate(event.date)) return [];
  const fim = isIsoDate(event.end_date) && event.end_date >= event.date ? event.end_date : event.date;
  const out = [];
  for (let d = event.date; d <= fim && out.length < LIMITS.EVENT_DAYS_MAX; d = addDaysISO(d, 1)) out.push(d);
  return out;
}
const sobrepoe = (a, b) => { const da = new Set(eventDays(a)); return eventDays(b).some((d) => da.has(d)); };

/* --------------------------------------------------------------- régua -- */

const texto = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const inteiro = (v, min, max) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min; };
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);

function normalizeRefereeRules(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const vistos = new Set();
  const levels = (Array.isArray(r.levels) ? r.levels : [])
    .map((l) => ({ id: slug(l && l.id), label: texto(l && l.label, LIMITS.LEVEL_LABEL_MAX) }))
    .filter((l) => l.id && l.label && !vistos.has(l.id) && vistos.add(l.id))
    .slice(0, LIMITS.LEVELS_MAX);
  const lv = levels.length ? levels : DEFAULT_REFEREE_LEVELS.map((l) => ({ ...l }));
  const ids = lv.map((l) => l.id);
  const porFuncao = (fonte, fn) => REFEREE_FUNCTIONS.reduce((acc, f) => { const v = fn(fonte && typeof fonte === 'object' ? fonte[f] : undefined); if (v !== undefined) acc[f] = v; return acc; }, {});
  return {
    levels: lv,
    min_level_by_function: porFuncao(r.min_level_by_function, (v) => (ids.includes(v) ? v : undefined)),
    fee_default_cents: porFuncao(r.fee_default_cents, (v) => (v == null || v === '' ? undefined : inteiro(v, 0, LIMITS.FEE_MAX_CENTS))),
    needs: porFuncao(r.needs, (v) => (v == null || v === '' ? undefined : inteiro(v, 0, LIMITS.NEED_MAX))),
    respond_days: r.respond_days == null || r.respond_days === '' ? RESPOND_DAYS_DEFAULT : inteiro(r.respond_days, 1, LIMITS.RESPOND_DAYS_MAX),
    crew_visible: r.crew_visible === true,
  };
}

function validateRefereeRules(input = {}) {
  const errors = {};
  const brutos = Array.isArray(input.levels) ? input.levels : [];
  if (brutos.length === 0) errors.levels = 'Cadastre pelo menos um nível.';
  else if (brutos.length > LIMITS.LEVELS_MAX) errors.levels = `No máximo ${LIMITS.LEVELS_MAX} níveis.`;
  else if (brutos.some((l) => !slug(l && l.id) || !texto(l && l.label, LIMITS.LEVEL_LABEL_MAX))) errors.levels = 'Todo nível precisa de nome.';
  else if (new Set(brutos.map((l) => slug(l.id))).size !== brutos.length) errors.levels = 'Há dois níveis com o mesmo código.';
  return { ok: Object.keys(errors).length === 0, errors, value: normalizeRefereeRules(input) };
}

const levelLabel = (rules, id) => (normalizeRefereeRules(rules).levels.find((l) => l.id === id) || {}).label || '';
const levelRank = (rules, id) => normalizeRefereeRules(rules).levels.findIndex((l) => l.id === id);
function meetsMinLevel(rules, fn, level) {
  const min = normalizeRefereeRules(rules).min_level_by_function[fn];
  if (!min) return true;
  const r = levelRank(rules, level);
  return r >= 0 && r >= levelRank(rules, min);
}

/* -------------------------------------------------------------- quadro -- */

function validateRosterInput(input = {}, rules) {
  const regra = normalizeRefereeRules(rules);
  const errors = {};
  const level = String(input.level || '');
  if (!regra.levels.some((l) => l.id === level)) errors.level = 'Escolha o nível.';
  const functions = [...new Set((Array.isArray(input.functions) ? input.functions : []).filter((f) => REFEREE_FUNCTIONS.includes(f)))];
  if (functions.length === 0) errors.functions = 'Escolha pelo menos uma função.';
  const status = Object.values(REFEREE_STATUS).includes(input.status) ? input.status : REFEREE_STATUS.ACTIVE;
  const credentialIds = [...new Set((Array.isArray(input.credential_ids) ? input.credential_ids : []).map((c) => String(c || '')).filter((c) => /^[A-Za-z0-9_-]{1,120}$/.test(c)))].slice(0, LIMITS.CREDENTIALS_MAX);
  const since = isIsoDate(input.since) ? input.since : '';
  return { ok: Object.keys(errors).length === 0, errors, value: { level, functions, status, credential_ids: credentialIds, since } };
}

function normalizeUnavailable(list, hoje) {
  return [...new Set((Array.isArray(list) ? list : []).map(String).filter((d) => isIsoDate(d) && d >= hoje))].sort().slice(0, LIMITS.UNAVAILABLE_MAX);
}

/* ------------------------------------------------------------- eventos -- */

const isScalableTournament = (tt, fedId) => Boolean(tt) && tt.federation_id === fedId && tt.archived !== true
  && Boolean(tt.federation_sanction) && tt.federation_sanction.status === 'approved' && !['draft', 'cancelled'].includes(tt.status);

function eventFromTournament(tt) {
  const date = String(tt.starts_at || tt.start_date || '').slice(0, 10);
  if (!isIsoDate(date)) return null;
  const fim = String(tt.ends_at || tt.end_date || '').slice(0, 10);
  return {
    kind: 'tournament', id: String(tt.id), name: texto(tt.name || 'Torneio', 160), date, end_date: isIsoDate(fim) && fim >= date ? fim : date,
    city: texto(tt.city, 80), public: tt.visibility === 'public',
  };
}

const isScalableAgendaEvent = (ev, fedId) => Boolean(ev) && ev.federation_id === fedId && SCALABLE_EVENT_KINDS.includes(ev.kind) && (ev.status || 'scheduled') === 'scheduled';

function eventFromAgenda(ev) {
  if (!isIsoDate(ev.date)) return null;
  return {
    kind: 'event', id: String(ev.id), name: texto(ev.title || 'Evento', 160), date: ev.date, end_date: isIsoDate(ev.end_date) && ev.end_date >= ev.date ? ev.end_date : ev.date,
    city: texto(ev.place && ev.place.city, 80), public: ev.visibility === 'public',
  };
}

const eventKey = (event) => (event ? `${event.kind}_${event.id}` : '');

/** Quem está inscrito como atleta (inscrição viva) — conta, dupla e time. */
function athleteUidsOf(registrations = []) {
  const out = new Set();
  (registrations || []).forEach((r) => {
    if (!r || ['cancelled', 'withdrawn'].includes(r.status)) return;
    [r.user_id, r.player_a_user_id, r.player_b_user_id, ...(Array.isArray(r.members) ? r.members.map((m) => m && m.user_id) : [])].forEach((u) => { if (u) out.add(String(u)); });
  });
  return out;
}

/* ---------------------------------------------------------- convocação -- */

function assignmentWarnings({ referee = {}, event, fn, assignments = [], athleteUids = [], rules } = {}) {
  const out = [];
  const dias = eventDays(event);
  const fora = dias.filter((d) => (referee.unavailable || []).includes(d));
  if (fora.length) out.push({ kind: WARNING.UNAVAILABLE, detail: fora.join(',') });
  const outra = (assignments || []).find((a) => LIVE_ASSIGNMENT.includes(a.status) && a.event && eventKey(a.event) !== eventKey(event) && sobrepoe(a.event, event));
  if (outra) out.push({ kind: WARNING.SAME_DAY, detail: texto(outra.event.name, 160) });
  const atletas = athleteUids instanceof Set ? athleteUids : new Set(athleteUids || []);
  if (event && event.kind === 'tournament' && referee.user_id && atletas.has(referee.user_id)) out.push({ kind: WARNING.ATHLETE, detail: '' });
  if (!meetsMinLevel(rules, fn, referee.level)) out.push({ kind: WARNING.LEVEL_BELOW, detail: normalizeRefereeRules(rules).min_level_by_function[fn] || '' });
  return out;
}

function assignBlocker({ referee, event, fn, assignments = [] }) {
  if (!referee) return 'Esta pessoa não está no quadro de arbitragem.';
  if (referee.status !== REFEREE_STATUS.ACTIVE) return 'O árbitro não está ativo no quadro.';
  if (!(referee.functions || []).includes(fn)) return 'O árbitro não atua nesta função.';
  if ((assignments || []).some((a) => LIVE_ASSIGNMENT.includes(a.status) && eventKey(a.event) === eventKey(event))) return 'O árbitro já está escalado neste evento.';
  return '';
}

function defaultRespondBy(event, rules, hoje) {
  const alvo = addDaysISO(hoje, normalizeRefereeRules(rules).respond_days);
  const vespera = event && isIsoDate(event.date) ? addDaysISO(event.date, -1) : alvo;
  const r = alvo < vespera ? alvo : vespera;
  return r < hoje ? hoje : r;
}

function normalizeCents(v) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > LIMITS.FEE_MAX_CENTS || Math.trunc(n) !== n) return null;
  return n;
}

const amountOf = (a = {}) => (Math.trunc(Number(a.fee_cents)) || 0) + (Math.trunc(Number(a.travel_cents)) || 0);

function assignmentState(a = {}, hoje = isoDateBR()) {
  const status = a.status || ASSIGNMENT_STATUS.INVITED;
  const started = Boolean(a.event && isIsoDate(a.event.date) && a.event.date <= hoje);
  const ended = Boolean(a.event && eventDays(a.event).every((d) => d < hoje));
  return {
    status,
    live: LIVE_ASSIGNMENT.includes(status),
    overdue: status === ASSIGNMENT_STATUS.INVITED && isIsoDate(a.respond_by) && a.respond_by < hoje,
    started,
    ended,
    canRespond: status === ASSIGNMENT_STATUS.INVITED || (status === ASSIGNMENT_STATUS.CONFIRMED && !started),
    canReport: [ASSIGNMENT_STATUS.CONFIRMED, ASSIGNMENT_STATUS.DONE].includes(status) && started,
    canEvaluate: status === ASSIGNMENT_STATUS.DONE,
    payable: status === ASSIGNMENT_STATUS.DONE && amountOf(a) > 0,
    paid: Boolean(a.paid_at_ms),
  };
}

/* ------------------------------------------------- avaliação e súmula -- */

function evaluationAverage(ev) {
  const notas = EVAL_CRITERIA.map((c) => Number(ev && ev.scores && ev.scores[c])).filter((n) => n >= 1 && n <= 5);
  return notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10 : 0;
}

function validateEvaluation(input = {}) {
  const errors = {};
  const scores = {};
  EVAL_CRITERIA.forEach((c) => {
    const n = Number(input.scores && input.scores[c]);
    if (!Number.isInteger(n) || n < 1 || n > 5) errors[c] = 'Dê uma nota de 1 a 5.';
    else scores[c] = n;
  });
  const comment = String(input.comment == null ? '' : input.comment).trim().slice(0, LIMITS.COMMENT_MAX);
  const ok = Object.keys(errors).length === 0;
  return { ok, errors, value: { scores, comment, avg: ok ? evaluationAverage({ scores }) : 0 } };
}

function validateReport(text) {
  const t = String(text == null ? '' : text).replace(/\r\n?/g, '\n').trim();
  if (t.length < 10) return { ok: false, error: 'Escreva a súmula ou o relatório (mínimo 10 caracteres).', value: '' };
  return { ok: true, error: '', value: t.slice(0, LIMITS.REPORT_MAX) };
}

function refereeStats(assignments = []) {
  const feitas = (assignments || []).filter((a) => a.status === ASSIGNMENT_STATUS.DONE);
  const notas = feitas.map((a) => (a.evaluation ? evaluationAverage(a.evaluation) : 0)).filter((n) => n > 0);
  return {
    acts: feitas.length,
    no_show: (assignments || []).filter((a) => a.status === ASSIGNMENT_STATUS.NO_SHOW).length,
    evaluations: notas.length,
    avg: notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10 : 0,
  };
}

/* -------------------------------------------------------------- público -- */

function publicBoard(referees = [], rules) {
  return (referees || [])
    .filter((r) => r && r.status === REFEREE_STATUS.ACTIVE && r.public_listing === true)
    .map((r) => ({ name: texto(r.name, 120), level: r.level || '', level_label: levelLabel(rules, r.level), city: texto(r.city, 80), state: texto(r.state, 2), photo_url: texto(r.photo_url, 500) }))
    .sort((a, b) => levelRank(rules, b.level) - levelRank(rules, a.level) || a.name.localeCompare(b.name, 'pt-BR'));
}

function publicCrew(assignments = []) {
  return (assignments || [])
    .filter((a) => a && ['confirmed', 'done'].includes(a.status))
    .map((a) => ({ name: texto(a.referee_name, 120), function: a.function }))
    .sort((a, b) => REFEREE_FUNCTIONS.indexOf(a.function) - REFEREE_FUNCTIONS.indexOf(b.function) || a.name.localeCompare(b.name, 'pt-BR'));
}

/** As diárias PAGAS viram despesa `referees` das contas (mesma conta de `domain/referees.js`). */
function refereeFeesAsExpenses(assignments = []) {
  return (assignments || [])
    .filter((a) => a && a.paid_at_ms && amountOf(a) > 0)
    .map((a) => ({ date: isoDateBR(Number(a.paid_at_ms)), amount_cents: amountOf(a), category: 'referees', ref: String(a.id || '') }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
}

module.exports = {
  REFEREE_FUNCTIONS, REFEREE_STATUS, ASSIGNMENT_STATUS, LIVE_ASSIGNMENT, WARNING, EVAL_CRITERIA, DEFAULT_REFEREE_LEVELS, SCALABLE_EVENT_KINDS, LIMITS, RESPOND_DAYS_DEFAULT,
  isIsoDate, addDaysISO, isoDateBR, eventDays, normalizeRefereeRules, validateRefereeRules, levelLabel, levelRank, meetsMinLevel, validateRosterInput, normalizeUnavailable,
  isScalableTournament, eventFromTournament, isScalableAgendaEvent, eventFromAgenda, eventKey, athleteUidsOf, assignmentWarnings, assignBlocker, defaultRespondBy, normalizeCents, amountOf,
  assignmentState, evaluationAverage, validateEvaluation, validateReport, refereeStats, publicBoard, publicCrew, refereeFeesAsExpenses,
};
