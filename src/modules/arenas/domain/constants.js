import { tk } from '@/core/i18n';
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
  unavailabilities: 'arena_unavailabilities',
  inventory_products: 'arena_inventory_products',
  inventory_entries: 'arena_inventory_entries',
  inventory_exits: 'arena_inventory_exits',
  catalog_products: 'catalog_products',
  market_reports: 'arena_market_reports',
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
  [BOOKING_STATUS.REQUESTED]: tk('Solicitada'),
  [BOOKING_STATUS.NEGOTIATING]: tk('Em negociação'),
  [BOOKING_STATUS.CONFIRMED]: tk('Confirmada'),
  [BOOKING_STATUS.DECLINED]: tk('Recusada'),
  [BOOKING_STATUS.CANCELLED]: tk('Cancelada'),
  [BOOKING_STATUS.COMPLETED]: tk('Concluída'),
});

/** Status de pagamento (manual — sem gateway no cliente). */
export const PAYMENT_STATUS = Object.freeze({
  NONE: 'none',
  PENDING: 'pending',
  PAID: 'paid',
  REFUNDED: 'refunded',
});

export const PAYMENT_STATUS_LABELS = Object.freeze({
  [PAYMENT_STATUS.NONE]: tk('Sem cobrança'),
  [PAYMENT_STATUS.PENDING]: tk('Pagamento pendente'),
  [PAYMENT_STATUS.PAID]: tk('Pago'),
  [PAYMENT_STATUS.REFUNDED]: tk('Reembolsado'),
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
  [REVIEW_TYPE.REVIEW]: tk('Avaliação'),
  [REVIEW_TYPE.COMPLAINT]: tk('Reclamação'),
  [REVIEW_TYPE.SUGGESTION]: tk('Sugestão'),
});

export const WEEKDAY_LABELS = Object.freeze([
  tk('Domingo'), tk('Segunda'), tk('Terça'), tk('Quarta'), tk('Quinta'), tk('Sexta'), tk('Sábado'),
]);

export const WEEKDAY_SHORT = Object.freeze([tk('Dom'), tk('Seg'), tk('Ter'), tk('Qua'), tk('Qui'), tk('Sex'), tk('Sáb')]);
