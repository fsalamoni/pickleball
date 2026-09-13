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
import {
  aggregateDayStatus,
  buildMonthGrid,
  indexBookingsByDate,
  indexUnavailabilitiesByDate,
  findFirstFreeDate,
} from './calendar_aggregate.js';

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

describe('aggregateDayStatus com `courts` (conta por QUADRA)', () => {
  const THU = '2026-07-23'; // quinta (weekday 4)
  const schedules = [
    { weekdays: [4], start_time: '18:00', end_time: '22:00', is_active: true },
  ];
  const courts = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }];

  it('uma reserva numa quadra NÃO ocupa o horário inteiro do dia', () => {
    // O bug que isso conserta: sem `courts`, a arena era contada como se
    // fosse uma quadra só, e reservar as 19h numa quadra fazia as 19h
    // contarem como ocupadas — com outras duas quadras livres.
    const bookings = [
      { status: 'confirmed', court_id: 'q1', slots: [{ date: THU, start: '18:00', end: '22:00' }] },
    ];
    const r = aggregateDayStatus({ date: THU, courts, schedules, bookings, unavailabilities: [] });
    expect(r.dayStatus).toBe('available');
    expect(r.total).toBe(12);            // 3 quadras × 4 horas
    expect(r.count.available).toBe(8);   // q2 e q3 inteiras
    expect(r.count.confirmed).toBe(4);   // só a q1
    expect(r.freeTimes).toBe(4);         // os 4 horários seguem com vaga
    expect(r.occupancy).toBeCloseTo(4 / 12);
  });

  it('sem `courts`, o comportamento antigo continua idêntico', () => {
    const bookings = [
      { status: 'confirmed', court_id: 'q1', slots: [{ date: THU, start: '18:00', end: '22:00' }] },
    ];
    const r = aggregateDayStatus({ date: THU, schedules, bookings, unavailabilities: [] });
    expect(r.total).toBe(4);
    expect(r.count.confirmed).toBe(4);
    expect(r.count.available).toBe(0);
  });

  it('conta as quadras como strings também', () => {
    const r = aggregateDayStatus({ date: THU, courts: ['q1', 'q2'], schedules, bookings: [], unavailabilities: [] });
    expect(r.total).toBe(8);
    expect(r.occupancy).toBe(0);
  });

  it('dia lotado: occupancy 1, freeTimes 0, ainda clicável (não é fechado)', () => {
    const bookings = courts.map((c, i) => ({
      id: `b${i}`, status: 'confirmed', court_id: c.id,
      slots: [{ date: THU, start: '18:00', end: '22:00' }],
    }));
    const r = aggregateDayStatus({ date: THU, courts, schedules, bookings, unavailabilities: [] });
    expect(r.dayStatus).toBe('confirmed');
    expect(r.hasAvailable).toBe(false);
    expect(r.isAllClosed).toBe(false);
    expect(r.occupancy).toBe(1);
    expect(r.freeTimes).toBe(0);
    expect(r.openTimes).toBe(4);
  });

  it('quadra sem janela de horário não entra no denominador', () => {
    // q3 só tem janela às quartas: na quinta ela simplesmente não existe.
    const comQuadraFora = [
      { weekdays: [4], start_time: '18:00', end_time: '22:00', court_id: 'q1', is_active: true },
      { weekdays: [4], start_time: '18:00', end_time: '22:00', court_id: 'q2', is_active: true },
      { weekdays: [3], start_time: '18:00', end_time: '22:00', court_id: 'q3', is_active: true },
    ];
    const r = aggregateDayStatus({ date: THU, courts, schedules: comQuadraFora, bookings: [], unavailabilities: [] });
    expect(r.total).toBe(8);
    expect(r.openTimes).toBe(4);
  });

  it('reserva LEGADA sem quadra ocupa todas as quadras', () => {
    // Mesma regra do conflito de reserva: sem court_id, não dá para saber
    // qual quadra ela tomou, então ela bloqueia todas.
    const bookings = [
      { status: 'requested', court_id: null, slots: [{ date: THU, start: '18:00', end: '19:00' }] },
    ];
    const r = aggregateDayStatus({ date: THU, courts, schedules, bookings, unavailabilities: [] });
    expect(r.count.pending).toBe(3);
    expect(r.freeTimes).toBe(3);
  });

  it('bloqueio do admin sem quadra vale para a arena inteira', () => {
    const unavailabilities = [
      { date: THU, start_time: '18:00', end_time: '20:00', court_id: null },
    ];
    const r = aggregateDayStatus({ date: THU, courts, schedules, bookings: [], unavailabilities });
    expect(r.count.unavailable).toBe(6);
    expect(r.count.available).toBe(6);
    expect(r.freeTimes).toBe(2);
  });

  it('`courtId` vence `courts` (filtro de uma quadra é uma quadra)', () => {
    const bookings = [
      { status: 'confirmed', court_id: 'q1', slots: [{ date: THU, start: '18:00', end: '22:00' }] },
    ];
    const r = aggregateDayStatus({ date: THU, courtId: 'q1', courts, schedules, bookings, unavailabilities: [] });
    expect(r.total).toBe(4);
    expect(r.count.confirmed).toBe(4);
    expect(r.hasAvailable).toBe(false);
  });

  it('lista de quadras vazia cai no comportamento antigo', () => {
    const r = aggregateDayStatus({ date: THU, courts: [], schedules, bookings: [], unavailabilities: [] });
    expect(r.total).toBe(4);
  });
});

