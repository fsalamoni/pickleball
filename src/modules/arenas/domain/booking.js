/**
 * Domínio puro de reservas (bookings) da arena: expansão de recorrência,
 * normalização de slots, transições de status e detecção de conflito.
 * Sem I/O — testável isoladamente.
 */

import { BOOKING_STATUS, BOOKING_KIND } from './constants.js';
import { timeToMinutes } from './pricing.js';

/** 'YYYY-MM-DD' -> Date (local, meia-noite) ou null. */
function parseDate(value) {
  const m = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISODate(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** Dia da semana (0=Dom..6=Sáb) de uma data 'YYYY-MM-DD'. */
export function weekdayOf(dateStr) {
  const d = parseDate(dateStr);
  return d ? d.getDay() : null;
}

/**
 * Valida um slot { date, start, end }.
 * @returns {boolean}
 */
export function isValidSlot(slot = {}) {
  const s = timeToMinutes(slot.start);
  const e = timeToMinutes(slot.end);
  return Boolean(parseDate(slot.date)) && s != null && e != null && e > s;
}

/**
 * Expande uma recorrência semanal em datas concretas.
 * @param {{ weekday:number, start:string, end:string, weeks:number, fromDate:string }} rec
 * @returns {Array<{ date:string, start:string, end:string }>}
 */
export function expandRecurring(rec = {}) {
  const { weekday, start, end } = rec;
  const weeks = Math.max(1, Math.min(52, Math.trunc(Number(rec.weeks) || 0)));
  const from = parseDate(rec.fromDate) || new Date();
  if (!Number.isFinite(weekday) || weekday < 0 || weekday > 6) return [];
  if (timeToMinutes(start) == null || timeToMinutes(end) == null) return [];

  // Primeira ocorrência >= from que caia no weekday desejado.
  const first = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const delta = (weekday - first.getDay() + 7) % 7;
  first.setDate(first.getDate() + delta);

  const slots = [];
  for (let i = 0; i < weeks; i += 1) {
    const d = new Date(first);
    d.setDate(first.getDate() + i * 7);
    slots.push({ date: toISODate(d), start, end });
  }
  return slots;
}

/** Slots de uma reserva (avulsa ou recorrente já expandida/armazenada). */
export function bookingSlots(booking = {}) {
  if (Array.isArray(booking.slots) && booking.slots.length > 0) return booking.slots;
  if (booking.date) return [{ date: booking.date, start: booking.start, end: booking.end }];
  return [];
}

/**
 * Detecta conflito de horário entre dois slots (mesma data, faixas que se
 * sobrepõem).
 */
export function slotsConflict(a, b) {
  if (!a || !b || a.date !== b.date) return false;
  const as = timeToMinutes(a.start);
  const ae = timeToMinutes(a.end);
  const bs = timeToMinutes(b.start);
  const be = timeToMinutes(b.end);
  if ([as, ae, bs, be].some((x) => x == null)) return false;
  return as < be && bs < ae;
}

/**
 * Verifica se um conjunto de slots candidatos conflita com reservas já
 * confirmadas da arena.
 */
export function hasConflictWithConfirmed(candidateSlots = [], confirmedBookings = []) {
  const confirmedSlots = confirmedBookings
    .filter((b) => b.status === BOOKING_STATUS.CONFIRMED)
    .flatMap((b) => bookingSlots(b));
  return candidateSlots.some((c) => confirmedSlots.some((s) => slotsConflict(c, s)));
}

/** Transições de status permitidas (guarda de fluxo). */
const TRANSITIONS = {
  [BOOKING_STATUS.REQUESTED]: [BOOKING_STATUS.NEGOTIATING, BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.DECLINED, BOOKING_STATUS.CANCELLED],
  [BOOKING_STATUS.NEGOTIATING]: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.DECLINED, BOOKING_STATUS.CANCELLED],
  [BOOKING_STATUS.CONFIRMED]: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED],
  [BOOKING_STATUS.DECLINED]: [],
  [BOOKING_STATUS.CANCELLED]: [],
  [BOOKING_STATUS.COMPLETED]: [],
};

export function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

/** Ordena reservas por data do primeiro slot (mais próximas primeiro). */
export function sortBookings(bookings = []) {
  const firstDate = (b) => bookingSlots(b).map((s) => s.date).sort()[0] || '9999';
  return [...bookings].sort((a, b) => firstDate(a).localeCompare(firstDate(b)));
}

export function sortSlots(slots = []) {
  return [...slots].sort((a, b) => `${a.date}_${a.start}`.localeCompare(`${b.date}_${b.start}`));
}

export { BOOKING_KIND };
