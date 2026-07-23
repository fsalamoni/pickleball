/**
 * Testes do aggregateDayStatus e buildMonthGrid.
 *
 * aggregateDayStatus é o coração do calendário público MENSAL. Tem que
 * lidar com 4 regras:
 *  - dia sem schedule = CLOSED (cinza, não clicável)
 *  - dia com schedule mas tudo fora = CLOSED
 *  - dia com pelo menos 1 AVAILABLE = AVAILABLE (verde, clicável)
 *  - dia só com PENDING/CONFIRMED = PENDING/CONFIRMED (clicável p/ ver)
 *  - dia só com UNAVAILABLE (admin marcou) = UNAVAILABLE
 */
import { describe, it, expect } from 'vitest';
import { aggregateDayStatus, buildMonthGrid } from './calendar_aggregate.js';

describe('aggregateDayStatus', () => {
  // 2026-07-23 é quinta-feira (weekday 4)
  const THU = '2026-07-23';
  const WED = '2026-07-22';
  const SUN = '2026-07-19';
  const SAT = '2026-07-25';

  it('returns CLOSED when no schedules at all (admin did not define any)', () => {
    const r = aggregateDayStatus({ date: THU, schedules: [], bookings: [], unavailabilities: [] });
    expect(r.dayStatus).toBe('closed');
    expect(r.hasAvailable).toBe(false);
    expect(r.isAllClosed).toBe(true);
  });

  it('returns CLOSED when there are schedules but none for this weekday', () => {
    // Schedule só segunda
    const schedules = [
      { weekdays: [1], start_time: '08:00', end_time: '22:00', is_active: true },
    ];
    const r = aggregateDayStatus({ date: THU, schedules, bookings: [], unavailabilities: [] });
    expect(r.dayStatus).toBe('closed');
    expect(r.isAllClosed).toBe(true);
  });

  it('returns AVAILABLE when schedule covers the day and no bookings', () => {
    const schedules = [
      { weekdays: [4], start_time: '08:00', end_time: '22:00', is_active: true },
    ];
    const r = aggregateDayStatus({ date: THU, schedules, bookings: [], unavailabilities: [] });
    expect(r.dayStatus).toBe('available');
    expect(r.hasAvailable).toBe(true);
    expect(r.isAllClosed).toBe(false);
  });

  it('returns AVAILABLE when there is at least 1 available slot, even with some pending', () => {
    const schedules = [
      { weekdays: [4], start_time: '08:00', end_time: '12:00', is_active: true },
    ];
    const bookings = [
      {
        status: 'requested',
        court_id: null,
        slots: [{ date: THU, start: '10:00', end: '11:00' }],
      },
    ];
    const r = aggregateDayStatus({ date: THU, schedules, bookings, unavailabilities: [] });
    expect(r.dayStatus).toBe('available');
    expect(r.hasAvailable).toBe(true);
  });

  it('returns PENDING when only pending bookings cover all slots', () => {
    const schedules = [
      { weekdays: [4], start_time: '08:00', end_time: '11:00', is_active: true },
    ];
    const bookings = [
      {
        status: 'requested',
        court_id: null,
        slots: [{ date: THU, start: '08:00', end: '11:00' }],
      },
    ];
    const r = aggregateDayStatus({ date: THU, schedules, bookings, unavailabilities: [] });
    expect(r.dayStatus).toBe('pending');
    expect(r.hasAvailable).toBe(false);
  });

  it('returns CONFIRMED when only confirmed bookings cover all slots', () => {
    const schedules = [
      { weekdays: [4], start_time: '08:00', end_time: '11:00', is_active: true },
    ];
    const bookings = [
      {
        status: 'confirmed',
        court_id: null,
        slots: [{ date: THU, start: '08:00', end: '11:00' }],
      },
    ];
    const r = aggregateDayStatus({ date: THU, schedules, bookings, unavailabilities: [] });
    expect(r.dayStatus).toBe('confirmed');
  });

  it('returns UNAVAILABLE when admin marked the whole day as unavailable', () => {
    const schedules = [
      { weekdays: [4], start_time: '08:00', end_time: '22:00', is_active: true },
    ];
    const unavailabilities = [
      { date: THU, court_id: null, start_time: '00:00', end_time: '23:59' },
    ];
    const r = aggregateDayStatus({ date: THU, schedules, bookings: [], unavailabilities });
    expect(r.dayStatus).toBe('unavailable');
    expect(r.hasAvailable).toBe(false);
  });

  it('returns CLOSED when all schedules are inactive (is_active: false)', () => {
    const schedules = [
      { weekdays: [4], start_time: '08:00', end_time: '22:00', is_active: false },
    ];
    const r = aggregateDayStatus({ date: THU, schedules, bookings: [], unavailabilities: [] });
    expect(r.dayStatus).toBe('closed');
  });

  it('returns CLOSED when weekday array is empty (legacy bad data)', () => {
    const schedules = [
      { weekdays: [], start_time: '08:00', end_time: '22:00', is_active: true },
    ];
    const r = aggregateDayStatus({ date: THU, schedules, bookings: [], unavailabilities: [] });
    expect(r.dayStatus).toBe('closed');
  });

  it('filters by court_id when provided', () => {
    // 2 schedules: 1 para courtA, 1 para courtB
    const schedules = [
      { id: 'sA', weekdays: [4], start_time: '08:00', end_time: '22:00', court_id: 'courtA', is_active: true },
      { id: 'sB', weekdays: [4], start_time: '08:00', end_time: '22:00', court_id: 'courtB', is_active: true },
    ];
    // Sem filtro: AVAILABLE (tem schedule)
    const rAll = aggregateDayStatus({ date: THU, schedules, bookings: [], unavailabilities: [] });
    expect(rAll.dayStatus).toBe('available');
    // Filtrando por courtA: AVAILABLE
    const rA = aggregateDayStatus({ date: THU, courtId: 'courtA', schedules, bookings: [], unavailabilities: [] });
    expect(rA.dayStatus).toBe('available');
    // Filtrando por courtX (que não tem schedule): CLOSED
    const rX = aggregateDayStatus({ date: THU, courtId: 'courtX', schedules, bookings: [], unavailabilities: [] });
    expect(rX.dayStatus).toBe('closed');
  });

  it('handles invalid date gracefully (returns CLOSED)', () => {
    const r = aggregateDayStatus({ date: 'invalid', schedules: [], bookings: [], unavailabilities: [] });
    expect(r.dayStatus).toBe('closed');
  });

  it('handles multi-range schedules (morning + evening)', () => {
    const schedules = [
      { weekdays: [4], start_time: '08:00', end_time: '12:00', is_active: true },
      { weekdays: [4], start_time: '14:00', end_time: '22:00', is_active: true },
    ];
    const r = aggregateDayStatus({ date: THU, schedules, bookings: [], unavailabilities: [] });
    expect(r.dayStatus).toBe('available');
    expect(r.count.available).toBe(12); // 4h + 8h = 12 slots de 1h
  });

  it('skips completed bookings when computing day status', () => {
    // completed = já passou, deve ser ignorada
    const schedules = [
      { weekdays: [4], start_time: '08:00', end_time: '22:00', is_active: true },
    ];
    const bookings = [
      {
        status: 'completed',
        court_id: null,
        slots: [{ date: THU, start: '00:00', end: '23:59' }],
      },
    ];
    const r = aggregateDayStatus({ date: THU, schedules, bookings, unavailabilities: [] });
    expect(r.dayStatus).toBe('available');
  });
});

