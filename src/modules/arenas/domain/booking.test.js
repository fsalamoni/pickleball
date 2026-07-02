import { describe, it, expect } from 'vitest';
import {
  expandRecurring,
  weekdayOf,
  isValidSlot,
  slotsConflict,
  hasConflictWithConfirmed,
  canTransition,
  sortBookings,
  sortSlots,
} from './booking.js';
import { BOOKING_STATUS } from './constants.js';

describe('weekdayOf', () => {
  it('calcula o dia da semana', () => {
    // 2026-06-01 é uma segunda-feira.
    expect(weekdayOf('2026-06-01')).toBe(1);
  });
  it('retorna null para data inválida', () => {
    expect(weekdayOf('xx')).toBeNull();
  });
});

describe('isValidSlot', () => {
  it('aceita slot válido', () => {
    expect(isValidSlot({ date: '2026-06-01', start: '18:00', end: '19:00' })).toBe(true);
  });
  it('rejeita fim <= início', () => {
    expect(isValidSlot({ date: '2026-06-01', start: '19:00', end: '18:00' })).toBe(false);
  });
  it('rejeita data ausente', () => {
    expect(isValidSlot({ start: '18:00', end: '19:00' })).toBe(false);
  });
});

describe('expandRecurring', () => {
  it('gera N ocorrências semanais no dia certo', () => {
    const slots = expandRecurring({ weekday: 1, start: '18:00', end: '19:00', weeks: 4, fromDate: '2026-06-01' });
    expect(slots).toHaveLength(4);
    expect(slots[0].date).toBe('2026-06-01'); // segunda
    expect(slots[1].date).toBe('2026-06-08');
    expect(slots.every((s) => weekdayOf(s.date) === 1)).toBe(true);
  });
  it('avança para o próximo dia da semana alvo', () => {
    // 2026-06-01 é segunda; alvo quarta (3) => 2026-06-03.
    const slots = expandRecurring({ weekday: 3, start: '18:00', end: '19:00', weeks: 1, fromDate: '2026-06-01' });
    expect(slots[0].date).toBe('2026-06-03');
  });
  it('limita semanas e rejeita inválidos', () => {
    expect(expandRecurring({ weekday: 9, start: '18:00', end: '19:00', weeks: 4, fromDate: '2026-06-01' })).toEqual([]);
  });
});

describe('slotsConflict', () => {
  it('detecta sobreposição', () => {
    expect(slotsConflict(
      { date: '2026-06-01', start: '18:00', end: '19:30' },
      { date: '2026-06-01', start: '19:00', end: '20:00' },
    )).toBe(true);
  });
  it('não conflita datas diferentes', () => {
    expect(slotsConflict(
      { date: '2026-06-01', start: '18:00', end: '19:00' },
      { date: '2026-06-02', start: '18:00', end: '19:00' },
    )).toBe(false);
  });
  it('não conflita faixas adjacentes', () => {
    expect(slotsConflict(
      { date: '2026-06-01', start: '18:00', end: '19:00' },
      { date: '2026-06-01', start: '19:00', end: '20:00' },
    )).toBe(false);
  });
});

describe('hasConflictWithConfirmed', () => {
  it('ignora reservas não confirmadas', () => {
    const confirmed = [{ status: BOOKING_STATUS.REQUESTED, date: '2026-06-01', start: '18:00', end: '19:00' }];
    expect(hasConflictWithConfirmed([{ date: '2026-06-01', start: '18:00', end: '19:00' }], confirmed)).toBe(false);
  });
  it('detecta conflito com confirmada', () => {
    const confirmed = [{ status: BOOKING_STATUS.CONFIRMED, slots: [{ date: '2026-06-01', start: '18:00', end: '19:00' }] }];
    expect(hasConflictWithConfirmed([{ date: '2026-06-01', start: '18:30', end: '19:30' }], confirmed)).toBe(true);
  });
});

describe('canTransition', () => {
  it('permite solicitada -> confirmada', () => {
    expect(canTransition(BOOKING_STATUS.REQUESTED, BOOKING_STATUS.CONFIRMED)).toBe(true);
  });
  it('bloqueia recusada -> confirmada', () => {
    expect(canTransition(BOOKING_STATUS.DECLINED, BOOKING_STATUS.CONFIRMED)).toBe(false);
  });
});

describe('sortBookings', () => {
  it('ordena por data do primeiro slot', () => {
    const list = [
      { id: 'b', date: '2026-06-10', start: '1', end: '2' },
      { id: 'a', date: '2026-06-01', start: '1', end: '2' },
    ];
    expect(sortBookings(list).map((b) => b.id)).toEqual(['a', 'b']);
  });
});

describe('sortSlots', () => {
  it('ordena slots por data e horário', () => {
    const sorted = sortSlots([
      { date: '2026-07-10', start: '20:00', end: '21:00' },
      { date: '2026-07-09', start: '19:00', end: '20:00' },
      { date: '2026-07-10', start: '18:00', end: '19:00' },
    ]);
    expect(sorted.map((slot) => `${slot.date} ${slot.start}`)).toEqual([
      '2026-07-09 19:00',
      '2026-07-10 18:00',
      '2026-07-10 20:00',
    ]);
  });
});
