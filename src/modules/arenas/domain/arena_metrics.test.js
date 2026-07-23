/**
 * Tests do domínio puro de arena_metrics.
 * Cobre agregação de receita, ocupação, conversão, próximas reservas.
 * Sem I/O — só funções puras.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateArenaMetrics, formatPeriodLabel, nowYearMonth,
} from './arena_metrics.js';
import { BOOKING_STATUS } from './constants.js';
import { SALE_STATUS } from './pdv.js';

const now = nowYearMonth();
const year = now.year;
const month = now.month;

const futureDate = '2030-08-15'; // bem no futuro, fora do mês atual

describe('formatPeriodLabel', () => {
  it('formata mês/ano em pt-BR', () => {
    expect(formatPeriodLabel(2026, 1)).toBe('Janeiro 2026');
    expect(formatPeriodLabel(2026, 8)).toBe('Agosto 2026');
    expect(formatPeriodLabel(2026, 12)).toBe('Dezembro 2026');
  });
  it('retorna Período se input inválido', () => {
    expect(formatPeriodLabel()).toBe('Período');
  });
});

describe('calculateArenaMetrics — receita', () => {
  it('soma agreed_price de CONFIRMED', () => {
    const r = calculateArenaMetrics({
      bookings: [
        { id: 'b1', status: BOOKING_STATUS.CONFIRMED, agreed_price: 100 },
        { id: 'b2', status: BOOKING_STATUS.CONFIRMED, agreed_price: 150 },
        { id: 'b3', status: BOOKING_STATUS.CANCELLED, agreed_price: 999 }, // não conta
      ],
    });
    expect(r.revenue.confirmed).toBe(250);
  });
  it('usa proposed_price se agreed_price for 0', () => {
    const r = calculateArenaMetrics({
      bookings: [
        { id: 'b1', status: BOOKING_STATUS.CONFIRMED, agreed_price: 0, proposed_price: 80 },
      ],
    });
    expect(r.revenue.confirmed).toBe(80);
  });
  it('soma sales PAID', () => {
    const r = calculateArenaMetrics({
      sales: [
        { id: 's1', status: SALE_STATUS.PAID, total: 30 },
        { id: 's2', status: SALE_STATUS.PAID, total: 20 },
        { id: 's3', status: SALE_STATUS.PENDING, total: 999 }, // não conta
      ],
    });
    expect(r.revenue.confirmed).toBe(50);
    expect(r.sales.revenue).toBe(50);
  });
  it('calcula receita pendente (REQUESTED + NEGOTIATING)', () => {
    const r = calculateArenaMetrics({
      bookings: [
        { id: 'b1', status: BOOKING_STATUS.REQUESTED, proposed_price: 100 },
        { id: 'b2', status: BOOKING_STATUS.NEGOTIATING, proposed_price: 50 },
        { id: 'b3', status: BOOKING_STATUS.CONFIRMED, proposed_price: 999 }, // não conta
      ],
    });
    expect(r.revenue.pending).toBe(150);
  });
  it('revenue_by_source separa bookings vs sales', () => {
    const r = calculateArenaMetrics({
      bookings: [{ id: 'b1', status: BOOKING_STATUS.CONFIRMED, agreed_price: 100 }],
      sales: [{ id: 's1', status: SALE_STATUS.PAID, total: 50 }],
    });
    expect(r.revenue_by_source).toEqual({ bookings: 100, sales: 50, total: 150 });
  });
});

describe('calculateArenaMetrics — bookings', () => {
  it('conta por status', () => {
    const r = calculateArenaMetrics({
      bookings: [
        { id: '1', status: 'confirmed' },
        { id: '2', status: 'confirmed' },
        { id: '3', status: 'requested' },
        { id: '4', status: 'cancelled' },
      ],
    });
    expect(r.bookings.total).toBe(4);
    expect(r.bookings.by_status).toEqual({
      confirmed: 2, requested: 1, cancelled: 1,
    });
  });
  it('taxa de conversão (CONFIRMED+COMPLETED) / decided', () => {
    const r = calculateArenaMetrics({
      bookings: [
        { id: '1', status: 'confirmed' },
        { id: '2', status: 'confirmed' },
        { id: '3', status: 'confirmed' },
        { id: '4', status: 'cancelled' },
        { id: '5', status: 'declined' },
        { id: '6', status: 'requested' }, // não conta
      ],
    });
    // 3 confirmed / 5 decided = 60%
    expect(r.bookings.conversion_rate).toBe(60);
  });
  it('retorna null se sem bookings decididos', () => {
    const r = calculateArenaMetrics({ bookings: [] });
    expect(r.bookings.conversion_rate).toBeNull();
  });
});

describe('calculateArenaMetrics — ocupação', () => {
  it('calcula horas reservadas', () => {
    const r = calculateArenaMetrics({
      bookings: [
        { id: 'b1', status: 'confirmed', date: futureDate, start: '10:00', end: '12:00' }, // 2h
        { id: 'b2', status: 'confirmed', slots: [
          { date: futureDate, start: '14:00', end: '15:30' }, // 1.5h
        ]},
        { id: 'b3', status: 'cancelled', date: futureDate, start: '09:00', end: '18:00' }, // não conta
      ],
    });
    expect(r.occupancy.booked_hours).toBe(3.5);
  });
  it('calcula horas disponíveis a partir de schedules', () => {
    const schedules = [{
      is_active: true,
      weekdays: [0, 1, 2, 3, 4, 5, 6], // todos os dias
      start_time: '08:00',
      end_time: '22:00',
    }];
    // 30 dias × 14h = 420h (usar abril/2026 que tem 30 dias)
    const r = calculateArenaMetrics({ schedules, year: 2026, month: 4 });
    expect(r.occupancy.available_hours).toBe(420);
  });
  it('calcula taxa de ocupação', () => {
    const schedules = [{
      is_active: true,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      start_time: '00:00',
      end_time: '23:59',
    }];
    const r = calculateArenaMetrics({
      schedules,
      bookings: [
        { id: 'b1', status: 'confirmed', slots: [{ date: futureDate, start: '00:00', end: '12:00' }] },
      ],
      year: 2026, month: 4,
    });
    expect(r.occupancy.rate).toBeGreaterThan(0);
    expect(r.occupancy.rate).toBeLessThan(100);
  });
  it('retorna null de ocupação sem schedules', () => {
    const r = calculateArenaMetrics({ year, month });
    expect(r.occupancy.rate).toBeNull();
  });
});

describe('calculateArenaMetrics — próximas reservas', () => {
  it('retorna próximas CONFIRMED ordenadas', () => {
    const today = new Date().toISOString().slice(0, 10);
    const r = calculateArenaMetrics({
      bookings: [
        { id: 'a', status: 'confirmed', date: futureDate, start: '10:00', athlete_name: 'Ana' },
        { id: 'b', status: 'confirmed', slots: [{ date: futureDate, start: '14:00', end: '16:00' }] },
        { id: 'c', status: 'requested', date: futureDate, start: '18:00' }, // não conta
        { id: 'd', status: 'confirmed', date: '2020-01-01', start: '10:00' }, // passado
      ],
      upcomingLimit: 5,
    });
    expect(r.bookings.upcoming).toHaveLength(2);
    expect(r.bookings.upcoming[0].id).toBe('a');
  });
  it('respeita o limit', () => {
    const today = new Date();
    const bookings = Array.from({ length: 10 }, (_, i) => ({
      id: `b${i}`,
      status: 'confirmed',
      date: new Date(today.getTime() + (i + 1) * 86400000).toISOString().slice(0, 10),
      start: '10:00',
    }));
    const r = calculateArenaMetrics({ bookings, upcomingLimit: 3 });
    expect(r.bookings.upcoming).toHaveLength(3);
  });
});

describe('calculateArenaMetrics — rating', () => {
  it('calcula média', () => {
    const r = calculateArenaMetrics({
      reviews: [
        { rating: 5 },
        { rating: 4 },
        { rating: 3 },
      ],
    });
    expect(r.rating.average).toBe(4);
    expect(r.rating.count).toBe(3);
  });
  it('ignora ratings 0', () => {
    const r = calculateArenaMetrics({
      reviews: [{ rating: 0 }, { rating: 5 }],
    });
    expect(r.rating.count).toBe(1);
  });
});

describe('calculateArenaMetrics — courts', () => {
  it('conta total e ativas', () => {
    const r = calculateArenaMetrics({
      courts: [
        { id: 'c1', is_active: true },
        { id: 'c2', is_active: false },
        { id: 'c3' }, // default ativo
      ],
    });
    expect(r.courts.total).toBe(3);
    expect(r.courts.active).toBe(2);
  });
});

describe('calculateArenaMetrics — edge cases', () => {
  it('lida com arrays vazios', () => {
    const r = calculateArenaMetrics({});
    expect(r.bookings.total).toBe(0);
    expect(r.sales.total).toBe(0);
    expect(r.revenue.confirmed).toBe(0);
  });
  it('lida com campos faltando', () => {
    const r = calculateArenaMetrics({
      bookings: [{ id: '1' }, { id: '2', status: 'confirmed' }],
    });
    expect(r.bookings.total).toBe(2);
    expect(r.revenue.confirmed).toBe(0);
  });
  it('lida com null/undefined em campos numéricos', () => {
    const r = calculateArenaMetrics({
      bookings: [{ id: '1', status: 'confirmed', agreed_price: null, proposed_price: undefined }],
    });
    expect(r.revenue.confirmed).toBe(0);
  });
});
