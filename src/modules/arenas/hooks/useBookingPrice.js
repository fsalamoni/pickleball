/**
 * Hook de preço de reserva (Sprint 5).
 *
 * A conta MORA NO DOMÍNIO (`totalBookingPrice`), não aqui. Este arquivo
 * existia com uma cópia da mesma soma, e duas cópias da mesma regra é como se
 * perde uma correção: a de baixo fica para trás e alguém acaba usando a
 * errada. Hoje ele é só o embrulho React em volta do domínio.
 */

import { useMemo } from 'react';
import { totalBookingPrice } from '../domain/pricing.js';

/**
 * Preço total de uma lista de slots, na tabela da arena.
 * @returns {{ total: number, breakdown: Array, durationMinutes: number }}
 */
export function calculateTotalPrice(arena, courtId, slots) {
  const r = totalBookingPrice(arena, { courtId, slots });
  return {
    total: r.total,
    breakdown: r.breakdown.map((b) => ({
      date: b.date, start: b.start, end: b.end,
      durationMinutes: b.minutes, price: b.price, hourlyRate: b.hourlyRate,
    })),
    durationMinutes: r.minutes,
  };
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
