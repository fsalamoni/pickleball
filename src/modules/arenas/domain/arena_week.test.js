import { describe, it, expect } from 'vitest';
import { BOOKING_STATUS } from './constants.js';
import {
  weekSummary, bookingsHeatmap, bookingsInRange, HEATMAP_HOURS,
} from './arena_week.js';

const mk = (over = {}) => ({
  status: BOOKING_STATUS.CONFIRMED,
  slots: [{ date: '2026-08-10', start: '18:00', end: '19:00' }],
  agreed_price: 100,
  ...over,
});

describe('arena_week', () => {
  it('weekSummary soma receita, horas e no-show', () => {
    const bookings = [
      mk(),
      mk({ agreed_price: 0, proposed_price: 80 }),
      mk({ no_show: true }),
      mk({ status: BOOKING_STATUS.REQUESTED, agreed_price: 999 }), // não confirmada: não conta receita
    ];
    const s = weekSummary(bookings);
    expect(s.revenue).toBe(280); // 100 + 80 + 100 (a REQUESTED não entra)
    expect(s.confirmed).toBe(3);
    expect(s.bookings).toBe(4);
    expect(s.bookedHours).toBe(3); // 3 confirmadas × 1h
    expect(s.noShows).toBe(1);
    expect(s.noShowRate).toBe(Math.round((1 / 3) * 1000) / 10);
  });

  it('weekSummary sem confirmadas → noShowRate null', () => {
    const s = weekSummary([mk({ status: BOOKING_STATUS.REQUESTED })]);
    expect(s.confirmed).toBe(0);
    expect(s.noShowRate).toBeNull();
  });

  it('bookingsInRange filtra por data do slot', () => {
    const bookings = [
      mk({ slots: [{ date: '2026-08-05', start: '18:00', end: '19:00' }] }),
      mk({ slots: [{ date: '2026-08-12', start: '18:00', end: '19:00' }] }),
    ];
    expect(bookingsInRange(bookings, '2026-08-10', '2026-08-16')).toHaveLength(1);
  });

  it('bookingsHeatmap monta grade 7×faixas e conta slots', () => {
    const { hours, grid, max } = bookingsHeatmap([
      mk(), // 18:00
      mk({ slots: [{ date: '2026-08-10', start: '18:00', end: '19:00' }] }),
    ]);
    expect(hours).toEqual(HEATMAP_HOURS);
    expect(grid).toHaveLength(7);
    expect(grid[0]).toHaveLength(HEATMAP_HOURS.length);
    // duas reservas às 18h no mesmo dia → uma célula com 2
    const total = grid.flat().reduce((a, b) => a + b, 0);
    expect(total).toBe(2);
    expect(max).toBe(2);
  });
});
