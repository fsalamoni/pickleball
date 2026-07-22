/**
 * Tests do domínio puro de booking_conflict.
 * Cobre detecção de conflito, alinhamento de schedule, availability por data.
 * Sem I/O — só funções puras.
 */

import { describe, it, expect } from 'vitest';
import {
  checkBookingConflict,
  checkScheduleAlignment,
  validateBookingRequest,
  getCourtAvailabilityForDate,
  BLOCKING_STATUSES,
} from './booking_conflict.js';
import { BOOKING_STATUS } from './constants.js';

const futureDate = '2026-08-10'; // segunda-feira

describe('BLOCKING_STATUSES', () => {
  it('contém REQUESTED, NEGOTIATING, CONFIRMED', () => {
    expect(BLOCKING_STATUSES).toContain(BOOKING_STATUS.REQUESTED);
    expect(BLOCKING_STATUSES).toContain(BOOKING_STATUS.NEGOTIATING);
    expect(BLOCKING_STATUSES).toContain(BOOKING_STATUS.CONFIRMED);
  });
  it('NÃO contém DECLINED, CANCELLED, COMPLETED', () => {
    expect(BLOCKING_STATUSES).not.toContain(BOOKING_STATUS.DECLINED);
    expect(BLOCKING_STATUSES).not.toContain(BOOKING_STATUS.CANCELLED);
    expect(BLOCKING_STATUSES).not.toContain(BOOKING_STATUS.COMPLETED);
  });
});

describe('checkBookingConflict', () => {
  const confirmed = (id, date, start, end, court_id = 'c1') => ({
    id, status: BOOKING_STATUS.CONFIRMED, court_id, date, start, end,
  });
  const requested = (id, date, start, end, court_id = 'c1') => ({
    id, status: BOOKING_STATUS.REQUESTED, court_id, date, start, end,
  });
  const cancelled = (id, date, start, end, court_id = 'c1') => ({
    id, status: BOOKING_STATUS.CANCELLED, court_id, date, start, end,
  });

  it('detecta conflito com CONFIRMED', () => {
    const r = checkBookingConflict(
      [{ date: futureDate, start: '10:00', end: '12:00', court_id: 'c1' }],
      [confirmed('b1', futureDate, '11:00', '13:00', 'c1')],
    );
    expect(r.hasConflict).toBe(true);
    expect(r.conflicts).toHaveLength(1);
  });
  it('detecta conflito com REQUESTED (não só CONFIRMED)', () => {
    const r = checkBookingConflict(
      [{ date: futureDate, start: '10:00', end: '12:00', court_id: 'c1' }],
      [requested('b1', futureDate, '11:00', '13:00', 'c1')],
    );
    expect(r.hasConflict).toBe(true);
  });
  it('NÃO conflita com CANCELLED/COMPLETED/DECLINED', () => {
    const r = checkBookingConflict(
      [{ date: futureDate, start: '10:00', end: '12:00', court_id: 'c1' }],
      [
        cancelled('b1', futureDate, '10:30', '11:30', 'c1'),
        { id: 'b2', status: BOOKING_STATUS.COMPLETED, court_id: 'c1', date: futureDate, start: '10:30', end: '11:30' },
        { id: 'b3', status: BOOKING_STATUS.DECLINED, court_id: 'c1', date: futureDate, start: '10:30', end: '11:30' },
      ],
    );
    expect(r.hasConflict).toBe(false);
  });
  it('datas diferentes não conflitam', () => {
    const r = checkBookingConflict(
      [{ date: futureDate, start: '10:00', end: '12:00', court_id: 'c1' }],
      [confirmed('b1', '2026-08-11', '11:00', '13:00', 'c1')],
    );
    expect(r.hasConflict).toBe(false);
  });
  it('horários adjacentes não conflitam (boundary strict)', () => {
    const r = checkBookingConflict(
      [{ date: futureDate, start: '10:00', end: '12:00', court_id: 'c1' }],
      [confirmed('b1', futureDate, '12:00', '14:00', 'c1')],
    );
    expect(r.hasConflict).toBe(false);
  });
  it('quadras diferentes não conflitam', () => {
    const r = checkBookingConflict(
      [{ date: futureDate, start: '10:00', end: '12:00', court_id: 'c1' }],
      [confirmed('b1', futureDate, '11:00', '13:00', 'c2')],
    );
    expect(r.hasConflict).toBe(false);
  });
  it('booking legado sem court_id conflita com qualquer quadra', () => {
    const r = checkBookingConflict(
      [{ date: futureDate, start: '10:00', end: '12:00', court_id: 'c1' }],
      [{ id: 'b1', status: BOOKING_STATUS.CONFIRMED, date: futureDate, start: '11:00', end: '13:00' }],
    );
    expect(r.hasConflict).toBe(true);
  });
  it('lida com slots array (formato novo)', () => {
    const r = checkBookingConflict(
      [{ date: futureDate, start: '10:00', end: '12:00', court_id: 'c1' }],
      [{ id: 'b1', status: BOOKING_STATUS.CONFIRMED, court_id: 'c1', slots: [{ date: futureDate, start: '11:00', end: '13:00' }] }],
    );
    expect(r.hasConflict).toBe(true);
  });
  it('múltiplos candidatos: detecta qualquer conflito', () => {
    const r = checkBookingConflict(
      [
        { date: futureDate, start: '10:00', end: '12:00', court_id: 'c1' },
        { date: futureDate, start: '14:00', end: '16:00', court_id: 'c1' },
      ],
      [confirmed('b1', futureDate, '15:00', '17:00', 'c1')],
    );
    expect(r.hasConflict).toBe(true);
    expect(r.conflicts).toHaveLength(1);
  });
});

