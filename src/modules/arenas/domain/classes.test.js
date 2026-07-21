import { describe, it, expect } from 'vitest';
import {
  COACH_LEVEL, CLASS_FORMAT, CLASS_STATUS,
  normalizeCoachInput, normalizeClassInput, calculateCommission,
} from './classes.js';

describe('normalizeCoachInput', () => {
  it('aceita coach válido', () => {
    const r = normalizeCoachInput({ name: 'João', level: 'pro', price_per_hour: 200 });
    expect(r.valid).toBe(true);
    expect(r.value.name).toBe('João');
    expect(r.value.level).toBe('pro');
  });
  it('rejeita sem nome', () => {
    expect(normalizeCoachInput({}).valid).toBe(false);
  });
  it('default intermediate', () => {
    const r = normalizeCoachInput({ name: 'X' });
    expect(r.value.level).toBe('intermediate');
  });
});

describe('normalizeClassInput', () => {
  it('aceita aula válida', () => {
    const r = normalizeClassInput({
      date: '2026-07-20', start: '19:00', end: '21:00',
      max_students: 6, price: 100, format: 'group',
    });
    expect(r.valid).toBe(true);
  });
  it('rejeita data inválida', () => {
    expect(normalizeClassInput({ date: 'xx', start: '19:00', end: '21:00' }).valid).toBe(false);
  });
  it('rejeita max_students fora do range', () => {
    expect(normalizeClassInput({ date: '2026-07-20', start: '19:00', end: '21:00', max_students: 0 }).valid).toBe(false);
    expect(normalizeClassInput({ date: '2026-07-20', start: '19:00', end: '21:00', max_students: 100 }).valid).toBe(false);
  });
});

describe('calculateCommission', () => {
  it('50%', () => {
    expect(calculateCommission(200, 50)).toBe(100);
  });
  it('0%', () => {
    expect(calculateCommission(200, 0)).toBe(0);
  });
  it('100%', () => {
    expect(calculateCommission(200, 100)).toBe(200);
  });
  it('rejeita pct inválido', () => {
    expect(calculateCommission(200, 150)).toBe(0);
  });
});
