/**
 * Hook de preço de reserva (Sprint 5).
 * Calcula o preço total de uma reserva baseado nos slots + arena + court.
 */

import { useMemo } from 'react';
import { resolveArenaPrice } from '../domain/pricing';
import { weekdayOf } from '../domain/booking.js';
import { timeToMinutes } from '../domain/pricing.js';

/** Calcula preço total de uma lista de slots. */
export function calculateTotalPrice(arena, courtId, slots) {
  if (!arena || !Array.isArray(slots) || slots.length === 0) {
    return { total: 0, breakdown: [], durationMinutes: 0 };
  }
  let total = 0;
  const breakdown = [];
  let durationMinutes = 0;
  for (const slot of slots) {
    const { date, start, end } = slot;
    if (!date || !start || !end) continue;
    const startM = timeToMinutes(start);
    const endM = timeToMinutes(end);
    if (startM == null || endM == null || endM <= startM) continue;
    const duration = endM - startM;
    durationMinutes += duration;
    const { price } = resolveArenaPrice(arena, {
      date, weekday: weekdayOf(date), time: start, courtId,
    });
    const slotPrice = (price || 0) * (duration / 60);
    total += slotPrice;
    breakdown.push({ date, start, end, durationMinutes: duration, price: slotPrice, hourlyRate: price || 0 });
  }
  return { total: Math.round(total * 100) / 100, breakdown, durationMinutes };
}

/**
 * Hook que retorna o preço total de uma reserva.
 * @param {Object} arena - doc da arena
 * @param {string} courtId - id da quadra
 * @param {Array<{date,start,end}>} slots
 * @returns {{ total: number, breakdown: Array, durationMinutes: number }}
 */
export function useBookingPrice(arena, courtId, slots) {
  return useMemo(() => calculateTotalPrice(arena, courtId, slots), [arena, courtId, JSON.stringify(slots)]);
}
