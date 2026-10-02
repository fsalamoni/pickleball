/**
 * weekStreak — a SEQUÊNCIA de semanas jogando (lógica pura, sem I/O).
 *
 * "Sequência" é o que a pessoa vê no hub como "N semanas seguidas". A conta
 * antiga (`computeProtectedStreak` sem metadados) tinha três defeitos que a
 * tornavam impossível de explicar com honestidade:
 *
 *  1. **Não zerava.** Contava as semanas seguidas que TERMINAM no jogo mais
 *     recente, não importa quando ele foi: quem parou há três meses seguia com
 *     "5 semanas seguidas".
 *  2. **As proteções eram decorativas.** O hub mostrava "3 dias de folga" e
 *     "3 congelamentos" e botões para gastá-los, mas o motor calculava a
 *     sequência SEM ler esses dados — gastar um congelamento não mudava nada.
 *  3. **O "dia de folga" somava uma semana de graça** quando o último jogo foi
 *     há duas semanas, em vez de proteger uma semana perdida.
 *
 * ## As regras (uma só conta, a mesma que a tela explica)
 *
 *  - A semana vai de segunda a domingo, no horário de Brasília (a mesma das
 *    missões semanais e da revisão).
 *  - A sequência é o número de semanas seguidas COM PELO MENOS UM JOGO,
 *    contadas para trás a partir da semana atual. A semana atual ainda está
 *    aberta: se a pessoa ainda não jogou nela, ela NÃO quebra nada — está "em
 *    risco" até domingo à meia-noite.
 *  - **Folga automática**: uma semana sem jogar, uma vez por mês, não quebra a
 *    sequência (nem duas semanas seguidas). Não há saldo para gastar nem botão:
 *    é uma regra, calculada só das datas — por isso não tem como "esquecer de
 *    usar" nem como forjar.
 *  - **Férias**: a pessoa avisa que vai ficar uma temporada sem jogar. As
 *    semanas de férias não contam e não quebram. Cobrem no máximo 4 semanas por
 *    vez, e só dá para começar outra depois de 90 dias — férias não são um
 *    interruptor para segurar o número.
 *  - Semana de folga ou de férias NÃO soma na sequência: ela é uma ponte, não
 *    um jogo. "8 semanas seguidas" são oito semanas em que a pessoa jogou.
 *  - `best` é o recorde histórico, pela mesma conta. As CONQUISTAS usam o
 *    recorde (quem já emendou 12 semanas conquistou, mesmo que tenha parado);
 *    a tela e as recompensas usam a sequência ATUAL.
 *
 * Nada aqui grava no banco. Os períodos de férias vêm do documento
 * `user_streak_meta` (campo opcional `vacations`).
 */
import { DIA_MS, platformWeekKey, scopeWindowBR } from './missionDay.js';
import { STREAK_MILESTONES } from './streakProtection.js';

/** Quanto uma pausa de férias protege, no máximo (dias). */
export const STREAK_VACATION_MAX_DAYS = 28;
/** Intervalo mínimo entre o começo de duas pausas de férias (dias). */
export const STREAK_VACATION_COOLDOWN_DAYS = 90;
/** Quantas pausas ficam gravadas no documento (as mais recentes). */
export const STREAK_VACATIONS_KEPT = 8;

/** Estados da sequência — o que a tela diz à pessoa. */
export const STREAK_STATUS = Object.freeze({
  NONE: 'sem_historico',
  ACTIVE: 'ativa',
  AT_RISK: 'em_risco',
  VACATION: 'ferias',
  BROKEN: 'quebrada',
});

/** O índice (inteiro) da semana de uma chave de segunda-feira 'YYYY-MM-DD'. */
export function weekIndexOfKey(mondayKey) {
  const [y, m, d] = String(mondayKey).split('-').map(Number);
  const dia = Math.floor(Date.UTC(y, m - 1, d) / DIA_MS);
  // 01/01/1970 foi uma quinta-feira: as segundas têm índice de dia ≡ 4 (mod 7).
  return Math.floor((dia - 4) / 7);
}

