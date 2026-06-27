/**
 * Progressão do jogador (lógica pura, sem I/O).
 *
 * XP/nível a partir do resumo de desempenho, streak de semanas ativas a partir
 * das datas dos jogos, e metas pessoais (normalização + progresso).
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Pesos de XP por tipo de atividade. */
export const XP_WEIGHTS = Object.freeze({ played: 10, wins: 20, podiums: 40, titles: 120, tournaments: 30 });

/** XP total a partir do resumo (`buildPlayerStats`). */
export function computeXp(summary = {}) {
  return (
    (Number(summary.played) || 0) * XP_WEIGHTS.played
    + (Number(summary.wins) || 0) * XP_WEIGHTS.wins
    + (Number(summary.podiums) || 0) * XP_WEIGHTS.podiums
    + (Number(summary.titles) || 0) * XP_WEIGHTS.titles
    + (Number(summary.tournaments) || 0) * XP_WEIGHTS.tournaments
  );
}

/**
 * Nível a partir do XP. Cada nível L exige 500*L de XP (incremental).
 * @returns {{ level, xp, xpIntoLevel, xpForNext, progress }}
 */
export function levelFromXp(xp) {
  const total = Math.max(0, Math.floor(Number(xp) || 0));
  let level = 1;
  let need = 500;
  let rem = total;
  while (rem >= need) {
    rem -= need;
    level += 1;
    need = 500 * level;
  }
  return { level, xp: total, xpIntoLevel: rem, xpForNext: need, progress: rem / need };
}

/**
 * Streak de semanas ativas consecutivas terminando na semana do jogo mais
 * recente (a partir das datas em ms).
 * @param {number[]} datesMillis
 * @returns {number}
 */
export function computeWeekStreak(datesMillis) {
  const weeks = [...new Set(
    (datesMillis || [])
      .filter((ms) => Number.isFinite(ms) && ms > 0)
      .map((ms) => Math.floor(ms / WEEK_MS)),
  )].sort((a, b) => a - b);
  if (weeks.length === 0) return 0;
  let streak = 1;
  for (let i = weeks.length - 1; i > 0; i -= 1) {
    if (weeks[i] - weeks[i - 1] === 1) streak += 1;
    else break;
  }
  return streak;
}

/** Métricas suportadas por metas. */
export const GOAL_METRIC = Object.freeze({
  GAMES: 'games',
  WINS: 'wins',
  TOURNAMENTS: 'tournaments',
  RATING: 'rating',
});

export const GOAL_METRIC_LABELS = Object.freeze({
  [GOAL_METRIC.GAMES]: 'Jogos disputados',
  [GOAL_METRIC.WINS]: 'Vitórias',
  [GOAL_METRIC.TOURNAMENTS]: 'Torneios',
  [GOAL_METRIC.RATING]: 'Rating',
});

/** Normaliza/valida o input de uma meta. */
export function normalizeGoalInput(input = {}) {
  const metric = Object.values(GOAL_METRIC).includes(input.metric) ? input.metric : GOAL_METRIC.GAMES;
  const target = Math.max(1, Math.floor(Number(input.target) || 0));
  const errors = {};
  if (!Number(input.target) || Number(input.target) <= 0) errors.target = 'Defina um alvo maior que zero.';
  return { valid: Object.keys(errors).length === 0, errors, value: { metric, target } };
}

/** Progresso de uma meta dado os valores atuais do jogador. */
export function goalProgress(goal, values = {}) {
  const current = Number(values[goal.metric]) || 0;
  const target = Number(goal.target) || 0;
  const ratio = target > 0 ? Math.min(current / target, 1) : 0;
  return { current, target, ratio, done: current >= target && target > 0 };
}
