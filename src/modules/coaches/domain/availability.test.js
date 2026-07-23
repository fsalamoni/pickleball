import { describe, it, expect } from 'vitest';
import {
  normalizeWindow,
  normalizeException,
  normalizeAvailability,
  isExceptionDate,
  generateDaySlots,
  generateWeekSlots,
  countFreeSlots,
  SLOT_MINUTES_DEFAULT,
} from './availability.js';

describe('normalizeWindow', () => {
  it('valida janela com dias e horários corretos', () => {
    const r = normalizeWindow({ weekdays: [1, 3, 5], start: '08:00', end: '12:00' });
    expect(r.valid).toBe(true);
    expect(r.value.weekdays).toEqual([1, 3, 5]);
    expect(r.value.id).toMatch(/^w_/);
  });

  it('rejeita janela sem dias', () => {
    expect(normalizeWindow({ weekdays: [], start: '08:00', end: '12:00' }).valid).toBe(false);
  });

  it('rejeita horário final <= inicial', () => {
    expect(normalizeWindow({ weekdays: [1], start: '12:00', end: '08:00' }).valid).toBe(false);
    expect(normalizeWindow({ weekdays: [1], start: '12:00', end: '12:00' }).valid).toBe(false);
  });

  it('deduplica e ordena dias, ignora fora de 0..6', () => {
    const r = normalizeWindow({ weekdays: [5, 1, 1, 9, -1, 3], start: '08:00', end: '09:00' });
    expect(r.value.weekdays).toEqual([1, 3, 5]);
  });

  it('preserva o id fornecido e arena_id/location opcionais', () => {
    const r = normalizeWindow({ id: 'w1', weekdays: [2], start: '10:00', end: '11:00', arena_id: 'a1', location: 'Quadra 2' });
    expect(r.value.id).toBe('w1');
    expect(r.value.arena_id).toBe('a1');
    expect(r.value.location).toBe('Quadra 2');
  });
});

describe('normalizeException', () => {
  it('valida data ISO', () => {
    expect(normalizeException({ date: '2026-07-25', reason: 'Férias' }).valid).toBe(true);
  });
  it('rejeita data inválida', () => {
    expect(normalizeException({ date: '25/07/2026' }).valid).toBe(false);
  });
});

describe('normalizeAvailability', () => {
  it('filtra janelas inválidas e aplica slot_minutes padrão', () => {
    const av = normalizeAvailability({
      coach_id: 'c1',
      windows: [
        { weekdays: [1], start: '08:00', end: '10:00' },
        { weekdays: [], start: '08:00', end: '10:00' }, // inválida
      ],
      exceptions: [{ date: '2026-07-25' }, { date: 'bad' }],
    });
    expect(av.windows).toHaveLength(1);
    expect(av.exceptions).toHaveLength(1);
    expect(av.slot_minutes).toBe(SLOT_MINUTES_DEFAULT);
    expect(av.coach_id).toBe('c1');
  });

  it('respeita slot_minutes dentro dos limites', () => {
    expect(normalizeAvailability({ slot_minutes: 30 }).slot_minutes).toBe(30);
    expect(normalizeAvailability({ slot_minutes: 5 }).slot_minutes).toBe(SLOT_MINUTES_DEFAULT);
    expect(normalizeAvailability({ slot_minutes: 999 }).slot_minutes).toBe(SLOT_MINUTES_DEFAULT);
  });
});

describe('isExceptionDate', () => {
  it('detecta folga', () => {
    const av = { exceptions: [{ date: '2026-07-25' }] };
    expect(isExceptionDate(av, '2026-07-25')).toBe(true);
    expect(isExceptionDate(av, '2026-07-26')).toBe(false);
  });
});

describe('generateDaySlots', () => {
  // 2026-07-27 é uma segunda-feira (weekday 1).
  const availability = {
    coach_id: 'c1',
    slot_minutes: 60,
    windows: [{ id: 'w1', weekdays: [1], start: '08:00', end: '11:00', location: 'Arena X' }],
    exceptions: [],
  };

  it('gera slots de 1h dentro da janela do dia correto', () => {
    const slots = generateDaySlots(availability, '2026-07-27');
    expect(slots.map((s) => s.start)).toEqual(['08:00', '09:00', '10:00']);
    expect(slots[0].end).toBe('09:00');
    expect(slots[0].location).toBe('Arena X');
  });

  it('não gera slots num dia sem janela', () => {
    // 2026-07-28 é terça (weekday 2), sem janela.
    expect(generateDaySlots(availability, '2026-07-28')).toEqual([]);
  });

  it('não gera slots numa data de exceção', () => {
    const av = { ...availability, exceptions: [{ date: '2026-07-27' }] };
    expect(generateDaySlots(av, '2026-07-27')).toEqual([]);
  });

  it('desconta horários ocupados (aulas confirmadas)', () => {
    const busy = [{ date: '2026-07-27', start: '09:00', end: '10:00' }];
    const slots = generateDaySlots(availability, '2026-07-27', { busy });
    expect(slots.map((s) => s.start)).toEqual(['08:00', '10:00']);
  });

  it('desconta ocupação parcialmente sobreposta', () => {
    const busy = [{ date: '2026-07-27', start: '08:30', end: '08:45' }];
    const slots = generateDaySlots(availability, '2026-07-27', { busy });
    // 08:00-09:00 sobrepõe 08:30-08:45, então cai.
    expect(slots.map((s) => s.start)).toEqual(['09:00', '10:00']);
  });

  it('respeita slot_minutes de 30', () => {
    const av = { ...availability, slot_minutes: 30, windows: [{ weekdays: [1], start: '08:00', end: '09:00' }] };
    expect(generateDaySlots(av, '2026-07-27').map((s) => s.start)).toEqual(['08:00', '08:30']);
  });

  it('ignora data mal formatada', () => {
    expect(generateDaySlots(availability, '27/07/2026')).toEqual([]);
  });
});

describe('generateWeekSlots / countFreeSlots', () => {
  const availability = {
    slot_minutes: 60,
    windows: [{ weekdays: [1, 3], start: '08:00', end: '10:00' }], // seg e qua
    exceptions: [],
  };

  it('agrupa slots por dia, omitindo dias vazios', () => {
    // A partir de 2026-07-27 (seg): seg 27 e qua 29 têm slots.
    const week = generateWeekSlots(availability, '2026-07-27', { days: 7 });
    expect(week.map((d) => d.date)).toEqual(['2026-07-27', '2026-07-29']);
    expect(week[0].slots).toHaveLength(2);
  });

  it('conta o total de slots livres', () => {
    expect(countFreeSlots(availability, '2026-07-27', { days: 7 })).toBe(4);
  });
});
