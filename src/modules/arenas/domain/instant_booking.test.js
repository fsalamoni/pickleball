/**
 * Tests do domínio puro de instant_booking.
 * Sem I/O — só funções puras.
 */

import { describe, it, expect } from 'vitest';
import { canBeInstantBooking, getInitialBookingStatus, arenaSupportsInstant, INSTANT_BOOKING_LABELS } from './instant_booking.js';
import { BOOKING_STATUS } from './constants.js';
import { PAYMENT_METHOD } from './pdv.js';

const validInput = {
  date: '2030-08-15',
  start_time: '10:00',
  end_time: '12:00',
  court_id: 'c1',
  proposed_price: 100,
  payment_method: PAYMENT_METHOD.PIX,
};

const arena = { allow_instant_booking: true };

describe('canBeInstantBooking', () => {
  it('aceita input válido', () => {
    const r = canBeInstantBooking(validInput, arena);
    expect(r.ok).toBe(true);
  });
  it('rejeita se arena não permite', () => {
    const r = canBeInstantBooking(validInput, { allow_instant_booking: false });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('arena_disabled');
  });
  it('rejeita se arena.allow_instant_booking não está setado', () => {
    const r = canBeInstantBooking(validInput, {});
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('arena_disabled');
  });
  it('rejeita slot inválido (end <= start)', () => {
    const r = canBeInstantBooking({ ...validInput, end_time: '09:00' }, arena);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid_slot');
  });
  it('rejeita slot sem data', () => {
    const r = canBeInstantBooking({ ...validInput, date: '' }, arena);
    expect(r.ok).toBe(false);
  });
  it('rejeita preço zero (instant não pode ser grátis)', () => {
    const r = canBeInstantBooking({ ...validInput, proposed_price: 0 }, arena);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_price');
  });
  it('rejeita preço negativo', () => {
    const r = canBeInstantBooking({ ...validInput, proposed_price: -10 }, arena);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_price');
  });
  it('rejeita preço NaN/null', () => {
    const r = canBeInstantBooking({ ...validInput, proposed_price: null }, arena);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_price');
  });
  it('rejeita payment_method inválido', () => {
    const r = canBeInstantBooking({ ...validInput, payment_method: 'bitcoin' }, arena);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_payment_method');
  });
  it('rejeita payment_method faltando', () => {
    const r = canBeInstantBooking({ ...validInput, payment_method: undefined }, arena);
    expect(r.ok).toBe(false);
  });
  it('rejeita conflito com booking existente (via validateBookingRequest)', () => {
    const existing = [{ id: 'b1', status: 'confirmed', court_id: 'c1', date: '2030-08-15', start: '11:00', end: '13:00' }];
    const r = canBeInstantBooking(validInput, arena, existing);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('conflict');
  });
  it('rejeita fora de schedule (sem schedule configurado, mas tem regras)', () => {
    // Sem schedules e sem bookings = permitido (fallback permissivo)
    // Mas se arena tem schedule E slot fora = not ok
    const a = { ...arena, court_schedules: [{ weekdays: [5], start_time: '08:00', end_time: '12:00' }] };
    const r = canBeInstantBooking({ ...validInput, date: '2030-08-12' /* terça */ }, a, [], a.court_schedules);
    // 12 ago 2030 é terça; schedule é sexta; slot fora → outside_schedule
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('outside_schedule');
  });
  it('aceita todos os payment methods válidos', () => {
    for (const pm of Object.values(PAYMENT_METHOD)) {
      const r = canBeInstantBooking({ ...validInput, payment_method: pm }, arena);
      expect(r.ok).toBe(true);
    }
  });
});

describe('getInitialBookingStatus', () => {
  it('CONFIRMED se instant', () => {
    expect(getInitialBookingStatus(true)).toBe(BOOKING_STATUS.CONFIRMED);
  });
  it('REQUESTED se normal', () => {
    expect(getInitialBookingStatus(false)).toBe(BOOKING_STATUS.REQUESTED);
  });
  it('REQUESTED se undefined', () => {
    expect(getInitialBookingStatus(undefined)).toBe(BOOKING_STATUS.REQUESTED);
  });
});

describe('arenaSupportsInstant', () => {
  it('true se allow_instant_booking=true', () => {
    expect(arenaSupportsInstant({ allow_instant_booking: true })).toBe(true);
  });
  it('false se não setado', () => {
    expect(arenaSupportsInstant({})).toBe(false);
    expect(arenaSupportsInstant(null)).toBe(false);
    expect(arenaSupportsInstant({ allow_instant_booking: false })).toBe(false);
  });
});

describe('INSTANT_BOOKING_LABELS', () => {
  it('tem labels em pt-BR', () => {
    expect(INSTANT_BOOKING_LABELS.TITLE).toBeTruthy();
    expect(INSTANT_BOOKING_LABELS.REQUEST.title).toBeTruthy();
    expect(INSTANT_BOOKING_LABELS.INSTANT.title).toBeTruthy();
  });
});
