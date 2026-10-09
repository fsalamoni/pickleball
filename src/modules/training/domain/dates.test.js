import { describe, it, expect } from 'vitest';
import {
  toISODate, todayLocal, isISODate, addDays, weekdayOf, weekKeyOf, weekDates, daysBetween, formatDayLabel,
} from './dates.js';

/** Roda `fn` num fuso com horário de verão (Node relê TZ na hora). */
function emFuso(tz, fn) {
  const antes = process.env.TZ;
  process.env.TZ = tz;
  try { fn(); } finally {
    if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes;
  }
}

describe('dia local', () => {
  it('toISODate/todayLocal usam o dia LOCAL, não o de Greenwich', () => {
    expect(toISODate(new Date(2026, 9, 8, 23, 30))).toBe('2026-10-08');
    expect(todayLocal(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });

  it('isISODate', () => {
    expect(isISODate('2026-10-08')).toBe(true);
    expect(isISODate('08/10/2026')).toBe(false);
    expect(isISODate(null)).toBe(false);
  });
});

describe('addDays / daysBetween', () => {
  it('atravessa mês, ano e 29 de fevereiro', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-10-08', 0)).toBe('2026-10-08');
  });

  it('daysBetween conta dias inteiros, com sinal', () => {
    expect(daysBetween('2026-10-01', '2026-10-08')).toBe(7);
    expect(daysBetween('2026-10-08', '2026-10-01')).toBe(-7);
    expect(daysBetween('2026-12-25', '2027-01-01')).toBe(7);
  });

  it('seguro no horário de verão', () => {
    emFuso('America/New_York', () => {
      // 2026-03-08: os EUA adiantam o relógio
      expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
      expect(daysBetween('2026-03-02', '2026-03-09')).toBe(7);
      expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
      expect(weekKeyOf('2026-03-09')).toBe('2026-03-09');
    });
  });
});

describe('semana (segunda a domingo)', () => {
  it('weekdayOf: 0 = domingo', () => {
    expect(weekdayOf('2026-10-11')).toBe(0);
    expect(weekdayOf('2026-10-08')).toBe(4);
  });

  it('weekKeyOf devolve a segunda; domingo pertence à semana anterior', () => {
    expect(weekKeyOf('2026-10-05')).toBe('2026-10-05');
    expect(weekKeyOf('2026-10-08')).toBe('2026-10-05');
    expect(weekKeyOf('2026-10-11')).toBe('2026-10-05');
    expect(weekKeyOf('2026-10-12')).toBe('2026-10-12');
    expect(weekKeyOf('2026-11-01')).toBe('2026-10-26');
  });

  it('weekDates: os 7 dias da segunda ao domingo', () => {
    const d = weekDates('2026-09-28');
    expect(d).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(weekdayOf(d[0])).toBe(1);
    expect(weekdayOf(d[6])).toBe(0);
  });
});

describe('formatDayLabel', () => {
  it('dia da semana e data; o ano só quando não é o corrente', () => {
    expect(formatDayLabel('2026-10-08', '2026-10-08')).toBe('Qui, 08/10');
    expect(formatDayLabel('2026-10-08', '2027-01-02')).toBe('Qui, 08/10/2026');
    expect(formatDayLabel('lixo', '2026-10-08')).toBe('');
  });
});
