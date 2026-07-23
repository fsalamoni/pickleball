/**
 * Tests do domínio puro de CourtSchedule.
 * Cobre validação, normalização, ordenação, agrupamento, summaries.
 * Sem I/O — só funções puras.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeTime,
  timeToMinutes,
  minutesToTime,
  formatTimeRange,
  normalizeWeekdays,
  normalizeScheduleInput,
  sortSchedules,
  groupSchedulesByWeekday,
  getSchedulesForWeekday,
  activeSchedules,
  summarizeSchedules,
  SCHEDULE,
} from './court_schedule.js';

describe('normalizeTime', () => {
  it('aceita HH:MM e H:MM', () => {
    expect(normalizeTime('08:00')).toBe('08:00');
    expect(normalizeTime('8:00')).toBe('08:00');
    expect(normalizeTime('23:59')).toBe('23:59');
    expect(normalizeTime('00:00')).toBe('00:00');
  });
  it('rejeita inválidos', () => {
    expect(normalizeTime('24:00')).toBeNull();
    expect(normalizeTime('12:60')).toBeNull();
    expect(normalizeTime('abc')).toBeNull();
    expect(normalizeTime('')).toBeNull();
    expect(normalizeTime(null)).toBeNull();
  });
  it('trima whitespace', () => {
    expect(normalizeTime('  08:30  ')).toBe('08:30');
  });
});

describe('timeToMinutes', () => {
  it('converte corretamente', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('08:30')).toBe(510);
    expect(timeToMinutes('23:59')).toBe(1439);
  });
  it('retorna null para inválido', () => {
    expect(timeToMinutes('abc')).toBeNull();
    expect(timeToMinutes('25:00')).toBeNull();
  });
});

describe('minutesToTime', () => {
  it('formata minutos em HH:MM', () => {
    expect(minutesToTime(0)).toBe('00:00');
    expect(minutesToTime(510)).toBe('08:30');
    expect(minutesToTime(1439)).toBe('23:59');
  });
  it('lida com overflow (mod 24h)', () => {
    expect(minutesToTime(1500)).toBe('01:00');
  });
  it('retorna null para inválido', () => {
    expect(minutesToTime(-1)).toBeNull();
    expect(minutesToTime('abc')).toBeNull();
  });
});

describe('formatTimeRange', () => {
  it('formata com en-dash', () => {
    expect(formatTimeRange('08:00', '12:00')).toBe('08:00–12:00');
  });
  it('retorna vazio se inválido', () => {
    expect(formatTimeRange('abc', '12:00')).toBe('');
  });
});

describe('normalizeWeekdays', () => {
  it('ordena e remove duplicatas', () => {
    expect(normalizeWeekdays([3, 1, 3, 2])).toEqual([1, 2, 3]);
  });
  it('rejeita fora de 0-6', () => {
    expect(normalizeWeekdays([1, 7])).toBeNull();
    expect(normalizeWeekdays([-1, 2])).toBeNull();
  });
  it('rejeita array vazio', () => {
    expect(normalizeWeekdays([])).toBeNull();
  });
  it('rejeita floats', () => {
    expect(normalizeWeekdays([1.5])).toBeNull();
  });
  it('aceita strings numéricas (vindas de JSON.parse)', () => {
    expect(normalizeWeekdays(['1', '2'])).toEqual([1, 2]);
  });
  it('rejeita não-array', () => {
    expect(normalizeWeekdays(null)).toBeNull();
    expect(normalizeWeekdays('1,2,3')).toBeNull();
  });
});

describe('normalizeScheduleInput', () => {
  it('aceita válido completo', () => {
    const r = normalizeScheduleInput({
      weekdays: [1, 2, 3, 4, 5],
      start_time: '08:00',
      end_time: '12:00',
      label: 'Manhã',
    });
    expect(r.valid).toBe(true);
    expect(r.value).toMatchObject({
      weekdays: [1, 2, 3, 4, 5],
      start_time: '08:00',
      end_time: '12:00',
      label: 'Manhã',
      is_active: true,
    });
  });
  it('rejeita start >= end', () => {
    const r = normalizeScheduleInput({ weekdays: [1], start_time: '10:00', end_time: '08:00' });
    expect(r.valid).toBe(false);
    expect(r.errors.end_time).toContain('depois');
  });
  it('rejeita start inválido', () => {
    const r = normalizeScheduleInput({ weekdays: [1], start_time: 'abc', end_time: '12:00' });
    expect(r.valid).toBe(false);
    expect(r.errors.start_time).toBeTruthy();
  });
  it('rejeita end inválido', () => {
    const r = normalizeScheduleInput({ weekdays: [1], start_time: '08:00', end_time: 'abc' });
    expect(r.valid).toBe(false);
    expect(r.errors.end_time).toBeTruthy();
  });
  it('rejeita weekdays vazio', () => {
    const r = normalizeScheduleInput({ weekdays: [], start_time: '08:00', end_time: '12:00' });
    expect(r.valid).toBe(false);
    expect(r.errors.weekdays).toBeTruthy();
  });
  it('trunca label > 60 chars', () => {
    const r = normalizeScheduleInput({
      weekdays: [1], start_time: '08:00', end_time: '12:00',
      label: 'A'.repeat(80),
    });
    expect(r.valid).toBe(true);
    expect(r.value.label).toHaveLength(60);
  });
});

describe('sortSchedules', () => {
  it('ordena por primeiro weekday, depois start_time', () => {
    const s = [
      { weekdays: [3, 5], start_time: '14:00', end_time: '18:00' },
      { weekdays: [1], start_time: '08:00', end_time: '12:00' },
      { weekdays: [1, 2], start_time: '14:00', end_time: '18:00' },
    ];
    const result = sortSchedules(s);
    expect(result.map((x) => x.start_time)).toEqual(['08:00', '14:00', '14:00']);
  });
  it('não muta o array original', () => {
    const s = [
      { weekdays: [3], start_time: '14:00', end_time: '18:00' },
      { weekdays: [1], start_time: '08:00', end_time: '12:00' },
    ];
    const before = JSON.stringify(s);
    sortSchedules(s);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('groupSchedulesByWeekday', () => {
  it('expande schedules multi-dia pra todos os weekdays', () => {
    const s = [
      { weekdays: [1, 2, 3], start_time: '08:00', end_time: '12:00' },
      { weekdays: [6], start_time: '14:00', end_time: '22:00' },
    ];
    const g = groupSchedulesByWeekday(s);
    expect(g[1]).toHaveLength(1);
    expect(g[2]).toHaveLength(1);
    expect(g[3]).toHaveLength(1);
    expect(g[6]).toHaveLength(1);
    expect(g[0]).toEqual([]);
  });
  it('retorna estrutura completa mesmo se vazio', () => {
    const g = groupSchedulesByWeekday([]);
    expect(Object.keys(g)).toHaveLength(7);
    expect(g[0]).toEqual([]);
  });
});

describe('getSchedulesForWeekday', () => {
  it('filtra pelo weekday', () => {
    const s = [
      { weekdays: [1, 2, 3], start_time: '08:00', end_time: '12:00' },
      { weekdays: [1], start_time: '14:00', end_time: '18:00' },
      { weekdays: [6], start_time: '14:00', end_time: '22:00' },
    ];
    expect(getSchedulesForWeekday(s, 1)).toHaveLength(2);
    expect(getSchedulesForWeekday(s, 2)).toHaveLength(1);
    expect(getSchedulesForWeekday(s, 6)).toHaveLength(1);
    expect(getSchedulesForWeekday(s, 0)).toHaveLength(0);
  });
});

describe('activeSchedules', () => {
  it('filtra inativos', () => {
    const s = [
      { id: '1', is_active: true },
      { id: '2', is_active: false },
      { id: '3' },
    ];
    expect(activeSchedules(s).map((x) => x.id)).toEqual(['1', '3']);
  });
});

describe('summarizeSchedules', () => {
  it('formata range contíguo', () => {
    const s = [
      { weekdays: [1, 2, 3, 4, 5], start_time: '08:00', end_time: '12:00', is_active: true },
    ];
    expect(summarizeSchedules(s)).toBe('Seg–Sex 08:00–12:00');
  });
  it('formata lista de dias não-contíguos', () => {
    const s = [
      { weekdays: [1, 3, 5], start_time: '08:00', end_time: '12:00', is_active: true },
    ];
    expect(summarizeSchedules(s)).toBe('Seg, Qua, Sex 08:00–12:00');
  });
  it('formata "Todos os dias" pra weekday 0-6', () => {
    const s = [
      { weekdays: [0, 1, 2, 3, 4, 5, 6], start_time: '06:00', end_time: '23:00', is_active: true },
    ];
    expect(summarizeSchedules(s)).toBe('Todos os dias 06:00–23:00');
  });
  it('inclui label quando presente', () => {
    const s = [
      { weekdays: [1, 2, 3, 4, 5], start_time: '08:00', end_time: '12:00', label: 'Comercial', is_active: true },
    ];
    expect(summarizeSchedules(s)).toBe('Seg–Sex 08:00–12:00 (Comercial)');
  });
  it('omite inativos', () => {
    const s = [
      { weekdays: [1], start_time: '08:00', end_time: '12:00', is_active: false },
      { weekdays: [2], start_time: '14:00', end_time: '18:00', is_active: true },
    ];
    expect(summarizeSchedules(s)).toBe('Ter 14:00–18:00');
  });
  it('retorna string vazia se nenhum ativo', () => {
    expect(summarizeSchedules([])).toBe('');
    expect(summarizeSchedules([{ is_active: false }])).toBe('');
  });
});

describe('SCHEDULE constants', () => {
  it('WEEKDAYS tem 7 chaves (0-6)', () => {
    expect(Object.keys(SCHEDULE.WEEKDAYS)).toHaveLength(7);
    expect(SCHEDULE.WEEKDAYS.SUNDAY).toBe(0);
    expect(SCHEDULE.WEEKDAYS.SATURDAY).toBe(6);
  });
  it('WEEKDAY_LABELS_PT e WEEKDAY_SHORT_PT são pt-BR', () => {
    expect(SCHEDULE.WEEKDAY_LABELS_PT[0]).toBe('Domingo');
    expect(SCHEDULE.WEEKDAY_SHORT_PT[1]).toBe('Seg');
  });
});
