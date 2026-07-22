/**
 * Domínio puro de detecção de conflito de reservas.
 *
 * Estende o `hasConflictWithConfirmed` legado (em `booking.js`) com:
 * - Filtro por `court_id` (cada reserva agora ocupa uma quadra específica)
 * - Considera status ativos (REQUESTED, NEGOTIATING, CONFIRMED) — não
 *   apenas CONFIRMED. Reservas pedidas/em negociação também bloqueiam
 *   horário (UI mostra que tá ocupado).
 * - Valida se o slot está dentro de uma janela de schedule da quadra
 *   (ARE-04). Se a arena não tem schedules configurados, fallback
 *   permissivo (não bloqueia).
 * - Calcula ranges livres pra uma data+quadra+duration.
 *
 * Sprint 1 (ARE-07) do roadmap arena — `docs/arena-roadmap.md`.
 *
 * Decisões:
 * - Pura: zero I/O. Recebe `existingBookings` e `schedules` como input.
 *   Hooks/UI coletam via React Query e passam pra cá.
 * - Sem timezone math: trabalha com 'YYYY-MM-DD' (string) e minutos
 *   desde meia-noite (number). 'date' é sempre a data local da arena.
 * - Schedule alignment é OPCIONAL: se a arena não tem schedules, não
 *   bloqueia. Se tem, exige que o slot esteja contido em pelo menos
 *   uma janela ativa daquele weekday.
 */

import { BOOKING_STATUS } from './constants.js';
import { timeToMinutes, normalizeTime, normalizeWeekdays } from './court_schedule.js';

/** Status que bloqueiam horário (others são históricas). */
export const BLOCKING_STATUSES = Object.freeze([
  BOOKING_STATUS.REQUESTED,
  BOOKING_STATUS.NEGOTIATING,
  BOOKING_STATUS.CONFIRMED,
]);

/** Extrai todos os slots (com court_id) de uma reserva. */
function expandBookingSlots(booking) {
  if (!booking) return [];
  if (booking.kind === 'recurring' && Array.isArray(booking.slots)) {
    return booking.slots.map((s) => ({ ...s, court_id: booking.court_id || null }));
  }
  if (Array.isArray(booking.slots)) {
    return booking.slots.map((s) => ({ ...s, court_id: booking.court_id || null }));
  }
  // Fallback: slot legado em campos planos
  if (booking.date && booking.start && booking.end) {
    return [{
      date: booking.date,
      start: booking.start,
      end: booking.end,
      court_id: booking.court_id || null,
    }];
  }
  return [];
}

/** Verifica se 2 slots se sobrepõem em tempo (mesma data, faixas sobrepostas). */
function slotsOverlap(a, b) {
  if (!a || !b || a.date !== b.date) return false;
  const as = timeToMinutes(a.start);
  const ae = timeToMinutes(a.end);
  const bs = timeToMinutes(b.start);
  const be = timeToMinutes(b.end);
  if ([as, ae, bs, be].some((x) => x == null)) return false;
  return as < be && bs < ae;
}

/** Filtra slots que conflitam com a quadra e data especificadas. */
function bookingsForCourtOnDate(bookings, courtId, date) {
  const out = [];
  for (const b of bookings) {
    if (!BLOCKING_STATUSES.includes(b.status)) continue;
    for (const slot of expandBookingSlots(b)) {
      if (slot.date !== date) continue;
      // Se a reserva tem court_id, só conflita com a mesma quadra.
      // Se NÃO tem court_id (legado), conflita com qualquer quadra.
      if (courtId && slot.court_id && slot.court_id !== courtId) continue;
      out.push({ booking: b, slot });
    }
  }
  return out;
}

/**
 * Verifica conflito de slots candidatos contra reservas existentes.
 * @param {Array} candidateSlots - [{date, start, end, court_id?}, ...]
 * @param {Array} existingBookings - reservas da arena (todas as status)
 * @returns {{ hasConflict: boolean, conflicts: Array }}
 */
export function checkBookingConflict(candidateSlots = [], existingBookings = []) {
  const conflicts = [];
  for (const c of candidateSlots) {
    if (!c?.date || !c?.start || !c?.end) continue;
    const inDate = bookingsForCourtOnDate(existingBookings, c.court_id, c.date);
    for (const { booking, slot } of inDate) {
      if (slotsOverlap(c, slot)) {
        conflicts.push({
          candidate: c,
          conflict_with: slot,
          conflicting_booking_id: booking.id,
          conflicting_status: booking.status,
        });
      }
    }
  }
  return { hasConflict: conflicts.length > 0, conflicts };
}

/**
 * Verifica se um slot está dentro de alguma janela de schedule ativa
 * da quadra naquele weekday. Retorna { aligned: bool, matching: [] }.
 *
 * Se a quadra não tem schedules configurados, retorna { aligned: true }
 * (não bloqueia — fallback permissivo).
 */
