/**
 * Tests do domínio puro de calendar.
 * Sem I/O — só funções puras.
 */

import { describe, it, expect } from 'vitest';
import {
  formatDateISO, parseDate, weekdayOf, compareDateISO,
  addDaysISO, addMonths, getWeekdayHeaders, getMonthLabel,
  buildMonthGrid, expandBookingSlots, groupBookingsByDate,
  dateRangeISO, monthRangeISO,
} from './calendar.js';

const FIXED_TODAY = '2026-08-15';

describe('formatDateISO / parseDate', () => {
  it('formata Date em YYYY-MM-DD', () => {
    expect(formatDateISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
  it('parseDate aceita YYYY-MM-DD válido', () => {
    const d = parseDate('2026-08-15');
    expect(d).not.toBeNull();
    expect(d.getFullYear()).toBe(2026);
  });
  it('parseDate rejeita mês/dia inválido', () => {
    expect(parseDate('2026-13-01')).toBeNull();
    expect(parseDate('2026-02-30')).toBeNull();
    expect(parseDate('2026-00-15')).toBeNull();
  });
  it('parseDate retorna null pra input inválido', () => {
    expect(parseDate('abc')).toBeNull();
    expect(parseDate(null)).toBeNull();
  });
  it('formatDateISO retorna null pra Date inválida', () => {
    expect(formatDateISO(new Date('xxx'))).toBeNull();
    expect(formatDateISO(null)).toBeNull();
  });
});

describe('weekdayOf', () => {
  it('retorna weekday correto', () => {
    expect(weekdayOf('2026-08-16')).toBe(0); // domingo
    expect(weekdayOf('2026-08-15')).toBe(6); // sábado
    expect(weekdayOf('2026-08-17')).toBe(1); // segunda
  });
  it('retorna null para input inválido', () => {
    expect(weekdayOf('xxx')).toBeNull();
  });
});

describe('compareDateISO / addDaysISO', () => {
  it('compara corretamente', () => {
    expect(compareDateISO('2026-08-15', '2026-08-15')).toBe(0);
    expect(compareDateISO('2026-08-15', '2026-08-16')).toBe(-1);
    expect(compareDateISO('2026-08-16', '2026-08-15')).toBe(1);
  });
  it('adiciona dias', () => {
    expect(addDaysISO('2026-08-15', 7)).toBe('2026-08-22');
    expect(addDaysISO('2026-08-15', -1)).toBe('2026-08-14');
    expect(addDaysISO('2026-08-31', 1)).toBe('2026-09-01');
  });
  it('addDaysISO retorna null para input inválido', () => {
    expect(addDaysISO('xxx', 1)).toBeNull();
  });
});

describe('addMonths / getWeekdayHeaders / getMonthLabel', () => {
  it('avança meses corretamente', () => {
    expect(addMonths(2026, 8, 1)).toEqual({ year: 2026, month: 9 });
    expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
  it('retorna 7 headers em pt-BR', () => {
    const h = getWeekdayHeaders();
    expect(h).toHaveLength(7);
    expect(h[0]).toBe('Dom');
    expect(h[6]).toBe('Sáb');
  });
  it('formata label do mês', () => {
    expect(getMonthLabel(2026, 1)).toBe('Janeiro 2026');
    expect(getMonthLabel(2026, 12)).toBe('Dezembro 2026');
  });
});

describe('buildMonthGrid', () => {
  it('retorna 6 linhas x 7 colunas', () => {
    const grid = buildMonthGrid(2026, 8, FIXED_TODAY);
    expect(grid).toHaveLength(6);
    grid.forEach((row) => expect(row).toHaveLength(7));
  });
  it('marca inMonth corretamente (agosto 2026 = 31 dias)', () => {
    const grid = buildMonthGrid(2026, 8, FIXED_TODAY);
    const inMonth = grid.flat().filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(31);
  });
  it('marca isToday na data certa', () => {
    const grid = buildMonthGrid(2026, 8, FIXED_TODAY);
    const todayCells = grid.flat().filter((c) => c.isToday);
    expect(todayCells).toHaveLength(1);
    expect(todayCells[0].date).toBe(FIXED_TODAY);
  });
  it('semana começa no domingo', () => {
    const grid = buildMonthGrid(2026, 8, FIXED_TODAY);
    expect(grid[0][0].weekday).toBe(0);
  });
  it('mês que começa no domingo não tem overflow antes', () => {
    const grid = buildMonthGrid(2026, 11, FIXED_TODAY); // 1 nov 2026 = domingo
    expect(grid[0][0].inMonth).toBe(true);
  });
  it('retorna grid vazio para input inválido', () => {
    expect(buildMonthGrid(0, 0, FIXED_TODAY)).toEqual([]);
    expect(buildMonthGrid(2026, 13, FIXED_TODAY)).toEqual([]);
  });
});

describe('expandBookingSlots / groupBookingsByDate', () => {
  it('extrai de slots array', () => {
    const b = { id: 'b1', court_id: 'c1', slots: [{ date: '2026-08-15', start: '10:00', end: '12:00' }] };
    const slots = expandBookingSlots(b);
    expect(slots).toHaveLength(1);
    expect(slots[0].court_id).toBe('c1');
  });
  it('extrai de campos planos (legado)', () => {
    const b = { id: 'b1', date: '2026-08-15', start: '10:00', end: '12:00' };
    expect(expandBookingSlots(b)).toHaveLength(1);
  });
  it('agrupa por data', () => {
    const bookings = [
      { id: 'b1', status: 'confirmed', court_id: 'c1', slots: [
        { date: '2026-08-15', start: '10:00', end: '12:00' },
        { date: '2026-08-15', start: '14:00', end: '16:00' },
      ]},
      { id: 'b2', status: 'confirmed', court_id: 'c1', slots: [
        { date: '2026-08-16', start: '09:00', end: '11:00' },
      ]},
    ];
    const g = groupBookingsByDate(bookings);
    expect(g['2026-08-15']).toHaveLength(2);
    expect(g['2026-08-16']).toHaveLength(1);
  });
  it('filtra por court_id e status', () => {
    const bookings = [
      { id: 'b1', status: 'confirmed', court_id: 'c1', slots: [{ date: '2026-08-15', start: '10:00', end: '12:00' }] },
      { id: 'b2', status: 'confirmed', court_id: 'c2', slots: [{ date: '2026-08-15', start: '14:00', end: '16:00' }] },
      { id: 'b3', status: 'cancelled', court_id: 'c1', slots: [{ date: '2026-08-15', start: '18:00', end: '20:00' }] },
    ];
    const g = groupBookingsByDate(bookings, { courtId: 'c1', statuses: ['confirmed'] });
    expect(g['2026-08-15']).toHaveLength(1);
    expect(g['2026-08-15'][0].court_id).toBe('c1');
  });
  it('adiciona metadados do booking ao slot', () => {
    const bookings = [{
      id: 'b1', status: 'confirmed', athlete_name: 'João', kind: 'single',
      slots: [{ date: '2026-08-15', start: '10:00', end: '12:00' }],
    }];
    const g = groupBookingsByDate(bookings);
    expect(g['2026-08-15'][0]).toMatchObject({
      booking_id: 'b1', booking_status: 'confirmed', athlete_name: 'João',
    });
  });
  it('retorna vazio para booking inválido', () => {
    expect(expandBookingSlots(null)).toEqual([]);
    expect(expandBookingSlots({})).toEqual([]);
  });
});

describe('dateRangeISO / monthRangeISO', () => {
  it('gera range inclusivo', () => {
    expect(dateRangeISO('2026-08-15', '2026-08-17'))
      .toEqual(['2026-08-15', '2026-08-16', '2026-08-17']);
  });
  it('range de 1 dia retorna 1 item', () => {
    expect(dateRangeISO('2026-08-15', '2026-08-15')).toEqual(['2026-08-15']);
  });
  it('range vazio para inputs inválidos', () => {
    expect(dateRangeISO('xxx', '2026-08-17')).toEqual([]);
    expect(dateRangeISO('2026-08-17', '2026-08-15')).toEqual([]);
  });
  it('monthRangeISO retorna 42 dias pra qualquer mês', () => {
    const r = monthRangeISO(2026, 8);
    expect(r.dates).toHaveLength(42);
  });
});