describe('checkScheduleAlignment', () => {
  const segSex = {
    is_active: true,
    weekdays: [1, 2, 3, 4, 5],
    start_time: '08:00',
    end_time: '22:00',
  };

  it('slot dentro da janela retorna aligned', () => {
    const r = checkScheduleAlignment({
      date: futureDate, start_time: '10:00', end_time: '12:00', court_id: 'c1',
      court_schedules: [segSex],
    });
    expect(r.aligned).toBe(true);
  });
  it('slot parcialmente fora retorna NOT aligned', () => {
    const r = checkScheduleAlignment({
      date: futureDate, start_time: '21:00', end_time: '23:00', court_id: 'c1',
      court_schedules: [segSex],
    });
    expect(r.aligned).toBe(false);
  });
  it('slot no sábado (não está em seg-sex) retorna NOT aligned', () => {
    const r = checkScheduleAlignment({
      date: '2026-08-15', // sábado
      start_time: '10:00', end_time: '12:00', court_id: 'c1',
      court_schedules: [segSex],
    });
    expect(r.aligned).toBe(false);
  });
  it('sem schedules: fallback permissivo (aligned=true)', () => {
    const r = checkScheduleAlignment({
      date: futureDate, start_time: '10:00', end_time: '12:00', court_id: 'c1',
      court_schedules: [],
    });
    expect(r.aligned).toBe(true);
  });
  it('schedule inativo é ignorado', () => {
    const r = checkScheduleAlignment({
      date: futureDate, start_time: '10:00', end_time: '12:00', court_id: 'c1',
      court_schedules: [{ ...segSex, is_active: false }],
    });
    expect(r.aligned).toBe(false); // não tem nenhum ativo
  });
  it('múltiplas janelas: se uma cobre, está aligned', () => {
    const r = checkScheduleAlignment({
      date: futureDate, start_time: '10:00', end_time: '12:00', court_id: 'c1',
      court_schedules: [
        { is_active: true, weekdays: [1], start_time: '14:00', end_time: '18:00' },
        segSex,
      ],
    });
    expect(r.aligned).toBe(true);
    expect(r.matching).toHaveLength(1);
  });
  it('data inválida retorna error', () => {
    const r = checkScheduleAlignment({
      date: 'abc', start_time: '10:00', end_time: '12:00', court_id: 'c1',
      court_schedules: [segSex],
    });
    expect(r.aligned).toBe(false);
    expect(r.error).toBeTruthy();
  });
});

