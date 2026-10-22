/**
 * ARBITRAGEM da federação (módulo `referees`) — a conta PURA, sem banco:
 * níveis e funções, a régua da federação (`federations.referee_rules`), os
 * alertas de uma convocação, a cobertura de um evento, as sugestões, a
 * avaliação, as diárias e o que o público pode ver.
 *
 * Quem grava é SÓ o servidor (`functions/federationReferees.js`); a régua é
 * copiada em `functions/federationRefereesPolicy.js` com paridade em
 * `federationReferees.parity.test.js` — a tela mostra os mesmos alertas que o
 * servidor grava. Os ids (nível padrão, função, situação, alerta, critério)
 * são GRAVADOS: nunca renomeie.
 */
import { t, tk } from '@/core/i18n';

/* ------------------------------------------------------------ catálogo -- */

export const REFEREE_FUNCTION = Object.freeze({
  REFEREE: 'referee',
  HEAD_REFEREE: 'head_referee',
  LINE_JUDGE: 'line_judge',
  TECHNICAL_DELEGATE: 'technical_delegate',
  TOURNAMENT_DIRECTOR: 'tournament_director',
});
export const REFEREE_FUNCTION_LABELS = Object.freeze({
  referee: tk('Árbitro(a)'),
  head_referee: tk('Árbitro(a) geral'),
  line_judge: tk('Juiz(a) de linha'),
  technical_delegate: tk('Delegado(a) técnico(a)'),
  tournament_director: tk('Diretor(a) do torneio'),
});
export const REFEREE_FUNCTIONS = Object.freeze(Object.values(REFEREE_FUNCTION));

export const REFEREE_STATUS = Object.freeze({ ACTIVE: 'active', INACTIVE: 'inactive', SUSPENDED: 'suspended' });
export const REFEREE_STATUS_LABELS = Object.freeze({ active: tk('Ativo'), inactive: tk('Inativo'), suspended: tk('Suspenso') });

export const ASSIGNMENT_STATUS = Object.freeze({
  INVITED: 'invited', CONFIRMED: 'confirmed', DECLINED: 'declined', REPLACED: 'replaced', DONE: 'done', NO_SHOW: 'no_show', CANCELLED: 'cancelled',
});
export const ASSIGNMENT_STATUS_LABELS = Object.freeze({
  invited: tk('Convocado'), confirmed: tk('Confirmado'), declined: tk('Recusou'), replaced: tk('Substituído'),
  done: tk('Atuou'), no_show: tk('Não compareceu'), cancelled: tk('Cancelada'),
});
/** Escala que ainda segura o árbitro (conta para "outra escala no mesmo dia" e para a cobertura). */
export const LIVE_ASSIGNMENT = Object.freeze(['invited', 'confirmed']);

export const WARNING = Object.freeze({ UNAVAILABLE: 'unavailable', SAME_DAY: 'same_day', ATHLETE: 'athlete', LEVEL_BELOW: 'level_below' });
export const WARNING_LABELS = Object.freeze({
  unavailable: tk('Marcou que não pode nesta data'),
  same_day: tk('Já tem outra escala no mesmo dia'),
  athlete: tk('Inscrito como atleta neste torneio'),
  level_below: tk('Nível abaixo do mínimo para a função'),
});

export const EVAL_CRITERIA = Object.freeze(['rules', 'positioning', 'communication', 'punctuality', 'presentation']);
export const EVAL_CRITERIA_LABELS = Object.freeze({
  rules: tk('Regras'), positioning: tk('Posicionamento'), communication: tk('Comunicação'), punctuality: tk('Pontualidade'), presentation: tk('Apresentação'),
});

/** Os níveis padrão (do mais baixo ao mais alto) — a federação pode trocar os rótulos e a lista. */
export const DEFAULT_REFEREE_LEVELS = Object.freeze([
  { id: 'trainee', label: 'Trainee' }, { id: 'l1', label: 'Nível 1' }, { id: 'l2', label: 'Nível 2' }, { id: 'certified', label: 'Certificado' },
]);

