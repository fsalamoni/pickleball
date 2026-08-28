/**
 * Domínio puro do "resumo da semana" da arena (flag arena_ops_kpis).
 *
 * Complementa `arena_metrics.js` com o recorte semanal + mapa de calor de
 * horários + no-show — a visão sintética "como foi minha semana?". Sem I/O.
 */

import { BOOKING_STATUS } from './constants.js';
import { timeToMinutes } from './court_schedule.js';
import { weekdayOf } from './calendar.js';

const CONFIRMED = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED];

/** Slots de uma reserva (array `slots` ou o par único date/start/end). */
export function bookingSlots(b) {
  if (Array.isArray(b?.slots)) return b.slots;
  return (b?.date && b?.start && b?.end) ? [{ date: b.date, start: b.start, end: b.end }] : [];
}

/** Reservas cujo algum slot cai no intervalo [fromISO, toISO] (inclusive). */
export function bookingsInRange(bookings, fromISO, toISO) {
  if (!fromISO || !toISO) return bookings || [];
  return (bookings || []).filter((b) => bookingSlots(b).some((s) => s.date >= fromISO && s.date <= toISO));
}

/**
 * Resumo da semana: receita confirmada, nº de reservas, horas ocupadas,
 * no-shows e taxa de no-show.
 * @param {Array<object>} bookings
 * @param {{ fromISO?: string, toISO?: string }} [range]
 */
export function weekSummary(bookings, range = {}) {
  const inWeek = bookingsInRange(bookings, range.fromISO, range.toISO);
  const confirmed = inWeek.filter((b) => CONFIRMED.includes(b?.status));
  const revenue = confirmed.reduce(
    (acc, b) => acc + (Number(b.agreed_price) || Number(b.proposed_price) || 0),
    0,
  );
  let bookedMin = 0;
  confirmed.forEach((b) => bookingSlots(b).forEach((s) => {
    const a = timeToMinutes(s.start);
    const e = timeToMinutes(s.end);
    if (a != null && e != null && e > a) bookedMin += e - a;
  }));
  const noShows = inWeek.filter((b) => b?.no_show === true).length;
  const noShowRate = confirmed.length > 0
    ? Math.round((noShows / confirmed.length) * 1000) / 10
    : null;
  return {
    revenue,
    bookings: inWeek.length,
    confirmed: confirmed.length,
    bookedHours: Math.round((bookedMin / 60) * 10) / 10,
    noShows,
    noShowRate,
  };
}

/** Faixas de hora padrão do mapa de calor (6h–22h). */
export const HEATMAP_HOURS = Array.from({ length: 17 }, (_, i) => 6 + i);

/**
 * Mapa de calor de ocupação: grade [dia da semana 0–6][faixa de hora] com a
 * contagem de slots confirmados que começam naquela hora.
 * @returns {{ hours: number[], grid: number[][], max: number }}
 */
export function bookingsHeatmap(bookings, { hours = HEATMAP_HOURS } = {}) {
  const grid = Array.from({ length: 7 }, () => hours.map(() => 0));
  let max = 0;
  (bookings || [])
    .filter((b) => CONFIRMED.includes(b?.status))
    .forEach((b) => bookingSlots(b).forEach((s) => {
      const dow = weekdayOf(s.date);
      const startMin = timeToMinutes(s.start);
      if (dow == null || dow < 0 || dow > 6 || startMin == null) return;
      const hour = Math.floor(startMin / 60);
      const col = hours.indexOf(hour);
      if (col < 0) return;
      grid[dow][col] += 1;
      if (grid[dow][col] > max) max = grid[dow][col];
    }));
  return { hours, grid, max };
}
