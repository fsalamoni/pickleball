/**
 * Domínio puro de atribuição/disponibilidade de quadras.
 *
 * Toda reserva ocupa uma quadra específica. Quando o solicitante não escolhe
 * uma quadra ("qualquer uma"), o sistema atribui automaticamente uma quadra
 * livre para o horário. Também calcula, para um horário, quais quadras estão
 * disponíveis e quais não — base do calendário por quadra.
 *
 * Sem I/O — recebe `courts`, `existingBookings` e `courtSchedules` como input.
 */

import { checkBookingConflict, checkScheduleAlignment } from './booking_conflict.js';

/** Quadras ativas ordenadas (sort_order, depois nome). */
export function activeCourts(courts = []) {
  return (Array.isArray(courts) ? courts : [])
    .filter((c) => c && c.is_active !== false)
    .slice()
    .sort((a, b) => {
      const sa = Number.isFinite(Number(a.sort_order)) ? Number(a.sort_order) : 999;
      const sb = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 999;
      if (sa !== sb) return sa - sb;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
}

/**
 * Uma quadra está livre para o slot? (sem conflito de reserva ativa e, se houver
 * schedules, dentro de uma janela ativa). Slots de schedule são opcionais.
 */
export function isCourtFreeForSlot(courtId, slot, existingBookings = [], courtSchedules = []) {
  if (!slot?.date || !slot?.start || !slot?.end) return false;
  const schedulesForCourt = (courtSchedules || []).filter((s) => !s.court_id || s.court_id === courtId);
  const align = checkScheduleAlignment({
    date: slot.date, start_time: slot.start, end_time: slot.end, court_id: courtId, court_schedules: schedulesForCourt,
  });
  if (!align.aligned) return false;
  const { hasConflict } = checkBookingConflict(
    [{ date: slot.date, start: slot.start, end: slot.end, court_id: courtId }],
    existingBookings,
  );
  return !hasConflict;
}

/**
 * Escolhe automaticamente uma quadra livre para o slot. Retorna o court_id ou
 * null se nenhuma quadra ativa estiver livre.
 */
export function pickAvailableCourt(courts, slot, existingBookings = [], courtSchedules = []) {
  for (const court of activeCourts(courts)) {
    if (isCourtFreeForSlot(court.id, slot, existingBookings, courtSchedules)) return court.id;
  }
  return null;
}

/**
 * Escolhe uma quadra livre para TODOS os slots (ex.: reserva recorrente).
 * Retorna o court_id de uma quadra livre em todos os horários, ou null.
 */
export function pickAvailableCourtForSlots(courts, slots = [], existingBookings = [], courtSchedules = []) {
  const list = Array.isArray(slots) ? slots.filter(Boolean) : [];
  if (list.length === 0) return null;
  for (const court of activeCourts(courts)) {
    if (list.every((slot) => isCourtFreeForSlot(court.id, slot, existingBookings, courtSchedules))) {
      return court.id;
    }
  }
  return null;
}

/**
 * Resolve a lista de quadras-alvo de uma reserva a partir da escolha do usuário.
 * Cada quadra-alvo vira uma reserva independente (uma quadra por documento).
 *
 * @param {Array} courts - quadras da arena
 * @param {{ mode: 'any'|'specific'|'all', courtIds?: string[] }} choice
 * @returns {string[]} court_ids a reservar. Vazio para 'any' (o chamador
 *   atribui automaticamente uma quadra livre) ou quando não há quadra válida.
 */
export function resolveTargetCourts(courts, { mode, courtIds } = {}) {
  const actives = activeCourts(courts);
  if (mode === 'all') return actives.map((c) => c.id);
  if (mode === 'specific') {
    const set = new Set((Array.isArray(courtIds) ? courtIds : []).map((c) => String(c)));
    return actives.filter((c) => set.has(String(c.id))).map((c) => c.id);
  }
  return [];
}

/**
 * Dentre `courtIds`, quais NÃO estão livres para TODOS os slots (por conflito de
 * reserva ativa ou fora da janela de horários). Base para reservar "todas" ou
 * um conjunto específico: só prossegue se o retorno for vazio.
 *
 * @returns {string[]} court_ids indisponíveis (subconjunto de `courtIds`).
 */
export function unavailableCourtsForSlots(courtIds = [], slots = [], existingBookings = [], courtSchedules = []) {
  const list = Array.isArray(slots) ? slots.filter(Boolean) : [];
  if (list.length === 0) return [];
  return (Array.isArray(courtIds) ? courtIds : []).filter(
    (cid) => !list.every((slot) => isCourtFreeForSlot(cid, slot, existingBookings, courtSchedules)),
  );
}

/**
 * Para um slot, retorna a disponibilidade de cada quadra ativa.
 * @returns {Array<{ court_id, name, available, booking_id|null }>}
 */
export function courtAvailabilityForSlot(courts, slot, existingBookings = [], courtSchedules = []) {
  return activeCourts(courts).map((court) => {
    const schedulesForCourt = (courtSchedules || []).filter((s) => !s.court_id || s.court_id === court.id);
    const align = checkScheduleAlignment({
      date: slot.date, start_time: slot.start, end_time: slot.end, court_id: court.id, court_schedules: schedulesForCourt,
    });
    const { hasConflict, conflicts } = checkBookingConflict(
      [{ date: slot.date, start: slot.start, end: slot.end, court_id: court.id }],
      existingBookings,
    );
    return {
      court_id: court.id,
      name: court.name,
      available: align.aligned && !hasConflict,
      out_of_schedule: !align.aligned,
      booking_id: hasConflict ? (conflicts[0]?.conflicting_booking_id || null) : null,
    };
  });
}

/** Conta quadras disponíveis para um slot. */
export function countAvailableCourts(courts, slot, existingBookings = [], courtSchedules = []) {
  return courtAvailabilityForSlot(courts, slot, existingBookings, courtSchedules)
    .filter((c) => c.available).length;
}
