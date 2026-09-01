/**
 * Streak com proteção (lógica pura, sem I/O).
 *
 * **O QUE MUDA vs `computeWeekStreak` (V1)**:
 *  - Grace day: 1 dia por mês pode ser "pulado" sem quebrar o streak.
 *  - Modo férias: liga por 7 dias, streak congelado, sem perda.
 *  - Bônus por milestone (4w, 8w, 12w, 26w, 52w) com XP.
 *  - Comeback bonus: ao voltar depois de quebrar streak de 4+ semanas,
 *    ganha XP de recompensa.
 *
 * **O QUE NÃO MUDA**:
 *  - `computeWeekStreak` V1 continua existindo. Use `computeWeekStreakV2`
 *    se quiser o algoritmo sem proteção (mesmo cálculo de V1).
 *  - UI atual continua mostrando a 🔥 se a flag `STREAK_PROTECTION` OFF.
 *
 * Aditivo. Sem I/O. Sem breaking change.
 */

import { computeWeekStreak } from './progression.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @typedef {Object} StreakMeta
 * @property {number} weeks               — semanas consecutivas (com grace aplicado)
 * @property {boolean} usedGraceThisMonth — se o grace day do mês corrente já foi usado
 * @property {string|null} frozenUntil     — ISO string se modo férias ativo
 * @property {number} lastPlayAt          — ms da última jogatina
 * @property {string} graceMonth          — "YYYY-MM" do mês em que o grace foi usado
 */

/**
 * Converte ms em "semana ISO" (epoch/7d), igual ao V1.
 */
function weekKey(ms) {
  return Math.floor(ms / WEEK_MS);
}

/**
 * Converte ms em "YYYY-MM" (mês civil) no fuso BRT (UTC-3).
 */
