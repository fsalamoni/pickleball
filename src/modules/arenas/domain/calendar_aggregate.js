/**
 * Agregação de status por dia (Sprint 5+ / sw-v73.5).
 *
 * Dado uma data + arena (schedules + bookings + unavailabilities), retorna
 * o status agregado do dia para exibição no calendário público MENSAL.
 *
 * Regras (PRD):
 * - Dia "fechado" cinza: arena sem schedule aberto naquele dia da semana
 *   (admin não definiu horário aberto) OU todos os slots são CLOSED.
 *   NÃO clicável.
 * - Dia "disponível" verde: tem pelo menos 1 slot AVAILABLE.
 * - Dia "ocupado" amber/vermelho: tem slots mas todos PENDING/CONFIRMED.
 *   Clicável para ver detalhe (sem seleção).
 * - Dia "indisponível" laranja: admin marcou indisponibilidade no dia todo.
 *
 * Implementação: gera todos os time slots de 1h do dia (filtrando por
 * weekday + court_id), calcula status de cada um via getSlotStatus,
 * e retorna o status mais "livre" (available > pending > confirmed >
 * unavailable > closed).
 */

import { getSlotStatus, SLOT_STATUS } from './slot_status.js';
import { generateTimeSlots } from './slot_status.js';
import { weekdayOf } from './booking.js';

const STEP = 60; // min — 1 hora

function getDaySchedules(schedules, weekday) {
  return schedules.filter(
    (s) => s.is_active !== false && Array.isArray(s.weekdays) && s.weekdays.includes(weekday),
  );
}

function filterByCourt(schedules, courtId) {
  if (!courtId) return schedules;
  return schedules.filter((s) => !s.court_id || s.court_id === courtId);
}

function generateDayTimes(schedules) {
  const ranges = schedules.map((s) => ({ start: s.start_time, end: s.end_time }));
  const allTimes = new Set();
  for (const r of ranges) {
    generateTimeSlots(r.start, r.end, STEP).forEach((t) => allTimes.add(t));
  }
  return Array.from(allTimes).sort();
}

function aggregateDayStatus({
  date,
  courtId = null,
  schedules = [],
  bookings = [],
  unavailabilities = [],
} = {}) {
  const weekday = weekdayOf(date);
  if (weekday == null) {
    return { dayStatus: SLOT_STATUS.CLOSED, hasAvailable: false, isAllClosed: true, count: 0 };
  }

  const daySchedules = getDaySchedules(schedules, weekday);
  if (daySchedules.length === 0) {
    return { dayStatus: SLOT_STATUS.CLOSED, hasAvailable: false, isAllClosed: true, count: 0 };
  }

  const filteredSchedules = filterByCourt(daySchedules, courtId);
  if (filteredSchedules.length === 0) {
    return { dayStatus: SLOT_STATUS.CLOSED, hasAvailable: false, isAllClosed: true, count: 0 };
  }

  const times = generateDayTimes(filteredSchedules);
  if (times.length === 0) {
    return { dayStatus: SLOT_STATUS.CLOSED, hasAvailable: false, isAllClosed: true, count: 0 };
  }

  const filteredBookings = courtId
    ? bookings.filter((b) => !b.court_id || b.court_id === courtId)
    : bookings;
  const filteredUnavailabilities = courtId
    ? unavailabilities.filter((u) => !u.court_id || u.court_id === courtId)
    : unavailabilities;

  let available = 0, unavailable = 0, pending = 0, confirmed = 0;
  for (const time of times) {
    const { status } = getSlotStatus({
      date, time, courtId,
      schedules: filteredSchedules,
      bookings: filteredBookings,
      unavailabilities: filteredUnavailabilities,
    });
    if (status === SLOT_STATUS.AVAILABLE) available += 1;
    else if (status === SLOT_STATUS.UNAVAILABLE) unavailable += 1;
    else if (status === SLOT_STATUS.PENDING) pending += 1;
    else if (status === SLOT_STATUS.CONFIRMED) confirmed += 1;
  }

  let dayStatus;
  if (available > 0) dayStatus = SLOT_STATUS.AVAILABLE;
  else if (pending > 0) dayStatus = SLOT_STATUS.PENDING;
  else if (confirmed > 0) dayStatus = SLOT_STATUS.CONFIRMED;
  else if (unavailable > 0) dayStatus = SLOT_STATUS.UNAVAILABLE;
  else dayStatus = SLOT_STATUS.CLOSED;

  return {
    dayStatus,
    hasAvailable: available > 0,
    isAllClosed: available === 0 && pending === 0 && confirmed === 0 && unavailable === 0,
    count: { available, unavailable, pending, confirmed },
  };
}

/** Gera a grade 7×6 de strings 'YYYY-MM-DD' começando pelo domingo da semana do dia 1. */
function buildMonthGrid(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const firstWeekday = first.getDay();
  const start = new Date(y, m - 1, 1 - firstWeekday);
  const grid = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    grid.push(d.toISOString().slice(0, 10));
  }
  return grid;
}

export { aggregateDayStatus, buildMonthGrid };
