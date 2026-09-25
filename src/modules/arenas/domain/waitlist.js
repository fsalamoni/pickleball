/**
 * Domínio: Waitlist (Arena V3 — sprint 1).
 *
 * Lógica pura de fila de espera.
 * Sem I/O, testável.
 */

import { instanteEmMs } from '@/core/domain/instant';

export const WAITLIST_STATUS = Object.freeze({
  WAITING: 'waiting',
  NOTIFIED: 'notified',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
});

/**
 * Janela para aceitar a promoção (em minutos).
 *
 * 🐞 Era 5 aqui e 60 no servidor (`functions/openSlotWaitlist.js`), que é
 * quem de fato chama o próximo: o aviso dizia uma coisa e o prazo era outro.
 * Agora é um número só — há teste de paridade no servidor. Cinco minutos
 * também era curto demais: quem está no trabalho não vê o aviso a tempo.
 */
export const DEFAULT_PROMOTION_WINDOW_MINUTES = 60;

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
  const nowMs = instanteEmMs(now);
  return nowMs > expiresMs;
}

/**
 * 🐞 Era `x instanceof Date ? x.getTime() : Number(x)`. O servidor grava a
 * chamada com `Timestamp.fromMillis(...)`, e `Number(timestamp)` dá segundos
 * desde o ano 1 — toda chamada "vencia" no instante em que chegava, e
 * "Aceitar" respondia "Promoção expirou" para todo mundo. Ver
 * `core/domain/instant.js`.
 */
function notificationExpiresMs(item) {
  if (!item) return NaN;
  if (item.notification_expires_at) return instanteEmMs(item.notification_expires_at);
  if (item.notified_at && item.window_minutes) {
    return instanteEmMs(item.notified_at) + item.window_minutes * 60_000;
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
  const ms = instanteEmMs(notifiedAt);
  if (!Number.isFinite(ms)) return null;
  return ms + windowMinutes * 60_000;
}
