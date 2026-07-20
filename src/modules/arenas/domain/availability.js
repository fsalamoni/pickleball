/**
 * Agenda semanal da arena (flag arena_calendar).
 *
 * Constrói o modelo da grade de disponibilidade a partir das reservas
 * existentes: colunas por dia da semana e blocos ocupados (confirmados ou
 * pendentes) posicionados por horário. Puro — sem Firebase.
 */

import { BOOKING_STATUS } from './constants.js';
import { timeToMinutes } from './pricing.js';
import { bookingSlots } from './booking.js';

export const AGENDA_TONE = Object.freeze({
  CONFIRMED: 'confirmed',
  PENDING: 'pending',
});

const PENDING_STATUSES = new Set([BOOKING_STATUS.REQUESTED, BOOKING_STATUS.NEGOTIATING]);

function parseISODate(value) {
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

/** Segunda-feira da semana da data informada (ISO 'YYYY-MM-DD'). */
export function weekStartOf(date = new Date()) {
  const d = date instanceof Date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : parseISODate(date);
  if (!d) return null;
  const delta = (d.getDay() + 6) % 7; // 0=Dom → 6; 1=Seg → 0
  d.setDate(d.getDate() - delta);
  return toISODate(d);
}

/** Desloca o início da semana em N semanas (ISO). */
export function shiftWeekStart(weekStartISO, deltaWeeks) {
  const d = parseISODate(weekStartISO);
  if (!d) return weekStartISO;
  d.setDate(d.getDate() + Math.trunc(deltaWeeks || 0) * 7);
  return toISODate(d);
}

/** As 7 datas (ISO) da semana a partir da segunda-feira informada. */
export function weekDays(weekStartISO) {
  const start = parseISODate(weekStartISO);
  if (!start) return [];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toISODate(d);
  });
}

function bookingTone(status) {
  if (status === BOOKING_STATUS.CONFIRMED) return AGENDA_TONE.CONFIRMED;
  if (PENDING_STATUSES.has(status)) return AGENDA_TONE.PENDING;
  return null;
}

/**
 * Monta a grade da semana a partir das reservas.
 *
 * @param {{
 *   weekStart: string,
 *   bookings?: Array<object>,
 *   dayStart?: string,
 *   dayEnd?: string,
 * }} input
 * @returns {{
 *   weekStart: string,
 *   windowStart: number,
 *   windowEnd: number,
 *   days: Array<{ date: string, entries: Array<{
 *     bookingId: string|null, label: string, tone: string,
 *     start: string, end: string, startMinutes: number, endMinutes: number,
 *   }> }>,
 *   totalEntries: number,
 * }}
 */
export function buildWeekAgenda({ weekStart, bookings = [], dayStart = '06:00', dayEnd = '23:00' } = {}) {
  const days = weekDays(weekStart).map((date) => ({ date, entries: [] }));
  const byDate = new Map(days.map((day) => [day.date, day]));
  const windowStart = timeToMinutes(dayStart) ?? 0;
  const windowEnd = timeToMinutes(dayEnd) ?? 24 * 60;
  let totalEntries = 0;

  bookings.forEach((booking) => {
    const tone = bookingTone(booking?.status);
    if (!tone) return;
    bookingSlots(booking).forEach((slot) => {
      const day = byDate.get(slot.date);
      if (!day) return;
      const start = timeToMinutes(slot.start);
      const end = timeToMinutes(slot.end);
      if (start == null || end == null || end <= start) return;
      const clippedStart = Math.max(start, windowStart);
      const clippedEnd = Math.min(end, windowEnd);
      if (clippedEnd <= clippedStart) return;
      day.entries.push({
        bookingId: booking.id || null,
        label: booking.athlete_name || 'Reserva',
        tone,
        start: slot.start,
        end: slot.end,
        startMinutes: clippedStart,
        endMinutes: clippedEnd,
      });
      totalEntries += 1;
    });
  });

  days.forEach((day) => {
    day.entries.sort((a, b) => a.startMinutes - b.startMinutes);
  });

  return { weekStart, windowStart, windowEnd, days, totalEntries };
}

/** Rótulo curto do intervalo da semana, ex.: "12/01 – 18/01". */
export function formatWeekRange(weekStartISO) {
  const days = weekDays(weekStartISO);
  if (days.length === 0) return '';
  const fmt = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return `${fmt(days[0])} – ${fmt(days[6])}`;
}