/** Tipos da agenda que se escalam (a agenda esportiva com jogo; curso e reunião não). */
export const SCALABLE_EVENT_KINDS = Object.freeze(['competition', 'selection', 'sport_other']);

export const REFEREE_LIMITS = Object.freeze({
  UNAVAILABLE_MAX: 60, REPORT_MAX: 4000, NOTES_MAX: 2000, COMMENT_MAX: 1000, CONFLICT_MAX: 500, REASON_MAX: 500,
  ASSIGN_BATCH_MAX: 20, LEVELS_MAX: 8, LEVEL_LABEL_MAX: 40, NEED_MAX: 50, FEE_MAX_CENTS: 1000000, RESPOND_DAYS_MAX: 30, CREDENTIALS_MAX: 10, EVENT_DAYS_MAX: 31,
});
export const RESPOND_DAYS_DEFAULT = 3;

/* --------------------------------------------------------------- datas -- */

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export function isIsoDate(s) {
  if (!ISO.test(String(s || ''))) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
/** Soma dias a uma data ISO (sem fuso: conta em UTC). */
export function addDaysISO(iso, n) {
  if (!isIsoDate(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
/** A data de hoje em Brasília (UTC−3, sem horário de verão). */
export const isoDateBR = (ms = Date.now()) => new Date(ms - 3 * 3600000).toISOString().slice(0, 10);

/** Os dias de um evento (do início ao fim, no máximo 31). */
export function eventDays(event = {}) {
  if (!event || !isIsoDate(event.date)) return [];
  const fim = isIsoDate(event.end_date) && event.end_date >= event.date ? event.end_date : event.date;
  const out = [];
  for (let d = event.date; d <= fim && out.length < REFEREE_LIMITS.EVENT_DAYS_MAX; d = addDaysISO(d, 1)) out.push(d);
  return out;
}
const sobrepoe = (a, b) => { const da = new Set(eventDays(a)); return eventDays(b).some((d) => da.has(d)); };

/* ---------------------------------------------------- régua (`rules`) -- */

const texto = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const inteiro = (v, min, max) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min; };
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);

/**
 * A régua da federação, sempre completa (o que falta vale o padrão).
 * `levels` do mais baixo ao mais alto; `min_level_by_function` só com nível
 * que existe; `fee_default_cents` e `needs` por função (cobertura padrão de
 * um evento); `respond_days` (prazo para responder); `crew_visible` (o
 * árbitro vê a escala inteira do evento).
 */
export function normalizeRefereeRules(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const vistos = new Set();
  const levels = (Array.isArray(r.levels) ? r.levels : [])
    .map((l) => ({ id: slug(l && l.id), label: texto(l && l.label, REFEREE_LIMITS.LEVEL_LABEL_MAX) }))
    .filter((l) => l.id && l.label && !vistos.has(l.id) && vistos.add(l.id))
    .slice(0, REFEREE_LIMITS.LEVELS_MAX);
  const lv = levels.length ? levels : DEFAULT_REFEREE_LEVELS.map((l) => ({ ...l }));
  const ids = lv.map((l) => l.id);
  const porFuncao = (fonte, fn) => REFEREE_FUNCTIONS.reduce((acc, f) => { const v = fn(fonte && typeof fonte === 'object' ? fonte[f] : undefined); if (v !== undefined) acc[f] = v; return acc; }, {});
  return {
    levels: lv,
    min_level_by_function: porFuncao(r.min_level_by_function, (v) => (ids.includes(v) ? v : undefined)),
    fee_default_cents: porFuncao(r.fee_default_cents, (v) => (v == null || v === '' ? undefined : inteiro(v, 0, REFEREE_LIMITS.FEE_MAX_CENTS))),
    needs: porFuncao(r.needs, (v) => (v == null || v === '' ? undefined : inteiro(v, 0, REFEREE_LIMITS.NEED_MAX))),
    respond_days: r.respond_days == null || r.respond_days === '' ? RESPOND_DAYS_DEFAULT : inteiro(r.respond_days, 1, REFEREE_LIMITS.RESPOND_DAYS_MAX),
    crew_visible: r.crew_visible === true,
  };
}

/** Valida o que a equipe salva em Regras/níveis. */
export function validateRefereeRules(input = {}) {
  const errors = {};
  const brutos = Array.isArray(input.levels) ? input.levels : [];
  if (brutos.length === 0) errors.levels = t('Cadastre pelo menos um nível.');
  else if (brutos.length > REFEREE_LIMITS.LEVELS_MAX) errors.levels = t('No máximo {n} níveis.', { n: REFEREE_LIMITS.LEVELS_MAX });
  else if (brutos.some((l) => !slug(l && l.id) || !texto(l && l.label, REFEREE_LIMITS.LEVEL_LABEL_MAX))) errors.levels = t('Todo nível precisa de nome.');
  else if (new Set(brutos.map((l) => slug(l.id))).size !== brutos.length) errors.levels = t('Há dois níveis com o mesmo código.');
  return { ok: Object.keys(errors).length === 0, errors, value: normalizeRefereeRules(input) };
}

export const levelLabel = (rules, id) => (normalizeRefereeRules(rules).levels.find((l) => l.id === id) || {}).label || '';
/** A posição do nível na régua (−1 = desconhecido). */
export const levelRank = (rules, id) => normalizeRefereeRules(rules).levels.findIndex((l) => l.id === id);
/** O nível alcança o mínimo da função? Sem mínimo, sim. Nível desconhecido com mínimo, não. */
export function meetsMinLevel(rules, fn, level) {
  const min = normalizeRefereeRules(rules).min_level_by_function[fn];
  if (!min) return true;
  const r = levelRank(rules, level);
  return r >= 0 && r >= levelRank(rules, min);
}

/* -------------------------------------------------------------- quadro -- */

/** Cadastro do árbitro (o que a equipe escolhe). Nível precisa existir na régua. */
export function validateRosterInput(input = {}, rules) {
  const regra = normalizeRefereeRules(rules);
  const errors = {};
  const level = String(input.level || '');
  if (!regra.levels.some((l) => l.id === level)) errors.level = t('Escolha o nível.');
  const functions = [...new Set((Array.isArray(input.functions) ? input.functions : []).filter((f) => REFEREE_FUNCTIONS.includes(f)))];
  if (functions.length === 0) errors.functions = t('Escolha pelo menos uma função.');
  const status = Object.values(REFEREE_STATUS).includes(input.status) ? input.status : REFEREE_STATUS.ACTIVE;
  const credential_ids = [...new Set((Array.isArray(input.credential_ids) ? input.credential_ids : []).map((c) => String(c || '')).filter((c) => /^[A-Za-z0-9_-]{1,120}$/.test(c)))].slice(0, REFEREE_LIMITS.CREDENTIALS_MAX);
  const since = isIsoDate(input.since) ? input.since : '';
  return { ok: Object.keys(errors).length === 0, errors, value: { level, functions, status, credential_ids, since } };
}

/** As datas em que o árbitro não pode: válidas, de hoje em diante, sem repetir, em ordem, no máximo 60. */
export function normalizeUnavailable(list, hoje) {
  return [...new Set((Array.isArray(list) ? list : []).map(String).filter((d) => isIsoDate(d) && d >= hoje))].sort().slice(0, REFEREE_LIMITS.UNAVAILABLE_MAX);
}

/** Tocar no dia marca ou desmarca (puro — a tela manda a lista inteira). */
export function toggleUnavailable(list, day, hoje) {
  const atual = normalizeUnavailable(list, hoje);
  return atual.includes(day) ? atual.filter((d) => d !== day) : normalizeUnavailable([...atual, day], hoje);
}

/* ------------------------------------------------------------- eventos -- */

/** Torneio chancelado por ESTA federação que dá para escalar (chancela aprovada, não rascunho nem cancelado). */
export const isScalableTournament = (tt, fedId) => Boolean(tt) && tt.federation_id === fedId && tt.archived !== true
  && Boolean(tt.federation_sanction) && tt.federation_sanction.status === 'approved' && !['draft', 'cancelled'].includes(tt.status);

/** O resumo do torneio que vai copiado em cada escala. */
export function eventFromTournament(tt) {
  const date = String(tt.starts_at || tt.start_date || '').slice(0, 10);
  if (!isIsoDate(date)) return null;
  const fim = String(tt.ends_at || tt.end_date || '').slice(0, 10);
  return {
    kind: 'tournament', id: String(tt.id), name: texto(tt.name || 'Torneio', 160), date, end_date: isIsoDate(fim) && fim >= date ? fim : date,
    city: texto(tt.city, 80), public: tt.visibility === 'public',
  };
}

/** Evento da agenda (esportivo, confirmado) que dá para escalar. */
export const isScalableAgendaEvent = (ev, fedId) => Boolean(ev) && ev.federation_id === fedId && SCALABLE_EVENT_KINDS.includes(ev.kind) && (ev.status || 'scheduled') === 'scheduled';

export function eventFromAgenda(ev) {
  if (!isIsoDate(ev.date)) return null;
  return {
    kind: 'event', id: String(ev.id), name: texto(ev.title || 'Evento', 160), date: ev.date, end_date: isIsoDate(ev.end_date) && ev.end_date >= ev.date ? ev.end_date : ev.date,
    city: texto(ev.place && ev.place.city, 80), public: ev.visibility === 'public',
  };
}

export const eventKey = (event) => (event ? `${event.kind}_${event.id}` : '');

/** Quem está inscrito como atleta (inscrição viva) — conta, dupla e time. */
export function athleteUidsOf(registrations = []) {
  const out = new Set();
  (registrations || []).forEach((r) => {
    if (!r || ['cancelled', 'withdrawn'].includes(r.status)) return;
    [r.user_id, r.player_a_user_id, r.player_b_user_id, ...(Array.isArray(r.members) ? r.members.map((m) => m && m.user_id) : [])].forEach((u) => { if (u) out.add(String(u)); });
  });
  return out;
}

/** Os eventos escaláveis da federação (torneios chancelados + agenda esportiva), do mais próximo ao mais longe. */
export function scalableEvents({ tournaments = [], events = [], fedId }) {
  const lista = [
    ...(tournaments || []).filter((tt) => isScalableTournament(tt, fedId)).map(eventFromTournament),
    ...(events || []).filter((ev) => isScalableAgendaEvent(ev, fedId)).map(eventFromAgenda),
  ].filter(Boolean);
  return lista.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

/* ----------------------------------------------------- convocação -- */

/**
 * Os ALERTAS de convocar esta pessoa para esta função neste evento. Não
 * barram: a equipe decide, e o alerta fica gravado na escala.
 * @param {object} p
 * @param {object} p.referee o cadastro (`unavailable`, `level`)
 * @param {object} p.event o resumo do evento (`kind`, `id`, `date`, `end_date`)
 * @param {string} p.fn a função
 * @param {object[]} p.assignments as escalas da pessoa (todas as federações)
 * @param {Set<string>|string[]} [p.athleteUids] quem está inscrito como atleta (torneio)
 * @param {object} [p.rules]
 * @returns {Array<{ kind: string, detail: string }>}
 */
export function assignmentWarnings({ referee = {}, event, fn, assignments = [], athleteUids = [], rules } = {}) {
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

/** Por que esta pessoa NÃO pode ser convocada (erro, não alerta), ou ''. */
export function assignBlocker({ referee, event, fn, assignments = [] }) {
  if (!referee) return t('Esta pessoa não está no quadro de arbitragem.');
  if (referee.status !== REFEREE_STATUS.ACTIVE) return t('O árbitro não está ativo no quadro.');
  if (!(referee.functions || []).includes(fn)) return t('O árbitro não atua nesta função.');
  if ((assignments || []).some((a) => LIVE_ASSIGNMENT.includes(a.status) && eventKey(a.event) === eventKey(event))) return t('O árbitro já está escalado neste evento.');
  return '';
}

/** O prazo para responder: hoje + os dias da régua, sem passar da véspera do evento (nem antes de hoje). */
export function defaultRespondBy(event, rules, hoje) {
  const alvo = addDaysISO(hoje, normalizeRefereeRules(rules).respond_days);
  const vespera = event && isIsoDate(event.date) ? addDaysISO(event.date, -1) : alvo;
  const r = alvo < vespera ? alvo : vespera;
  return r < hoje ? hoje : r;
}

/** Valor em centavos digitado (diária, deslocamento): inteiro entre 0 e o teto, ou null se inválido. */
export function normalizeCents(v) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > REFEREE_LIMITS.FEE_MAX_CENTS || Math.trunc(n) !== n) return null;
  return n;
}

/* ------------------------------------------------------------ situação -- */

/**
 * Como está a escala hoje: `overdue` = convocado e o prazo de resposta já
 * passou ("sem resposta" para a equipe substituir); `started` = o evento já
 * começou (súmula e fechamento só depois).
 */
export function assignmentState(a = {}, hoje = isoDateBR()) {
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

export const amountOf = (a = {}) => (Math.trunc(Number(a.fee_cents)) || 0) + (Math.trunc(Number(a.travel_cents)) || 0);

/* ------------------------------------------------------------ cobertura -- */

/**
 * A cobertura de UM evento por função: a meta (`needs` da régua), quantos
 * confirmados, convocados (sem resposta) e recusas. `complete` = toda função
 * com meta tem confirmados suficientes (sem meta: ao menos um confirmado).
 */
export function eventCoverage(assignments = [], rules) {
  const needs = normalizeRefereeRules(rules).needs;
  const funcoes = new Set([...Object.keys(needs).filter((f) => needs[f] > 0), ...(assignments || []).map((a) => a.function)]);
  const rows = REFEREE_FUNCTIONS.filter((f) => funcoes.has(f)).map((f) => {
    const doF = (assignments || []).filter((a) => a.function === f);
    const n = (s) => doF.filter((a) => a.status === s).length;
    return { function: f, need: needs[f] || 0, confirmed: n('confirmed') + n('done'), invited: n('invited'), declined: n('declined') };
  });
  const comMeta = rows.filter((r) => r.need > 0);
  const confirmados = rows.reduce((s, r) => s + r.confirmed, 0);
  const complete = comMeta.length ? comMeta.every((r) => r.confirmed >= r.need) : confirmados > 0;
  return { rows, complete, confirmed: confirmados, need: comMeta.reduce((s, r) => s + r.need, 0) };
}

/* ------------------------------------------------------------ sugestões -- */

/**
 * Quem sugerir para a função: ativos que atuam nela e ainda não estão no
 * evento, com os alertas; sem alerta primeiro, depois o nível mais alto e
 * quem atuou menos (para dividir as escalas), e o nome.
 */
export function suggestReferees({ referees = [], assignments = [], event, fn, rules, athleteUids = [] }) {
  const porPessoa = new Map();
  (assignments || []).forEach((a) => { if (!porPessoa.has(a.referee_uid)) porPessoa.set(a.referee_uid, []); porPessoa.get(a.referee_uid).push(a); });
  return (referees || [])
    .map((r) => {
      const suas = porPessoa.get(r.user_id) || [];
      const bloqueio = assignBlocker({ referee: r, event, fn, assignments: suas });
      if (bloqueio) return null;
      return { referee: r, warnings: assignmentWarnings({ referee: r, event, fn, assignments: suas, athleteUids, rules }), rank: levelRank(rules, r.level), acts: (r.stats && r.stats.acts) || 0 };
    })
    .filter(Boolean)
    .sort((a, b) => (a.warnings.length > 0) - (b.warnings.length > 0) || b.rank - a.rank || a.acts - b.acts || String(a.referee.name || '').localeCompare(String(b.referee.name || ''), 'pt-BR'));
}

/* ------------------------------------------------- avaliação e súmula -- */

/** Notas de 1 a 5 nos cinco critérios + comentário. */
export function validateEvaluation(input = {}) {
  const errors = {};
  const scores = {};
  EVAL_CRITERIA.forEach((c) => {
    const n = Number(input.scores && input.scores[c]);
    if (!Number.isInteger(n) || n < 1 || n > 5) errors[c] = t('Dê uma nota de 1 a 5.');
    else scores[c] = n;
  });
  const comment = String(input.comment == null ? '' : input.comment).trim().slice(0, REFEREE_LIMITS.COMMENT_MAX);
  const ok = Object.keys(errors).length === 0;
  return { ok, errors, value: { scores, comment, avg: ok ? evaluationAverage({ scores }) : 0 } };
}

/** A média da avaliação (uma casa). */
export function evaluationAverage(ev) {
  const notas = EVAL_CRITERIA.map((c) => Number(ev && ev.scores && ev.scores[c])).filter((n) => n >= 1 && n <= 5);
  return notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10 : 0;
}

export function validateReport(text) {
  const txt = String(text == null ? '' : text).replace(/\r\n?/g, '\n').trim();
  if (txt.length < 10) return { ok: false, error: t('Escreva a súmula ou o relatório (mínimo 10 caracteres).'), value: '' };
  return { ok: true, error: '', value: txt.slice(0, REFEREE_LIMITS.REPORT_MAX) };
}

/** Atuações, ausências e a média das avaliações de UM árbitro (recalculado pelo servidor). */
export function refereeStats(assignments = []) {
  const feitas = (assignments || []).filter((a) => a.status === ASSIGNMENT_STATUS.DONE);
  const notas = feitas.map((a) => (a.evaluation ? evaluationAverage(a.evaluation) : 0)).filter((n) => n > 0);
  return {
    acts: feitas.length,
    no_show: (assignments || []).filter((a) => a.status === ASSIGNMENT_STATUS.NO_SHOW).length,
    evaluations: notas.length,
    avg: notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10 : 0,
  };
}

/* ------------------------------------------------------------- diárias -- */

/** Diárias a pagar (atuou, valor > 0, sem pagamento) e pagas. */
export function feesSummary(assignments = []) {
  const pagaveis = (assignments || []).filter((a) => a.status === ASSIGNMENT_STATUS.DONE && amountOf(a) > 0);
  const aPagar = pagaveis.filter((a) => !a.paid_at_ms);
  const pagas = pagaveis.filter((a) => a.paid_at_ms);
  const soma = (l) => l.reduce((s, a) => s + amountOf(a), 0);
  return { aPagar, pagas, totalAPagar: soma(aPagar), totalPago: soma(pagas) };
}

/**
 * As diárias PAGAS como despesas (categoria `referees`) — o módulo de Contas
 * soma isto como lançamento derivado, para o dinheiro não ser lançado duas
 * vezes. Data = o dia do pagamento em Brasília; valor = diária + deslocamento.
 * @returns {Array<{ date: string, amount_cents: number, category: 'referees', ref: string }>}
 */
export function refereeFeesAsExpenses(assignments = []) {
  return (assignments || [])
    .filter((a) => a && a.paid_at_ms && amountOf(a) > 0)
    .map((a) => ({ date: isoDateBR(Number(a.paid_at_ms)), amount_cents: amountOf(a), category: 'referees', ref: String(a.id || '') }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
}

/* -------------------------------------------------------------- público -- */

/** O quadro público: só ativo E que aceitou aparecer; só nome, nível, cidade e foto. */
export function publicBoard(referees = [], rules) {
  return (referees || [])
    .filter((r) => r && r.status === REFEREE_STATUS.ACTIVE && r.public_listing === true)
    .map((r) => ({ name: texto(r.name, 120), level: r.level || '', level_label: levelLabel(rules, r.level), city: texto(r.city, 80), state: texto(r.state, 2), photo_url: texto(r.photo_url, 500) }))
    .sort((a, b) => levelRank(rules, b.level) - levelRank(rules, a.level) || a.name.localeCompare(b.name, 'pt-BR'));
}

/** Quem apita (público): só confirmado ou que atuou; nome e função — nunca valor, nota nem conflito. */
export function publicCrew(assignments = []) {
  return (assignments || [])
    .filter((a) => a && ['confirmed', 'done'].includes(a.status))
    .map((a) => ({ name: texto(a.referee_name, 120), function: a.function }))
    .sort((a, b) => REFEREE_FUNCTIONS.indexOf(a.function) - REFEREE_FUNCTIONS.indexOf(b.function) || a.name.localeCompare(b.name, 'pt-BR'));
}

/* ----------------------------------------------------------- pendências -- */

/**
 * O que espera a equipe de arbitragem: escala sem resposta (prazo vencido) e
 * evento em menos de 7 dias com a cobertura incompleta. Fonte `undefined`
 * (não carregou) ⇒ `undefined`, nunca zero.
 */
export function refereeStaffPending({ assignments, events, rules, hoje = isoDateBR() } = {}) {
  const semResposta = Array.isArray(assignments) ? assignments.filter((a) => assignmentState(a, hoje).overdue).length : undefined;
  let semCobertura;
  if (Array.isArray(assignments) && Array.isArray(events)) {
    const limite = addDaysISO(hoje, 7);
    semCobertura = events.filter((e) => e.date >= hoje && e.date <= limite)
      .filter((e) => !eventCoverage(assignments.filter((a) => eventKey(a.event) === eventKey(e)), rules).complete).length;
  }
  return { semResposta, semCobertura };
}

/** Convocações que esperam a resposta da pessoa (para a faixa da Minha área). */
export const myPendingAssignments = (assignments, hoje = isoDateBR()) => (Array.isArray(assignments)
  ? assignments.filter((a) => a.status === ASSIGNMENT_STATUS.INVITED && !assignmentState(a, hoje).ended).length : undefined);

/** Divide as escalas da pessoa: a responder, próximas (confirmadas), histórico. */
export function splitMyAssignments(assignments = [], hoje = isoDateBR()) {
  const porData = (a, b) => String(a.event?.date || '').localeCompare(String(b.event?.date || ''));
  const st = (a) => assignmentState(a, hoje);
  const responder = assignments.filter((a) => a.status === ASSIGNMENT_STATUS.INVITED && !st(a).ended).sort(porData);
  const proximas = assignments.filter((a) => a.status === ASSIGNMENT_STATUS.CONFIRMED && !st(a).ended).sort(porData);
  const vistos = new Set([...responder, ...proximas].map((a) => a.id));
  const historico = assignments.filter((a) => !vistos.has(a.id)).sort((a, b) => porData(b, a));
  return { responder, proximas, historico };
}

/* ----------------------------------------------------------------- CSV -- */

const cel = (v) => { const s = String(v ?? ''); return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`; };
const reais = (c) => (Math.trunc(Number(c) || 0) / 100).toFixed(2).replace('.', ',');
const br = (iso) => (isIsoDate(iso) ? iso.split('-').reverse().join('/') : '');

/** As diárias em CSV (`;`, reais com vírgula, datas dd/mm/aaaa — abre certo no Excel brasileiro). */
export function feesCsv(assignments = []) {
  const linhas = [['Evento', 'Data', 'Árbitro', 'Função', 'Diária', 'Deslocamento', 'Total', 'Situação', 'Pago em'].map(cel).join(';')];
  (assignments || []).forEach((a) => linhas.push([
    a.event?.name, br(a.event?.date), a.referee_name, REFEREE_FUNCTION_LABELS[a.function] || a.function, reais(a.fee_cents), reais(a.travel_cents), reais(amountOf(a)),
    a.paid_at_ms ? 'Paga' : 'A pagar', a.paid_at_ms ? br(isoDateBR(a.paid_at_ms)) : '',
  ].map(cel).join(';')));
  return linhas.join('\r\n');
}