export function checkScheduleAlignment({ date, start_time, end_time, court_id, court_schedules = [] }) {
  if (!court_schedules || court_schedules.length === 0) {
    return { aligned: true, matching: [] };
  }
  // Calcula weekday da data
  const dow = weekdayFromDate(date);
  if (dow == null) return { aligned: false, error: 'Data inválida.' };

  const startMin = timeToMinutes(start_time);
  const endMin = timeToMinutes(end_time);
  if (startMin == null || endMin == null) {
    return { aligned: false, error: 'Horário inválido.' };
  }

  const matching = court_schedules.filter((s) => {
    if (s.is_active === false) return false;
    const w = normalizeWeekdays(s.weekdays);
    if (!w || !w.includes(dow)) return false;
    const sStart = timeToMinutes(s.start_time);
    const sEnd = timeToMinutes(s.end_time);
    if (sStart == null || sEnd == null) return false;
    // Slot candidato deve estar contido na janela
    return startMin >= sStart && endMin <= sEnd;
  });

  return { aligned: matching.length > 0, matching };
}

/** 'YYYY-MM-DD' -> weekday 0-6 (domingo=0) ou null. */
function weekdayFromDate(dateStr) {
  const m = String(dateStr ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay();
}

/**
 * Combina check de conflito + alinhamento de schedule.
 * Retorna { ok: true } ou { ok: false, reason, detail }.
 */
export function validateBookingRequest({
  date, start_time, end_time, court_id,
  existingBookings = [], court_schedules = [],
}) {
  if (!date || !normalizeTime(start_time) || !normalizeTime(end_time)) {
    return { ok: false, reason: 'invalid_slot', message: 'Preencha data e horário válido (fim depois do início).' };
  }
  // Detecta end <= start explicitamente
  const sM = timeToMinutes(start_time);
  const eM = timeToMinutes(end_time);
  if (sM != null && eM != null && eM <= sM) {
    return { ok: false, reason: 'invalid_slot', message: 'O horário de fim deve ser depois do início.' };
  }
  // 1. Schedule alignment
  const align = checkScheduleAlignment({ date, start_time, end_time, court_id, court_schedules });
  if (!align.aligned) {
    if (align.error) return { ok: false, reason: 'invalid_slot', message: align.error };
    return {
      ok: false,
      reason: 'outside_schedule',
      message: 'A quadra não está disponível nesse dia/horário.',
    };
  }
  // 2. Conflito com reservas existentes
  const conflict = checkBookingConflict(
    [{ date, start: start_time, end: end_time, court_id }],
    existingBookings,
  );
  if (conflict.hasConflict) {
    return {
      ok: false,
      reason: 'conflict',
      message: 'Já existe uma reserva ativa nesse horário para esta quadra.',
      conflicts: conflict.conflicts,
    };
  }
  return { ok: true };
}

/**
 * Para uma data+quadra+duration, retorna os ranges OCUPADOS (bookings
 * ativas) e os LIVRES (interseção com schedules).
 *
 * @param {string} date - 'YYYY-MM-DD'
 * @param {Array} court_schedules - schedules da quadra
 * @param {Array} existingBookings - reservas da arena
 * @param {number} duration - duração mínima desejada (minutos) para
 *   um slot livre ser considerado utilizável
 * @returns {{ busy: [{start, end, status, booking_id}], free: [{start, end}], duration_min }}
 */
export function getCourtAvailabilityForDate({
  date, court_schedules = [], existingBookings = [], duration = 60,
}) {
  const dow = weekdayFromDate(date);
  if (dow == null) return { busy: [], free: [], duration_min: duration };

  // Janelas do dia (interseção de schedule.is_active com weekday)
  const dayWindows = (court_schedules || [])
    .filter((s) => s.is_active !== false)
    .filter((s) => {
      const w = normalizeWeekdays(s.weekdays);
      return w && w.includes(dow);
    })
    .map((s) => ({
      start: timeToMinutes(s.start_time),
      end: timeToMinutes(s.end_time),
      label: s.label || '',
    }))
    .filter((w) => w.start != null && w.end != null && w.end > w.start)
    .sort((a, b) => a.start - b.start);

  // Reservas ativas da quadra neste dia
  const inDay = bookingsForCourtOnDate(existingBookings, null, date)
    .map(({ booking, slot }) => ({
      start: timeToMinutes(slot.start),
      end: timeToMinutes(slot.end),
      status: booking.status,
      booking_id: booking.id,
    }))
    .filter((b) => b.start != null && b.end != null)
    .sort((a, b) => a.start - b.start);

  const busy = inDay;

  // Calcula livres = janelas - reservas, fatiando onde há overlap
  const free = [];
  for (const win of dayWindows) {
    let cursor = win.start;
    for (const b of busy) {
      if (b.end <= cursor || b.start >= win.end) continue; // fora dessa janela
      const s = Math.max(b.start, cursor);
      const e = Math.min(b.end, win.end);
      if (s < e) {
        if (cursor < s) free.push({ start: cursor, end: s });
        cursor = Math.max(cursor, e);
      }
    }
    if (cursor < win.end) free.push({ start: cursor, end: win.end });
  }

  // Filtra livres com duração mínima
  const usable = free
    .filter((f) => f.end - f.start >= duration)
    .map((f) => ({
      start: minutesToHHMM(f.start),
      end: minutesToHHMM(f.end),
      duration_min: f.end - f.start,
    }));

  return {
    busy: busy.map((b) => ({
      start: minutesToHHMM(b.start),
      end: minutesToHHMM(b.end),
      status: b.status,
      booking_id: b.booking_id,
    })),
    free: usable,
    duration_min: duration,
  };
}

function minutesToHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
