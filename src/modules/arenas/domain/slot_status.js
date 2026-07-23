/**
 * Domínio puro de status de slot de horário (Sprint 5).
 *
 * Dado uma arena + dia + horário (slot), determina se está:
 * - 'closed': fora do horário de funcionamento
 * - 'unavailable': admin marcou indisponibilidade
 * - 'pending': reserva solicitada/negociando (REQUESTED/NEGOTIATING)
 * - 'confirmed': reserva confirmada (CONFIRMED)
 * - 'completed': reserva concluída
 * - 'available': aberto e livre
 *
 * Esses status são usados pelo calendário público e admin para
 * colorir os slots e mostrar ao usuário.
 */

import { timeToMinutes } from './pricing.js';
import { weekdayOf } from './booking.js';
import { BOOKING_STATUS } from './constants.js';

export const SLOT_STATUS = Object.freeze({
  CLOSED: 'closed',
  UNAVAILABLE: 'unavailable',
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  AVAILABLE: 'available',
});

export const SLOT_STATUS_LABELS = Object.freeze({
  closed: 'Fechado',
  unavailable: 'Indisponível',
  pending: 'Reserva pendente',
  confirmed: 'Reservado',
  completed: 'Concluído',
  available: 'Disponível',
});

export const SLOT_STATUS_COLORS = Object.freeze({
  closed: { bg: 'bg-gray-100', text: 'text-gray-400', dot: 'bg-gray-300', border: 'border-gray-200' },
  unavailable: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-orange-200' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-500', border: 'border-amber-300' },
  confirmed: { bg: 'bg-red-50', text: 'text-red-800', dot: 'bg-red-500', border: 'border-red-300' },
  completed: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-400', border: 'border-green-200' },
  available: { bg: 'bg-green-50', text: 'text-green-800', dot: 'bg-green-500', border: 'border-green-300' },
});

const ACTIVE_BOOKING_STATUSES = new Set([
  BOOKING_STATUS.REQUESTED,
  BOOKING_STATUS.NEGOTIATING,
  BOOKING_STATUS.CONFIRMED,
]);

/** Encontra o schedule (recorrente) que cobre a data + hora para a quadra. */
function findActiveSchedule(schedules, dateStr, timeStr) {
  const weekday = weekdayOf(dateStr);
  const time = timeToMinutes(timeStr);
  if (weekday == null || time == null) return null;
  return schedules.find((s) => {
    if (!s.is_active) return false;
    if (!Array.isArray(s.weekdays) || !s.weekdays.includes(weekday)) return false;
    const start = timeToMinutes(s.start_time);
    const end = timeToMinutes(s.end_time);
    return time >= start && time < end;
  }) || null;
}

/** Encontra a reserva (ativa) que cobre essa data+hora+quadra (opcional). */
function findActiveBooking(bookings, courtId, dateStr, timeStr) {
  const time = timeToMinutes(timeStr);
  if (time == null) return null;
  return bookings.find((b) => {
    if (!ACTIVE_BOOKING_STATUSES.has(b.status)) return false;
    if (courtId && b.court_id && b.court_id !== courtId) return false;
    if (courtId && !b.court_id) return false; // booking legado sem court_id não bloqueia quadras específicas
    if (Array.isArray(b.slots)) {
      return b.slots.some((slot) => slot.date === dateStr && timeToMinutes(slot.start) <= time && time < timeToMinutes(slot.end));
    }
    return false;
  }) || null;
}

/** Encontra indisponibilidade marcada pelo admin pra essa data+hora+quadra. */
function findUnavailability(unavailabilities, courtId, dateStr, timeStr) {
  const time = timeToMinutes(timeStr);
  if (time == null) return null;
  return unavailabilities.find((u) => {
    if (u.date !== dateStr) return false;
    if (courtId && u.court_id && u.court_id !== courtId) return false;
    const start = timeToMinutes(u.start_time);
    const end = timeToMinutes(u.end_time);
    return time >= start && time < end;
  }) || null;
}

/**
 * Determina o status de um slot.
 * @param {Object} args
 * @param {string} args.date - 'YYYY-MM-DD'
 * @param {string} args.time - 'HH:MM'
 * @param {string} [args.courtId] - quadra (opcional)
 * @param {Array} [args.schedules] - arena_court_schedules ativos
 * @param {Array} [args.bookings] - reservas ativas
 * @param {Array} [args.unavailabilities] - indisponibilidades marcadas
 * @param {Array} [args.bookings_completed] - reservas concluídas (opcional)
 * @returns {Object} { status, booking?, schedule?, unavailability? }
 */
export function getSlotStatus({ date, time, courtId, schedules = [], bookings = [], unavailabilities = [], bookings_completed = [] } = {}) {
  // 1. Tem booking concluído?
  const completed = bookings_completed.find((b) => {
    if (courtId && b.court_id && b.court_id !== courtId) return false;
    return Array.isArray(b.slots) && b.slots.some((s) => s.date === date && timeToMinutes(s.start) <= timeToMinutes(time) && timeToMinutes(time) < timeToMinutes(s.end));
  });
  if (completed) {
    return { status: SLOT_STATUS.COMPLETED, booking: completed, schedule: null, unavailability: null };
  }

  // 2. Tem indisponibilidade?
  const unav = findUnavailability(unavailabilities, courtId, date, time);
  if (unav) {
    return { status: SLOT_STATUS.UNAVAILABLE, booking: null, schedule: null, unavailability: unav };
  }

  // 3. Tem booking ativo?
  const booking = findActiveBooking(bookings, courtId, date, time);
  if (booking) {
    const isConfirmed = booking.status === BOOKING_STATUS.CONFIRMED;
    return {
      status: isConfirmed ? SLOT_STATUS.CONFIRMED : SLOT_STATUS.PENDING,
      booking,
      schedule: null,
      unavailability: null,
    };
  }

  // 4. Tem schedule (aberto)?
  const schedule = findActiveSchedule(schedules, date, time);
  if (schedule) {
    return { status: SLOT_STATUS.AVAILABLE, booking: null, schedule, unavailability: null };
  }

  // 5. Fora do horário
  return { status: SLOT_STATUS.CLOSED, booking: null, schedule: null, unavailability: null };
}

/** Gera lista de slots (time slots) entre startTime e endTime, com passo (min). */
export function generateTimeSlots(startTime, endTime, stepMinutes = 60) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start == null || end == null || end <= start) return [];
  const slots = [];
  for (let t = start; t < end; t += stepMinutes) {
    const h = String(Math.floor(t / 60)).padStart(2, '0');
    const m = String(t % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
  }
  return slots;
}

/** Indica se o slot pode ser selecionado (público) para nova reserva. */
export function isSlotSelectable(status) {
  return status === SLOT_STATUS.AVAILABLE;
}

/** Indica se o slot pode ser clicado pelo admin (todos exceto closed). */
export function isSlotClickable(status) {
  return status !== SLOT_STATUS.CLOSED;
}

/** Resumo: agrupa slots por status (para dashboard). */
export function summarizeSlotStatuses(slotsWithStatus) {
  const counts = { closed: 0, unavailable: 0, pending: 0, confirmed: 0, completed: 0, available: 0 };
  for (const s of slotsWithStatus) {
    counts[s.status] = (counts[s.status] || 0) + 1;
  }
  return counts;
}
