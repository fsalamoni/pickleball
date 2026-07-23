/**
 * Domínio puro de disponibilidade do professor (Sistema A — produto de aulas).
 *
 * Modelo (`coach_availability/{coachId}`, 1 doc por professor):
 *  - windows: janelas semanais recorrentes
 *    [{ id, weekdays:[0..6], start:'HH:MM', end:'HH:MM', arena_id?, location? }]
 *  - exceptions: folgas/férias [{ date:'YYYY-MM-DD', reason }]
 *  - slot_minutes: duração padrão de uma aula (default 60)
 *
 * A partir das janelas, gera os horários (slots) livres de um dia, descontando
 * as aulas já confirmadas (busy). Sem I/O — testável isoladamente.
 *
 * Reusa `weekdayOf` (booking) e `timeToMinutes` (pricing) para evitar
 * duplicação de regras de data/horário.
 */

import { weekdayOf, slotsConflict } from '../../arenas/domain/booking.js';
import { timeToMinutes } from '../../arenas/domain/pricing.js';

export const SLOT_MINUTES_DEFAULT = 60;
export const SLOT_MINUTES_MIN = 15;
export const SLOT_MINUTES_MAX = 240;
export const WINDOWS_MAX = 40;
export const EXCEPTIONS_MAX = 120;

const str = (v) => String(v ?? '').trim();

/** minutos desde 00:00 -> 'HH:MM'. */
function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const isISODate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(str(v));

/** Normaliza/valida uma janela de disponibilidade. */
export function normalizeWindow(input = {}) {
  const weekdays = Array.isArray(input.weekdays)
    ? Array.from(new Set(input.weekdays.map((d) => Math.trunc(Number(d))).filter((d) => d >= 0 && d <= 6))).sort((a, b) => a - b)
    : [];
  const start = str(input.start);
  const end = str(input.end);
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  const valid = weekdays.length > 0 && s != null && e != null && e > s;
  return {
    valid,
    error: valid ? null : 'Janela inválida: escolha ao menos um dia e um horário final maior que o inicial.',
    value: {
      id: str(input.id) || `w_${Math.random().toString(36).slice(2, 9)}`,
      weekdays,
      start,
      end,
      arena_id: str(input.arena_id) || null,
      location: str(input.location).slice(0, 120) || null,
    },
  };
}

/** Normaliza/valida uma exceção (folga/férias). */
export function normalizeException(input = {}) {
  const date = str(input.date);
  const valid = isISODate(date);
  return {
    valid,
    error: valid ? null : 'Data inválida (use AAAA-MM-DD).',
    value: { date, reason: str(input.reason).slice(0, 200) },
  };
}

/** Normaliza o documento inteiro de disponibilidade. */
export function normalizeAvailability(input = {}) {
  const windows = (Array.isArray(input.windows) ? input.windows : [])
    .map((w) => normalizeWindow(w))
    .filter((r) => r.valid)
    .map((r) => r.value)
    .slice(0, WINDOWS_MAX);
  const exceptions = (Array.isArray(input.exceptions) ? input.exceptions : [])
    .map((x) => normalizeException(x))
    .filter((r) => r.valid)
    .map((r) => r.value)
    .slice(0, EXCEPTIONS_MAX);
  const rawSlot = Math.trunc(Number(input.slot_minutes));
  const slot_minutes = Number.isFinite(rawSlot) && rawSlot >= SLOT_MINUTES_MIN && rawSlot <= SLOT_MINUTES_MAX
    ? rawSlot
    : SLOT_MINUTES_DEFAULT;
  return {
    coach_id: str(input.coach_id),
    windows,
    exceptions,
    slot_minutes,
  };
}

/** Indica se uma data é exceção (folga) na disponibilidade. */
export function isExceptionDate(availability = {}, dateStr) {
  const exceptions = Array.isArray(availability.exceptions) ? availability.exceptions : [];
  return exceptions.some((x) => x.date === dateStr);
}

/**
 * Gera os slots livres de um dia a partir das janelas, descontando os horários
 * já ocupados (aulas confirmadas). Cada slot tem duração `slot_minutes`.
 *
 * @param {object} availability doc normalizado (ou cru — é normalizado aqui)
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {{ busy?: Array<{date,start,end}> }} opts
 * @returns {Array<{ date, start, end, arena_id, location }>}
 */
export function generateDaySlots(availability = {}, dateStr, { busy = [] } = {}) {
  const av = normalizeAvailability(availability);
  if (!isISODate(dateStr)) return [];
  if (isExceptionDate(av, dateStr)) return [];
  const weekday = weekdayOf(dateStr);
  if (weekday == null) return [];

  const step = av.slot_minutes;
  const busyForDate = busy.filter((b) => b && b.date === dateStr);
  const seen = new Set();
  const slots = [];

  av.windows
    .filter((w) => w.weekdays.includes(weekday))
    .forEach((w) => {
      const ws = timeToMinutes(w.start);
      const we = timeToMinutes(w.end);
      if (ws == null || we == null) return;
      for (let m = ws; m + step <= we; m += step) {
        const start = minutesToTime(m);
        const end = minutesToTime(m + step);
        const key = `${start}_${end}`;
        if (seen.has(key)) continue;
        const candidate = { date: dateStr, start, end };
        const isBusy = busyForDate.some((b) => slotsConflict(candidate, b));
        if (isBusy) continue;
        seen.add(key);
        slots.push({ ...candidate, arena_id: w.arena_id, location: w.location });
      }
    });

  return slots.sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Gera os slots livres de vários dias a partir de uma data.
 * @param {object} availability
 * @param {string} fromDate 'YYYY-MM-DD'
 * @param {{ days?: number, busy?: Array }} opts
 * @returns {Array<{ date, slots: Array }>} um item por dia com slots (dias sem
 *   slot livre são omitidos).
 */
export function generateWeekSlots(availability = {}, fromDate, { days = 7, busy = [] } = {}) {
  if (!isISODate(fromDate)) return [];
  const [y, mo, d] = fromDate.split('-').map(Number);
  const base = new Date(y, mo - 1, d);
  const total = Math.max(1, Math.min(60, Math.trunc(days)));
  const out = [];
  for (let i = 0; i < total; i += 1) {
    const cur = new Date(base);
    cur.setDate(base.getDate() + i);
    const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    const slots = generateDaySlots(availability, iso, { busy });
    if (slots.length > 0) out.push({ date: iso, slots });
  }
  return out;
}

/** Conta o total de slots livres numa janela de dias (para resumo). */
export function countFreeSlots(availability = {}, fromDate, opts = {}) {
  return generateWeekSlots(availability, fromDate, opts)
    .reduce((acc, day) => acc + day.slots.length, 0);
}
