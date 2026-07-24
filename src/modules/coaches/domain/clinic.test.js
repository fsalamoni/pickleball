import { describe, it, expect } from 'vitest';
import {
  CLINIC_STATUS,
  clinicSignupDocId,
  normalizeClinic,
  spotsLeft,
  isClinicFull,
  isClinicPast,
  canEnroll,
  sortClinics,
  upcomingClinics,
  clinicWhenLabel,
} from './clinic.js';

const base = {
  coach_id: 'c1', coach_name: 'Ana', title: 'Clínica de dinks',
  date: '2999-08-12', start: '08:00', end: '10:00', capacity: 10, price: 50,
};

describe('clinic (domínio)', () => {
  it('monta id de inscrição', () => {
    expect(clinicSignupDocId('cl', 'a')).toBe('cl_a');
  });

  it('normaliza uma clínica válida', () => {
    const r = normalizeClinic(base);
    expect(r.valid).toBe(true);
    expect(r.value.status).toBe(CLINIC_STATUS.OPEN);
    expect(r.value.capacity).toBe(10);
    expect(r.value.price).toBe(50);
  });

  it('rejeita sem título/data/horário', () => {
    expect(normalizeClinic({ ...base, title: '' }).valid).toBe(false);
    expect(normalizeClinic({ ...base, date: 'x' }).valid).toBe(false);
    expect(normalizeClinic({ ...base, start: '25:00' }).valid).toBe(false);
    expect(normalizeClinic({ ...base, end: '08:00' }).valid).toBe(false);
  });

  it('exige capacidade mínima de 1', () => {
    expect(normalizeClinic({ ...base, capacity: 0 }).valid).toBe(false);
    expect(normalizeClinic({ ...base, capacity: 3 }).value.capacity).toBe(3);
  });

  it('preço negativo vira 0', () => {
    expect(normalizeClinic({ ...base, price: -5 }).value.price).toBe(0);
  });

  it('calcula vagas restantes e lotação', () => {
    const c = { capacity: 5 };
    expect(spotsLeft(c, 2)).toBe(3);
    expect(spotsLeft(c, 9)).toBe(0);
    expect(isClinicFull(c, 5)).toBe(true);
    expect(isClinicFull(c, 4)).toBe(false);
  });

  it('detecta clínica no passado', () => {
    expect(isClinicPast({ date: '2000-01-01', end: '10:00' })).toBe(true);
    expect(isClinicPast({ date: '2999-01-01', end: '10:00' })).toBe(false);
  });

  it('canEnroll cobre os casos', () => {
    const clinic = { ...normalizeClinic(base).value };
    expect(canEnroll({ clinic, signupCount: 0 }).ok).toBe(true);
    expect(canEnroll({ clinic, signupCount: 10 }).ok).toBe(false);
    expect(canEnroll({ clinic, alreadyEnrolled: true }).ok).toBe(false);
    expect(canEnroll({ clinic: { ...clinic, status: CLINIC_STATUS.CANCELLED } }).ok).toBe(false);
    expect(canEnroll({ clinic: { ...clinic, date: '2000-01-01' } }).ok).toBe(false);
  });

  it('ordena e filtra futuras', () => {
    const list = [
      { date: '2999-08-12', start: '10:00', end: '12:00', status: 'open' },
      { date: '2999-08-12', start: '08:00', end: '10:00', status: 'open' },
      { date: '2000-01-01', start: '08:00', end: '10:00', status: 'open' },
      { date: '2999-09-01', start: '08:00', end: '10:00', status: 'cancelled' },
    ];
    expect(sortClinics(list)[0].start).toBe('08:00');
    const up = upcomingClinics(list);
    expect(up.length).toBe(2);
    expect(up[0].start).toBe('08:00');
  });

  it('formata data/hora', () => {
    expect(clinicWhenLabel(base)).toBe('12/08 · 08:00–10:00');
    expect(clinicWhenLabel({})).toBe('');
  });
});