describe('validateBookingRequest', () => {
  const segSex = {
    is_active: true,
    weekdays: [1, 2, 3, 4, 5],
    start_time: '08:00',
    end_time: '22:00',
  };
  const existingConfirmed = {
    id: 'b1', status: BOOKING_STATUS.CONFIRMED,
    court_id: 'c1', date: futureDate, start: '11:00', end: '13:00',
  };

  it('slot válido sem conflito retorna ok', () => {
    const r = validateBookingRequest({
      date: futureDate, start_time: '14:00', end_time: '16:00', court_id: 'c1',
      existingBookings: [], court_schedules: [segSex],
    });
    expect(r.ok).toBe(true);
  });
  it('slot fora do schedule retorna not ok com reason outside_schedule', () => {
    const r = validateBookingRequest({
      date: '2026-08-15', // sábado, fora do seg-sex
      start_time: '10:00', end_time: '12:00', court_id: 'c1',
      existingBookings: [], court_schedules: [segSex],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('outside_schedule');
  });
  it('slot em conflito retorna not ok com reason conflict', () => {
    const r = validateBookingRequest({
      date: futureDate, start_time: '10:00', end_time: '14:00', court_id: 'c1',
      existingBookings: [existingConfirmed], court_schedules: [segSex],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('conflict');
    expect(r.conflicts).toHaveLength(1);
  });
  it('slot inválido (end <= start) retorna invalid_slot', () => {
    const r = validateBookingRequest({
      date: futureDate, start_time: '12:00', end_time: '10:00', court_id: 'c1',
      existingBookings: [], court_schedules: [segSex],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid_slot');
  });
  it('prioriza conflict sobre outside_schedule (se ambos)', () => {
    // Fora do schedule E em conflito: ainda é outside_schedule
    const r = validateBookingRequest({
      date: '2026-08-15', // sábado
      start_time: '10:00', end_time: '12:00', court_id: 'c1',
      existingBookings: [existingConfirmed], court_schedules: [segSex],
    });
    // Fora do schedule é mais urgente (não adianta ajustar horário, é outro dia)
    expect(r.reason).toBe('outside_schedule');
  });
});

describe('getCourtAvailabilityForDate', () => {
  const segSex = {
    is_active: true,
    weekdays: [1, 2, 3, 4, 5],
    start_time: '08:00',
    end_time: '22:00',
  };

  it('sem reservas: retorna a janela inteira como livre', () => {
    const r = getCourtAvailabilityForDate({
      date: futureDate, court_schedules: [segSex], existingBookings: [], duration: 60,
    });
    expect(r.busy).toEqual([]);
    expect(r.free).toEqual([{ start: '08:00', end: '22:00', duration_min: 840 }]);
  });
  it('subtrai reserva no meio', () => {
    const booking = {
      id: 'b1', status: BOOKING_STATUS.CONFIRMED,
      court_id: 'c1', date: futureDate, start: '10:00', end: '12:00',
    };
    const r = getCourtAvailabilityForDate({
      date: futureDate, court_schedules: [segSex], existingBookings: [booking], duration: 60,
    });
    expect(r.busy).toHaveLength(1);
    expect(r.free).toEqual([
      { start: '08:00', end: '10:00', duration_min: 120 },
      { start: '12:00', end: '22:00', duration_min: 600 },
    ]);
  });
  it('filtra livres por duração mínima', () => {
    const booking = {
      id: 'b1', status: BOOKING_STATUS.CONFIRMED,
      court_id: 'c1', date: futureDate, start: '10:00', end: '10:30',
    };
    const r = getCourtAvailabilityForDate({
      date: futureDate, court_schedules: [segSex], existingBookings: [booking], duration: 60,
    });
    // Slot de 30min não satisfaz duration=60
    expect(r.free).toEqual([
      { start: '08:00', end: '10:00', duration_min: 120 },
      { start: '10:30', end: '22:00', duration_min: 690 },
    ]);
  });
  it('ignora reservas canceladas/completed', () => {
    const cancelled = {
      id: 'b1', status: BOOKING_STATUS.CANCELLED,
      court_id: 'c1', date: futureDate, start: '10:00', end: '12:00',
    };
    const r = getCourtAvailabilityForDate({
      date: futureDate, court_schedules: [segSex], existingBookings: [cancelled], duration: 60,
    });
    expect(r.busy).toEqual([]);
    expect(r.free).toEqual([{ start: '08:00', end: '22:00', duration_min: 840 }]);
  });
  it('sem schedules: retorna arrays vazios', () => {
    const r = getCourtAvailabilityForDate({
      date: futureDate, court_schedules: [], existingBookings: [], duration: 60,
    });
    expect(r.busy).toEqual([]);
    expect(r.free).toEqual([]);
  });
  it('data inválida retorna vazio', () => {
    const r = getCourtAvailabilityForDate({
      date: 'xxx', court_schedules: [segSex], existingBookings: [], duration: 60,
    });
    expect(r.busy).toEqual([]);
    expect(r.free).toEqual([]);
  });
  it('múltiplas reservas em sequência', () => {
    const bookings = [
      { id: 'b1', status: BOOKING_STATUS.CONFIRMED, court_id: 'c1', date: futureDate, start: '09:00', end: '11:00' },
      { id: 'b2', status: BOOKING_STATUS.CONFIRMED, court_id: 'c1', date: futureDate, start: '14:00', end: '16:00' },
    ];
    const r = getCourtAvailabilityForDate({
      date: futureDate, court_schedules: [segSex], existingBookings: bookings, duration: 60,
    });
    expect(r.free).toEqual([
      { start: '08:00', end: '09:00', duration_min: 60 },
      { start: '11:00', end: '14:00', duration_min: 180 },
      { start: '16:00', end: '22:00', duration_min: 360 },
    ]);
  });
});