/** O índice da semana (Brasília, segunda a domingo) de um instante. */
export function weekIndexOf(ms) {
  return weekIndexOfKey(platformWeekKey(new Date(ms)));
}

/** A segunda-feira ('YYYY-MM-DD') de uma semana pelo índice. */
export function mondayKeyOfWeek(w) {
  return new Date((w * 7 + 4) * DIA_MS).toISOString().slice(0, 10);
}

const monthOfWeek = (w) => mondayKeyOfWeek(w).slice(0, 7);

/**
 * Os períodos de férias de um documento de metadados. Aceita o formato novo
 * (`vacations`) e o antigo (`vacationMode` + `vacationStartedAt`), que nunca
 * guardou o fim: no antigo, férias já encerradas valem até `updatedAt`.
 *
 * @param {object|null|undefined} meta
 * @returns {Array<{ from: number, to: number|null }>}
 */
export function vacationPeriodsOf(meta) {
  if (!meta || typeof meta !== 'object') return [];
  if (Array.isArray(meta.vacations)) {
    return meta.vacations
      .map((p) => ({ from: Number(p?.from), to: p?.to == null ? null : Number(p.to) }))
      .filter((p) => Number.isFinite(p.from) && p.from > 0 && (p.to === null || Number.isFinite(p.to)));
  }
  const from = Number(meta.vacationStartedAt);
  if (!Number.isFinite(from) || from <= 0) return [];
  if (meta.vacationMode) return [{ from, to: null }];
  const to = Number(meta.updatedAt);
  return [{ from, to: Number.isFinite(to) && to >= from ? to : from }];
}

/** O período de férias que está aberto agora (sem fim), se houver. */
function openVacation(periods) {
  return periods.find((p) => p.to === null) || null;
}

/** Até quando (ms) uma pausa protege: o fim, o teto de 4 semanas e o presente. */
function vacationCoverageEnd(p, nowMs) {
  const fim = p.to === null ? nowMs : p.to;
  return Math.min(fim, p.from + STREAK_VACATION_MAX_DAYS * DIA_MS, nowMs);
}

function vacationWeekSet(periods, nowMs) {
  const set = new Set();
  for (const p of periods) {
    const fim = vacationCoverageEnd(p, nowMs);
    if (fim < p.from) continue;
    for (let w = weekIndexOf(p.from); w <= weekIndexOf(fim); w += 1) set.add(w);
  }
  return set;
}

/**
 * Quantas semanas jogadas seguidas terminam em `end`, aplicando as pontes
 * (férias e a folga do mês). Pontes só valem entre semanas jogadas: uma ponte
 * no fim da fila (sem jogo antes dela) não entra na conta.
 *
 * @returns {{ count: number, folgas: string[] }} `folgas`: os meses em que a folga foi usada
 */
function chainEndingAt(end, played, vacation, firstPlayed) {
  let count = 0;
  const folgas = [];
  let pendentes = [];
  const mesesUsados = new Set();
  let folgaAnterior = false;
  for (let w = end; w >= firstPlayed; w -= 1) {
    if (played.has(w)) {
      count += 1;
      folgas.push(...pendentes);
      pendentes = [];
      folgaAnterior = false;
    } else if (vacation.has(w)) {
      folgaAnterior = false;
    } else {
      const mes = monthOfWeek(w);
      // Duas semanas sem jogar em seguida, ou uma segunda folga no mesmo mês, quebram.
      if (folgaAnterior || mesesUsados.has(mes)) break;
      mesesUsados.add(mes);
      pendentes.push(mes);
      folgaAnterior = true;
    }
  }
  return { count, folgas };
}

/**
 * A sequência de semanas, o recorde e o estado.
 *
 * @param {number[]} datesMs datas dos jogos (ms)
 * @param {{ now?: Date, vacations?: Array<{ from: number, to: number|null }> }} [options]
 * @returns {{
 *   weeks: number, best: number, status: string, playedThisWeek: boolean,
 *   weeksSinceLast: number|null, folgaUsedThisMonth: boolean,
 *   vacationOpen: boolean, vacationCovering: boolean, vacationEndsAt: number|null,
 *   msLeftInWeek: number, nextStep: { weeks: number, label: string }|null,
 *   lastPlayAt: number|null,
 * }}
 */