describe('indexBookingsByDate / indexUnavailabilitiesByDate', () => {
  it('indexa por todas as datas que a reserva ocupa', () => {
    const b = { id: 'b1', slots: [{ date: '2026-07-23' }, { date: '2026-07-30' }] };
    const idx = indexBookingsByDate([b]);
    expect(idx.get('2026-07-23')).toEqual([b]);
    expect(idx.get('2026-07-30')).toEqual([b]);
    expect(idx.get('2026-07-24')).toBeUndefined();
  });

  it('não duplica a reserva quando dois slots caem no mesmo dia', () => {
    const b = { id: 'b1', slots: [{ date: '2026-07-23' }, { date: '2026-07-23' }] };
    expect(indexBookingsByDate([b]).get('2026-07-23')).toHaveLength(1);
  });

  it('aguenta reserva sem slots', () => {
    expect(indexBookingsByDate([{ id: 'x' }]).size).toBe(0);
    expect(indexBookingsByDate().size).toBe(0);
  });

  it('o índice não muda o resultado da agregação', () => {
    const THU = '2026-07-23';
    const schedules = [{ weekdays: [4], start_time: '18:00', end_time: '22:00', is_active: true }];
    const bookings = [
      { status: 'confirmed', court_id: 'q1', slots: [{ date: THU, start: '18:00', end: '19:00' }] },
      { status: 'confirmed', court_id: 'q1', slots: [{ date: '2026-07-30', start: '18:00', end: '19:00' }] },
    ];
    const courts = [{ id: 'q1' }, { id: 'q2' }];
    const semIndice = aggregateDayStatus({ date: THU, courts, schedules, bookings, unavailabilities: [] });
    const comIndice = aggregateDayStatus({
      date: THU, courts, schedules,
      bookings: indexBookingsByDate(bookings).get(THU) || [],
      unavailabilities: [],
    });
    expect(comIndice).toEqual(semIndice);
  });

  it('indexa bloqueios por data e ignora os sem data', () => {
    const idx = indexUnavailabilitiesByDate([{ date: '2026-07-23' }, { start_time: '10:00' }]);
    expect(idx.get('2026-07-23')).toHaveLength(1);
    expect(idx.size).toBe(1);
  });
});

describe('findFirstFreeDate', () => {
  const schedules = [{ weekdays: [4], start_time: '18:00', end_time: '22:00', is_active: true }];
  const courts = [{ id: 'q1' }];

  it('acha a primeira quinta a partir de uma segunda', () => {
    const r = findFirstFreeDate({ from: '2026-07-20', courts, schedules, bookings: [], unavailabilities: [] });
    expect(r).toBe('2026-07-23');
  });

  it('devolve o próprio dia quando ele já tem vaga', () => {
    const r = findFirstFreeDate({ from: '2026-07-23', courts, schedules, bookings: [], unavailabilities: [] });
    expect(r).toBe('2026-07-23');
  });

  it('pula o dia lotado e vai para a semana seguinte', () => {
    const bookings = [
      { status: 'confirmed', court_id: 'q1', slots: [{ date: '2026-07-23', start: '18:00', end: '22:00' }] },
    ];
    const r = findFirstFreeDate({ from: '2026-07-20', courts, schedules, bookings, unavailabilities: [] });
    expect(r).toBe('2026-07-30');
  });

  it('atravessa a virada do mês e do ano sem escorregar de fuso', () => {
    // 2026-12-31 é quinta.
    const r = findFirstFreeDate({ from: '2026-12-28', courts, schedules, bookings: [], unavailabilities: [] });
    expect(r).toBe('2026-12-31');
  });

  it('devolve null quando a janela acaba antes da vaga', () => {
    const r = findFirstFreeDate({ from: '2026-07-24', days: 5, courts, schedules, bookings: [], unavailabilities: [] });
    expect(r).toBeNull();
  });

  it('devolve null sem horário publicado (arena que não configurou nada)', () => {
    expect(findFirstFreeDate({ from: '2026-07-20', courts, schedules: [], bookings: [] })).toBeNull();
    expect(findFirstFreeDate({})).toBeNull();
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
