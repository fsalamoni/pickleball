/**
 * Constantes do módulo de Arenas (puro, sem I/O).
 */

export const ARENA_COLLECTIONS = Object.freeze({
  arenas: 'arenas',
  managers: 'arena_managers',
  bookings: 'arena_bookings',
  reviews: 'arena_reviews',
  favorites: 'arena_favorites',
  courts: 'arena_courts',
  court_schedules: 'arena_court_schedules',
});

export const ARENA_MANAGER_ROLE = Object.freeze({
  OWNER: 'owner',
  MANAGER: 'manager',
});

/** Status do ciclo de vida de uma solicitação de reserva. */
export const BOOKING_STATUS = Object.freeze({
  REQUESTED: 'requested',
  NEGOTIATING: 'negotiating',
  CONFIRMED: 'confirmed',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
});

export const BOOKING_STATUS_LABELS = Object.freeze({
  [BOOKING_STATUS.REQUESTED]: 'Solicitada',
  [BOOKING_STATUS.NEGOTIATING]: 'Em negociação',
  [BOOKING_STATUS.CONFIRMED]: 'Confirmada',
  [BOOKING_STATUS.DECLINED]: 'Recusada',
  [BOOKING_STATUS.CANCELLED]: 'Cancelada',
  [BOOKING_STATUS.COMPLETED]: 'Concluída',
});

/** Status de pagamento (manual — sem gateway no cliente). */
export const PAYMENT_STATUS = Object.freeze({
  NONE: 'none',
  PENDING: 'pending',
  PAID: 'paid',
  REFUNDED: 'refunded',
});

export const PAYMENT_STATUS_LABELS = Object.freeze({
  [PAYMENT_STATUS.NONE]: 'Sem cobrança',
  [PAYMENT_STATUS.PENDING]: 'Pagamento pendente',
  [PAYMENT_STATUS.PAID]: 'Pago',
  [PAYMENT_STATUS.REFUNDED]: 'Reembolsado',
});

export const BOOKING_KIND = Object.freeze({
  SINGLE: 'single',
  RECURRING: 'recurring',
});

/** Tipos de manifestação do atleta sobre a arena. */
export const REVIEW_TYPE = Object.freeze({
  REVIEW: 'review',
  COMPLAINT: 'complaint',
  SUGGESTION: 'suggestion',
});

export const REVIEW_TYPE_LABELS = Object.freeze({
  [REVIEW_TYPE.REVIEW]: 'Avaliação',
  [REVIEW_TYPE.COMPLAINT]: 'Reclamação',
  [REVIEW_TYPE.SUGGESTION]: 'Sugestão',
});

export const WEEKDAY_LABELS = Object.freeze([
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado',
]);

export const WEEKDAY_SHORT = Object.freeze(['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']);