function monthKeyBR(ms) {
  const d = new Date(ms);
  // shift para BRT
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const y = brt.getUTCFullYear();
  const m = String(brt.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Computa a streak com proteção.
 *
 * @param {number[]} datesMillis — datas dos jogos (ms)
 * @param {{
 *   meta?: StreakMeta,
 *   now?: Date,
 *   graceDaysPerMonth?: number,
 *   freezeMs?: number,
 * }} [options]
 * @returns {{
 *   weeks: number,
 *   rawStreak: number,
 *   usedGrace: boolean,
 *   frozen: boolean,
 *   frozenUntil: string|null,
 *   nextMilestone: { weeks: number, xpBonus: number }|null,
 *   daysSinceLastPlay: number,
 * }}
 */
export function computeProtectedStreak(datesMillis, options = {}) {
  const {
    meta = null,
    now = new Date(),
    graceDaysPerMonth = 1,
    freezeMs = 7 * DAY_MS,
  } = options;

  const nowMs = now.getTime();
  const frozen = meta?.frozenUntil ? new Date(meta.frozenUntil).getTime() > nowMs : false;
  const frozenUntil = frozen ? meta.frozenUntil : null;

  // Filtrar datas válidas
  const valid = (datesMillis || [])
    .filter((ms) => Number.isFinite(ms) && ms > 0)
    .sort((a, b) => a - b);

  // Se está frozen, retorna a streak anterior (do meta) sem recalcular.
  // IMPORTANTE: checar ANTES do early-return de array vazio, pois
  // o usuário pode estar frozen mesmo sem jogos novos esta semana.
  if (frozen) {
    const metaWeeks = meta?.weeks || 0;
    const lastPlayAt = valid.length > 0 ? valid[valid.length - 1] : (meta?.lastPlayAt || 0);
    const daysSinceLastPlay = lastPlayAt > 0 ? Math.floor((nowMs - lastPlayAt) / DAY_MS) : null;
    return {
      weeks: metaWeeks,
      rawStreak: metaWeeks,
      usedGrace: meta?.usedGraceThisMonth || false,
      frozen,
      frozenUntil,
      nextMilestone: nextStreakMilestone(metaWeeks),
      daysSinceLastPlay,
    };
  }

  if (valid.length === 0) {
    return {
      weeks: 0,
      rawStreak: 0,
      usedGrace: meta?.usedGraceThisMonth || false,
      frozen: false,
      frozenUntil: null,
      nextMilestone: nextStreakMilestone(0),
      daysSinceLastPlay: null,
    };
  }

  const lastPlayAt = valid[valid.length - 1];
  const daysSinceLastPlay = Math.floor((nowMs - lastPlayAt) / DAY_MS);

  // Calcula a streak "raw" (V1)
  const rawStreak = computeWeekStreak(valid);

  // Verifica se a última jogatina foi há 8-14 dias (= 1 semana pulada)
  // Nesse caso, podemos aplicar grace day (se ainda não usou este mês)
  const weeksSinceLastPlay = Math.floor(daysSinceLastPlay / 7);
  const usedGrace = meta?.usedGraceThisMonth || false;
  const currentMonth = monthKeyBR(nowMs);
  const graceMonth = meta?.graceMonth || null;
  const graceAvailableThisMonth = !usedGrace || graceMonth !== currentMonth;

  let effectiveStreak = rawStreak;
  if (weeksSinceLastPlay >= 2 && weeksSinceLastPlay <= 2 && graceAvailableThisMonth && graceDaysPerMonth > 0) {
    // Última jogatina foi há 2 semanas. Sem grace, a streak seria
    // baseada na penúltima jogatina. Com grace, ganhamos 1 semana de bônus.
    effectiveStreak = rawStreak + 1;
  }

  return {
    weeks: effectiveStreak,
    rawStreak,
    usedGrace: !graceAvailableThisMonth,
    frozen: false,
    frozenUntil: null,
    nextMilestone: nextStreakMilestone(effectiveStreak),
    daysSinceLastPlay,
  };
}

/**
 * Decide se o grace day deste mês pode ser ativado.
 *
 * @param {StreakMeta} meta
 * @param {Date} [now]
 * @returns {boolean}
 */
export function canUseGrace(meta, now = new Date()) {
  if (!meta) return true;
  const currentMonth = monthKeyBR(now.getTime());
  return !meta.usedGraceThisMonth || meta.graceMonth !== currentMonth;
}

/**
 * Aplica o grace day ao meta (retorna novo meta, não muta).
 *
 * @param {StreakMeta} meta
 * @param {Date} [now]
 * @returns {StreakMeta} novo meta com grace usado
 */
export function applyGrace(meta, now = new Date()) {
  const currentMonth = monthKeyBR(now.getTime());
  return {
    ...(meta || {}),
    usedGraceThisMonth: true,
    graceMonth: currentMonth,
  };
}

/**
 * Ativa o modo férias (congela streak por `freezeMs`).
 *
 * @param {StreakMeta} meta
 * @param {number} [weeks] — streak atual (vai ser congelada)
 * @param {Date} [now]
 * @returns {StreakMeta}
 */
export function activateVacation(meta, weeks = 0, now = new Date()) {
  const until = new Date(now.getTime() + (7 * DAY_MS));
  return {
    ...(meta || {}),
    weeks: weeks || meta?.weeks || 0,
    frozenUntil: until.toISOString(),
  };
}

/**
 * Desativa o modo férias.
 *
 * @param {StreakMeta} meta
 * @returns {StreakMeta}
 */
export function deactivateVacation(meta) {
  return {
    ...(meta || {}),
    frozenUntil: null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// MILESTONES
// ────────────────────────────────────────────────────────────────────────────

/**
 * Tabela de milestones de streak com bônus de XP.
 *
 * Curva: 4 sem, 8 sem, 12 sem, 26 sem (~6 meses), 52 sem (1 ano).
 * XP bônus é cumulativo ao milestone base.
 */
export const STREAK_MILESTONES = Object.freeze([
  { weeks: 4, xpBonus: 100, label: 'Constância' },
  { weeks: 8, xpBonus: 200, label: 'Frequência' },
  { weeks: 12, xpBonus: 500, label: 'Rotina de atleta' },
  { weeks: 26, xpBonus: 1000, label: 'Meio ano' },
  { weeks: 52, xpBonus: 2500, label: 'Um ano de quadra' },
]);

/**
 * Retorna o próximo milestone (weeks > current).
 *
 * @param {number} currentWeeks
 * @returns {{ weeks: number, xpBonus: number, label: string }|null}
 */
export function nextStreakMilestone(currentWeeks) {
  const w = Number(currentWeeks) || 0;
  for (const m of STREAK_MILESTONES) {
    if (m.weeks > w) return { ...m };
  }
  return null;
}

/**
 * Retorna todos os milestones já atingidos.
 *
 * @param {number} currentWeeks
 * @returns {Array<{ weeks: number, xpBonus: number, label: string }>}
 */
export function achievedMilestones(currentWeeks) {
  const w = Number(currentWeeks) || 0;
  return STREAK_MILESTONES.filter((m) => w >= m.weeks);
}

/**
 * Bônus cumulativo de XP dos milestones atingidos.
 *
 * @param {number} currentWeeks
 * @returns {number}
 */
export function milestoneXpTotal(currentWeeks) {
  return achievedMilestones(currentWeeks).reduce((s, m) => s + m.xpBonus, 0);
}

// ────────────────────────────────────────────────────────────────────────────
// COMEBACK
// ────────────────────────────────────────────────────────────────────────────

/**
 * XP de comeback (recompensa por voltar depois de 4+ semanas parado).
 * Aplicado uma vez por quebra de streak (não cumulativo).
 */
export const COMEBACK_XP = 200;
export const COMEBACK_MIN_BREAK_WEEKS = 4;

/**
 * Verifica se um comeback bonus deve ser aplicado.
 *
 * @param {StreakMeta} prevMeta
 * @param {number[]} currentDates
 * @param {Date} [now]
 * @returns {boolean}
 */
export function shouldApplyComeback(prevMeta, currentDates, now = new Date()) {
  if (!prevMeta || !prevMeta.lastPlayAt) return false;
  const nowMs = now.getTime();
  const lastPlay = Number(prevMeta.lastPlayAt) || 0;
  const weeksSinceBreak = Math.floor((nowMs - lastPlay) / WEEK_MS);
  if (weeksSinceBreak < COMEBACK_MIN_BREAK_WEEKS) return false;
  if (prevMeta.comebackClaimed) return false;
  // Deve haver pelo menos 1 jogo atual
  return (currentDates || []).some((ms) => Number.isFinite(ms) && ms > 0);
}