describe('buildMonthGrid', () => {
  it('returns 42 days (7×6) for any month', () => {
    const grid = buildMonthGrid('2026-07');
    expect(grid).toHaveLength(42);
  });

  it('starts on a Sunday', () => {
    const grid = buildMonthGrid('2026-07');
    const first = new Date(grid[0] + 'T12:00:00');
    expect(first.getDay()).toBe(0);
  });

  it('ends on a Saturday', () => {
    const grid = buildMonthGrid('2026-07');
    const last = new Date(grid[41] + 'T12:00:00');
    expect(last.getDay()).toBe(6);
  });

  it('includes the 1st of the month', () => {
    const grid = buildMonthGrid('2026-07');
    expect(grid).toContain('2026-07-01');
  });

  it('handles February in non-leap year (28 days)', () => {
    const grid = buildMonthGrid('2025-02');
    expect(grid).toContain('2025-02-01');
    expect(grid).toContain('2025-02-28');
    // Não contém 29
    expect(grid).not.toContain('2025-02-29');
  });

  it('handles February in leap year (29 days)', () => {
    const grid = buildMonthGrid('2024-02');
    expect(grid).toContain('2024-02-29');
  });

  it('handles month that starts on Saturday (July 2026 - dia 1 é quarta)', () => {
    // 2026-07-01 é quarta
    const grid = buildMonthGrid('2026-07');
    const idx = grid.indexOf('2026-07-01');
    expect(idx).toBe(3); // posição 3 = quarta (0=dom, 1=seg, 2=ter, 3=qua)
  });

  it('month with day 1 on Sunday (e.g. 2024-09) has idx 0', () => {
    const grid = buildMonthGrid('2024-09');
    const idx = grid.indexOf('2024-09-01');
    expect(idx).toBe(0);
  });
});