export function computeWeekStreak(datesMs, { now = new Date(), vacations = [] } = {}) {
  const nowMs = now.getTime();
  const cur = weekIndexOf(nowMs);
  const played = new Set();
  let lastPlayAt = 0;
  for (const ms of datesMs || []) {
    if (!Number.isFinite(ms) || ms <= 0 || ms > nowMs) continue; // jogo marcado ainda não aconteceu
    played.add(weekIndexOf(ms));
    if (ms > lastPlayAt) lastPlayAt = ms;
  }
  const periods = Array.isArray(vacations) ? vacations : [];
  const vacation = vacationWeekSet(periods, nowMs);
  const aberta = openVacation(periods);
  const vacationCovering = !!aberta && nowMs - aberta.from <= STREAK_VACATION_MAX_DAYS * DIA_MS;

  const base = {
    weeks: 0, best: 0, status: STREAK_STATUS.NONE, playedThisWeek: played.has(cur),
    weeksSinceLast: null, folgaUsedThisMonth: false,
    vacationOpen: !!aberta, vacationCovering,
    // até quando a pausa em aberto protege (o teto de 4 semanas), ou null
    vacationEndsAt: aberta ? aberta.from + STREAK_VACATION_MAX_DAYS * DIA_MS : null,
    msLeftInWeek: Math.max(0, scopeWindowBR('weekly', now).endMs - nowMs),
    nextStep: STREAK_MILESTONES[0] ? { weeks: STREAK_MILESTONES[0].weeks, label: STREAK_MILESTONES[0].label } : null,
    lastPlayAt: lastPlayAt || null,
  };
  if (played.size === 0) return base;

  const firstPlayed = Math.min(...played);
  const end = played.has(cur) ? cur : cur - 1;
  const { count: weeks, folgas } = chainEndingAt(end, played, vacation, firstPlayed);
  let best = weeks;
  for (const w of played) {
    const { count } = chainEndingAt(w, played, vacation, firstPlayed);
    if (count > best) best = count;
  }

  let status;
  if (vacationCovering) status = STREAK_STATUS.VACATION;
  else if (weeks === 0) status = STREAK_STATUS.BROKEN;
  else if (played.has(cur)) status = STREAK_STATUS.ACTIVE;
  else status = STREAK_STATUS.AT_RISK;

  const proximo = STREAK_MILESTONES.find((m) => m.weeks > weeks) || null;
  return {
    ...base,
    weeks,
    best,
    status,
    weeksSinceLast: cur - Math.max(...played),
    folgaUsedThisMonth: folgas.includes(monthOfWeek(cur)),
    nextStep: proximo ? { weeks: proximo.weeks, label: proximo.label } : null,
  };
}

/**
 * Dá para começar férias agora? Não há outra em aberto e a última começou há
 * mais de 90 dias.
 *
 * @returns {{ ok: boolean, reason: string|null, availableAt: number|null }}
 */
export function canStartVacation(periods, now = new Date()) {
  const lista = Array.isArray(periods) ? periods : [];
  if (openVacation(lista)) return { ok: false, reason: 'open', availableAt: null };
  const ultimo = lista.reduce((m, p) => Math.max(m, p.from), 0);
  const liberaEm = ultimo + STREAK_VACATION_COOLDOWN_DAYS * DIA_MS;
  if (ultimo > 0 && now.getTime() < liberaEm) return { ok: false, reason: 'cooldown', availableAt: liberaEm };
  return { ok: true, reason: null, availableAt: null };
}

/** Acrescenta uma pausa aberta (mantém só as mais recentes). */
export function withVacationStarted(periods, now = new Date()) {
  return [...(periods || []), { from: now.getTime(), to: null }].slice(-STREAK_VACATIONS_KEPT);
}

/** Fecha a pausa aberta. Sem pausa aberta, devolve a lista como está. */
export function withVacationEnded(periods, now = new Date()) {
  return (periods || []).map((p) => (p.to === null ? { ...p, to: Math.max(p.from, now.getTime()) } : p));
}
