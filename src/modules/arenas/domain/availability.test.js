import { describe, expect, it } from 'vitest';
import {
  AGENDA_TONE,
  buildWeekAgenda,
  formatWeekRange,
  shiftWeekStart,
  weekDays,
  weekStartOf,
} from './availability.js';
import { BOOKING_STATUS } from './constants.js';

describe('weekStartOf / weekDays / shiftWeekStart', () => {
  it('retorna a segunda-feira da semana', () => {
    expect(weekStartOf('2026-07-20')).toBe('2026-07-20'); // segunda
    expect(weekStartOf('2026-07-22')).toBe('2026-07-20'); // quarta
    expect(weekStartOf('2026-07-26')).toBe('2026-07-20'); // domingo
  });

  it('gera as 7 datas da semana', () => {
    const days = weekDays('2026-07-20');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-07-20');
    expect(days[6]).toBe('2026-07-26');
  });

  it('desloca semanas para frente e para trás', () => {
    expect(shiftWeekStart('2026-07-20', 1)).toBe('2026-07-27');
    expect(shiftWeekStart('2026-07-20', -1)).toBe('2026-07-13');
  });

  it('entrada inválida → null/[]', () => {
    expect(weekStartOf('x')).toBeNull();
    expect(weekDays('x')).toEqual([]);
  });
});

describe('buildWeekAgenda', () => {
  const weekStart = '2026-07-20';

  it('coloca reservas confirmadas e pendentes nos dias certos', () => {
    const agenda = buildWeekAgenda({
      weekStart,
      bookings: [
        { id: 'b1', status: BOOKING_STATUS.CONFIRMED, athlete_name: 'João', slots: [{ date: '2026-07-21', start: '08:00', end: '09:00' }] },
        { id: 'b2', status: BOOKING_STATUS.REQUESTED, athlete_name: 'Maria', slots: [{ date: '2026-07-21', start: '10:00', end: '11:30' }] },
      ],
    });
    const tuesday = agenda.days.find((d) => d.date === '2026-07-21');
    expect(tuesday.entries).toHaveLength(2);
    expect(tuesday.entries[0]).toMatchObject({ label: 'João', tone: AGENDA_TONE.CONFIRMED, startMinutes: 480 });
    expect(tuesday.entries[1]).toMatchObject({ label: 'Maria', tone: AGENDA_TONE.PENDING });
    expect(agenda.totalEntries).toBe(2);
  });

  it('ignora reservas canceladas/recusadas/concluídas e fora da semana', () => {
    const agenda = buildWeekAgenda({
      weekStart,
      bookings: [
        { status: BOOKING_STATUS.CANCELLED, slots: [{ date: '2026-07-21', start: '08:00', end: '09:00' }] },
        { status: BOOKING_STATUS.DECLINED, slots: [{ date: '2026-07-21', start: '08:00', end: '09:00' }] },
        { status: BOOKING_STATUS.COMPLETED, slots: [{ date: '2026-07-21', start: '08:00', end: '09:00' }] },
        { status: BOOKING_STATUS.CONFIRMED, slots: [{ date: '2026-08-01', start: '08:00', end: '09:00' }] },
      ],
    });
    expect(agenda.totalEntries).toBe(0);
  });

  it('recorta blocos à janela do dia e descarta slots inválidos', () => {
    const agenda = buildWeekAgenda({
      weekStart,
      dayStart: '08:00',
      dayEnd: '22:00',
      bookings: [
        { status: BOOKING_STATUS.CONFIRMED, slots: [{ date: '2026-07-20', start: '06:00', end: '09:00' }] },
        { status: BOOKING_STATUS.CONFIRMED, slots: [{ date: '2026-07-20', start: '23:00', end: '23:30' }] },
        { status: BOOKING_STATUS.CONFIRMED, slots: [{ date: '2026-07-20', start: '10:00', end: '10:00' }] },
      ],
    });
    const monday = agenda.days[0];
    expect(monday.entries).toHaveLength(1);
    expect(monday.entries[0].startMinutes).toBe(480); // 08:00
    expect(monday.entries[0].endMinutes).toBe(540); // 09:00
  });

  it('suporta reserva no formato antigo (date/start/end sem slots)', () => {
    const agenda = buildWeekAgenda({
      weekStart,
      bookings: [{ status: BOOKING_STATUS.CONFIRMED, date: '2026-07-24', start: '18:00', end: '19:00' }],
    });
    expect(agenda.days.find((d) => d.date === '2026-07-24').entries).toHaveLength(1);
  });

  it('ordena as entradas do dia por horário', () => {
    const agenda = buildWeekAgenda({
      weekStart,
      bookings: [
        { status: BOOKING_STATUS.CONFIRMED, slots: [{ date: '2026-07-20', start: '15:00', end: '16:00' }] },
        { status: BOOKING_STATUS.CONFIRMED, slots: [{ date: '2026-07-20', start: '09:00', end: '10:00' }] },
      ],
    });
    const starts = agenda.days[0].entries.map((e) => e.start);
    expect(starts).toEqual(['09:00', '15:00']);
  });
});

describe('formatWeekRange', () => {
  it('formata o intervalo curto da semana', () => {
    expect(formatWeekRange('2026-07-20')).toBe('20/07 – 26/07');
  });
});
