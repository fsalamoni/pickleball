/**
 * Eventos de gamificação (lógica pura, sem I/O).
 *
 * Catálogo de eventos emitidos quando o user faz ações de gamificação.
 * Estáveis, snake_case, prontos pra Firebase Analytics.
 *
 * **REGRA**: nunca dispare evento de gamificação que não esteja aqui.
 * Garante coerência entre dashboards, métricas e regras de anti-farming.
 */

export const GAMIFICATION_EVENT = Object.freeze({
  // ── XP ─────────────────────────────────────────────────────────
  XP_GAINED: 'gamification_xp_gained',
  XP_CAPPED: 'gamification_xp_capped',
  LEVEL_UP: 'gamification_level_up',
  TIER_UP: 'gamification_tier_up',

  // ── Streak ──────────────────────────────────────────────────────
  STREAK_EXTENDED: 'gamification_streak_extended',
  STREAK_BROKEN: 'gamification_streak_broken',
  STREAK_MILESTONE: 'gamification_streak_milestone',
  GRACE_USED: 'gamification_grace_used',
  VACATION_ACTIVATED: 'gamification_vacation_activated',

  // ── Achievements ───────────────────────────────────────────────
  ACHIEVEMENT_UNLOCKED: 'gamification_achievement_unlocked',
  ACHIEVEMENT_SHARED: 'gamification_achievement_shared',

  // ── Missões ────────────────────────────────────────────────────
  MISSION_PROGRESS: 'gamification_mission_progress',
  MISSION_COMPLETED: 'gamification_mission_completed',
  MISSION_BONUS_CLAIMED: 'gamification_mission_bonus_claimed',

  // ── Referrals ──────────────────────────────────────────────────
  REFERRAL_LINK_GENERATED: 'gamification_referral_link_generated',
  REFERRAL_SHARED: 'gamification_referral_shared',
  REFERRAL_SIGNED_UP: 'gamification_referral_signed_up',
  REFERRAL_ACTIVATED: 'gamification_referral_activated',
  REFERRAL_ORGANIZED: 'gamification_referral_organized',

  // ── Kudos ──────────────────────────────────────────────────────
  KUDOS_GIVEN: 'gamification_kudos_given',
  KUDOS_RECEIVED: 'gamification_kudos_received',
  KUDOS_SPAM_FLAGGED: 'gamification_kudos_spam_flagged',

  // ── Social Bonds ──────────────────────────────────────────────
  RIVAL_ADDED: 'gamification_rival_added',
  CREW_CREATED: 'gamification_crew_created',
  MENTORSHIP_STARTED: 'gamification_mentorship_started',
  MENTORSHIP_GOAL_HIT: 'gamification_mentorship_goal_hit',

  // ── Seasons ────────────────────────────────────────────────────
  SEASON_STARTED: 'gamification_season_started',
  SEASON_TOP_N_REACHED: 'gamification_season_top_n_reached',
  HALL_OF_FAME_FEATURED: 'gamification_hall_of_fame_featured',
});

/**
 * Sanitiza parâmetros do evento para Firebase Analytics.
 * (Mesmo padrão de `sanitizeFunnelParams` no módulo analytics.)
 *
 * @param {Record<string, unknown>} [params]
 * @returns {Record<string, string|number|boolean>}
 */
export function sanitizeGamificationParams(params = {}) {
  const out = {};
  Object.entries(params || {}).forEach(([key, value]) => {
    if (typeof value === 'string') out[key] = value.slice(0, 100);
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'boolean') out[key] = value;
  });
  return out;
}

/**
 * Constrói um evento de gamificação padronizado.
 *
 * @param {string} eventName — chave em GAMIFICATION_EVENT
 * @param {Record<string, unknown>} [params]
 * @param {Date} [now]
 * @returns {{ name: string, params: object, ts: number }}
 */
export function buildGamificationEvent(eventName, params = {}, now = new Date()) {
  if (!Object.values(GAMIFICATION_EVENT).includes(eventName)) {
    throw new Error(`Evento de gamificação desconhecido: ${eventName}`);
  }
  return {
    name: eventName,
    params: sanitizeGamificationParams(params),
    ts: now.getTime(),
  };
}

/**
 * Hook de envio (aqui é só o helper; o consumidor é que decide para onde enviar).
 *
 * @param {{ track: (name: string, params: object) => void }} tracker
 * @returns {(eventName: string, params?: object) => void}
 */
export function createTracker(tracker) {
  if (!tracker || typeof tracker.track !== 'function') {
    return () => {};
  }
  return (eventName, params = {}) => {
    if (!Object.values(GAMIFICATION_EVENT).includes(eventName)) return;
    tracker.track(eventName, sanitizeGamificationParams(params));
  };
}
