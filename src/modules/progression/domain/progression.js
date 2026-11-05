import { t, tk } from '@/core/i18n';
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
  [GOAL_METRIC.GAMES]: tk('Jogos disputados'),
  [GOAL_METRIC.WINS]: tk('Vitórias'),
  [GOAL_METRIC.TOURNAMENTS]: tk('Torneios'),
  [GOAL_METRIC.RATING]: tk('Rating'),
});

/**
 * META DA TEMPORADA (Carreira, docs/54 §4.10): a meta com `kind`.
 * As antigas (sem `kind`) seguem idênticas — `{ metric, target }`, contadores
 * de toda a vida. Valores GRAVADOS: nunca renomeie.
 */
export const GOAL_KIND = Object.freeze({ OUTCOME: 'outcome', PROCESS: 'process' });
export const GOAL_STATUS = Object.freeze({ ACTIVE: 'active', DONE: 'done', DROPPED: 'dropped' });
/** Métricas da carreira: contam DATAS na janela da meta (`since` → `due_date`). */
export const SEASON_GOAL_METRIC = Object.freeze({
  CAREER_EVENTS_PLAYED: 'career_events_played',
  CAREER_PODIUMS: 'career_podiums',
  FEDERATED_EVENTS: 'federated_events',
  DUPR_RATING: 'dupr_rating',
});
export const GOAL_LIMITS = Object.freeze({ title: 120, ifThen: 200 });

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TODAS_AS_METRICAS = new Set([...Object.values(GOAL_METRIC), ...Object.values(SEASON_GOAL_METRIC)]);
/** Métricas de NÍVEL (um número de agora, não uma contagem): a janela não se aplica. */
const METRICA_DE_NIVEL = new Set([GOAL_METRIC.RATING, SEASON_GOAL_METRIC.DUPR_RATING]);
const txtMeta = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function normalizeSeasonGoal(input) {
  const errors = {};
  const kind = input.kind === GOAL_KIND.PROCESS ? GOAL_KIND.PROCESS : GOAL_KIND.OUTCOME;
  const title = txtMeta(input.title, GOAL_LIMITS.title);
  if (!title) errors.title = t('Dê um nome à meta.');
  const since = ISO.test(String(input.since || '')) ? input.since : null;
  const due = ISO.test(String(input.due_date || '')) ? input.due_date : null;
  if (!due) errors.due_date = t('Escolha o prazo da meta.');
  else if (since && due < since) errors.due_date = t('O prazo vem depois do início.');
  const value = {
    kind, title, since, due_date: due,
    status: Object.values(GOAL_STATUS).includes(input.status) ? input.status : GOAL_STATUS.ACTIVE,
  };
  const ifThen = txtMeta(input.if_then, GOAL_LIMITS.ifThen);
  if (ifThen) value.if_then = ifThen;
  if (typeof input.aspect_id === 'string' && /^[a-z_]{2,40}$/.test(input.aspect_id)) value.aspect_id = input.aspect_id;
  if (kind === GOAL_KIND.PROCESS) {
    value.progress_manual = Math.max(0, Math.min(100, Math.round(Number(input.progress_manual) || 0)));
  } else if (TODAS_AS_METRICAS.has(input.metric)) {
    value.metric = input.metric;
    const alvo = Number(input.target);
    if (!Number.isFinite(alvo) || alvo <= 0) errors.target = t('Defina um alvo maior que zero.');
    // Rating tem casas decimais; contagem é inteira.
    value.target = METRICA_DE_NIVEL.has(input.metric) ? Math.round(alvo * 1000) / 1000 : Math.max(1, Math.floor(alvo || 0));
  }
  return { valid: Object.keys(errors).length === 0, errors, value };
}

/** Normaliza/valida o input de uma meta. Com `kind` é a meta da temporada; sem, a de sempre. */
export function normalizeGoalInput(input = {}) {
  if (input.kind) return normalizeSeasonGoal(input);
  const metric = Object.values(GOAL_METRIC).includes(input.metric) ? input.metric : GOAL_METRIC.GAMES;
  const target = Math.max(1, Math.floor(Number(input.target) || 0));
  const errors = {};
  if (!Number(input.target) || Number(input.target) <= 0) errors.target = t('Defina um alvo maior que zero.');
  return { valid: Object.keys(errors).length === 0, errors, value: { metric, target } };
}

/**
 * Progresso de uma meta dado os valores atuais do jogador.
 *
 * Meta antiga: `values[metric]` é o contador de toda a vida (igual a sempre).
 * Meta da temporada: a de PROCESSO usa `progress_manual` (0–100); a de
 * resultado conta só as DATAS (`values[metric]` = lista `AAAA-MM-DD`) dentro
 * da janela `since` → `due_date`. Valor que não veio (fonte que falhou) ⇒
 * `unknown: true` — nunca vira zero. Concluída à mão ⇒ `done`; abandonada ⇒
 * `dropped` (não é falha: só sai das ativas).
 */
export function goalProgress(goal, values = {}) {
  if (!goal?.kind) {
    const current = Number(values[goal.metric]) || 0;
    const target = Number(goal.target) || 0;
    const ratio = target > 0 ? Math.min(current / target, 1) : 0;
    return { current, target, ratio, done: current >= target && target > 0 };
  }
  const marcado = { done: goal.status === GOAL_STATUS.DONE, dropped: goal.status === GOAL_STATUS.DROPPED };
  if (goal.kind === GOAL_KIND.PROCESS) {
    const current = Number(goal.progress_manual) || 0;
    return { current, target: 100, ratio: current / 100, unknown: false, ...marcado, done: marcado.done || current >= 100 };
  }
  if (!goal.metric) return { current: null, target: null, ratio: marcado.done ? 1 : 0, unknown: false, manual: true, ...marcado };
  const target = Number(goal.target) || 0;
  const v = values[goal.metric];
  let current;
  if (Array.isArray(v)) {
    current = v.filter((d) => ISO.test(String(d)) && (!goal.since || d >= goal.since) && (!goal.due_date || d <= goal.due_date)).length;
  } else if (METRICA_DE_NIVEL.has(goal.metric) && Number.isFinite(Number(v)) && v !== null && v !== '') {
    current = Number(v);
  } else {
    return { current: null, target, ratio: 0, unknown: true, ...marcado };
  }
  const ratio = target > 0 ? Math.min(current / target, 1) : 0;
  return { current, target, ratio, unknown: false, ...marcado, done: marcado.done || (current >= target && target > 0) };
}
