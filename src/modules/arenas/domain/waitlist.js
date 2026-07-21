/**
 * Domínio: Waitlist (Arena V3 — sprint 1).
 *
 * Lógica pura de fila de espera.
 * Sem I/O, testável.
 */

export const WAITLIST_STATUS = Object.freeze({
  WAITING: 'waiting',
  NOTIFIED: 'notified',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
});

/** Janela padrão para aceitar a promoção (em minutos). */
export const DEFAULT_PROMOTION_WINDOW_MINUTES = 5;

/**
 * Próximo da fila (status = 'waiting', menor position).
 * @param {Array<{position?: number, status: string, ...}>} waitlist
 * @returns {Object|null}
 */
export function getNextInLine(waitlist) {
  if (!Array.isArray(waitlist) || waitlist.length === 0) return null;
  const waiting = waitlist
    .filter((w) => w.status === WAITLIST_STATUS.WAITING)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return waiting[0] || null;
}

/**
 * Verifica se uma notificação expirou.
 * @param {Object} waitlistItem
 * @param {Date|number} [now]
 * @returns {boolean}
 */
export function isPromotionExpired(waitlistItem, now = Date.now()) {
  if (!waitlistItem) return false;
  if (waitlistItem.status !== WAITLIST_STATUS.NOTIFIED) return false;
  const expiresMs = notificationExpiresMs(waitlistItem);
  if (!Number.isFinite(expiresMs)) return false;
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  return nowMs > expiresMs;
}

function notificationExpiresMs(item) {
  if (!item) return NaN;
  if (item.notification_expires_at) {
    return item.notification_expires_at instanceof Date
      ? item.notification_expires_at.getTime()
      : Number(item.notification_expires_at);
  }
  if (item.notified_at && item.window_minutes) {
    const notifiedMs = item.notified_at instanceof Date
      ? item.notified_at.getTime()
      : Number(item.notified_at);
    return notifiedMs + item.window_minutes * 60_000;
  }
  return NaN;
}

/**
 * Calcula a próxima posição na fila (1-based).
 */
export function getNextPosition(waitlist) {
  if (!Array.isArray(waitlist) || waitlist.length === 0) return 1;
  const maxPos = waitlist.reduce((acc, w) => Math.max(acc, w.position || 0), 0);
  return maxPos + 1;
}

/**
 * Reordena a fila após alguém sair/cancelar.
 * Compacta positions para ficarem 1, 2, 3...
 */
export function compactPositions(waitlist) {
  if (!Array.isArray(waitlist)) return [];
  const waiting = waitlist
    .filter((w) => w.status === WAITLIST_STATUS.WAITING)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return waiting.map((w, idx) => ({ ...w, position: idx + 1 }));
}

/**
 * Valida se user pode entrar na fila.
 */
export function canJoinWaitlist(slot, user, existingEntry) {
  if (!user?.uid) return { ok: false, reason: 'Faça login.' };
  if (existingEntry && existingEntry.status !== WAITLIST_STATUS.DECLINED && existingEntry.status !== WAITLIST_STATUS.EXPIRED && existingEntry.status !== WAITLIST_STATUS.CANCELLED) {
    return { ok: false, reason: 'Você já está na fila.' };
  }
  return { ok: true };
}

/**
 * Aceita uma promoção (move de 'notified' para 'accepted').
 * Retorna ações a executar (puro).
 */
export function buildAcceptPromotionAction(waitlistItem, actor) {
  if (!waitlistItem) return null;
  if (waitlistItem.status !== WAITLIST_STATUS.NOTIFIED) return null;
  if (isPromotionExpired(waitlistItem)) return null;
  if (waitlistItem.athlete_id !== actor?.uid) return null;
  return {
    type: 'accept',
    item: { ...waitlistItem, status: WAITLIST_STATUS.ACCEPTED },
  };
}

/**
 * Recusa uma promoção.
 */
export function buildDeclinePromotionAction(waitlistItem, actor) {
  if (!waitlistItem) return null;
  if (waitlistItem.status !== WAITLIST_STATUS.NOTIFIED) return null;
  if (waitlistItem.athlete_id !== actor?.uid) return null;
  return {
    type: 'decline',
    item: { ...waitlistItem, status: WAITLIST_STATUS.DECLINED },
  };
}

/**
 * Calcula timestamp de expiração.
 */
export function computePromotionExpiresAt(notifiedAt, windowMinutes = DEFAULT_PROMOTION_WINDOW_MINUTES) {
  if (!notifiedAt) return null;
  const ms = notifiedAt instanceof Date ? notifiedAt.getTime() : Number(notifiedAt);
  if (!Number.isFinite(ms)) return null;
  return ms + windowMinutes * 60_000;
}
