import { describe, it, expect } from 'vitest';
import {
  MEMBER_TIER,
  MEMBER_STATUS,
  DEFAULT_TIERS,
  computeTier,
  addPoints,
  normalizeMemberInput,
  normalizePackageInput,
  isPackageValid,
  getPackageRemainingHours,
  consumePackageHours,
  calculateCashbackPct,
  calculateCashback,
} from './members.js';

describe('computeTier', () => {
  it('retorna tier baseado nos pontos', () => {
    expect(computeTier(0).id).toBe('bronze');
    expect(computeTier(99).id).toBe('bronze');
    expect(computeTier(100).id).toBe('silver');
    expect(computeTier(499).id).toBe('silver');
    expect(computeTier(500).id).toBe('gold');
    expect(computeTier(1500).id).toBe('platinum');
  });
  it('retorna bronze para pontos inválidos', () => {
    expect(computeTier(-1).id).toBe('bronze');
    expect(computeTier(NaN).id).toBe('bronze');
    expect(computeTier(null).id).toBe('bronze');
  });
});

describe('addPoints', () => {
  it('soma pontos e retorna tier', () => {
    const r = addPoints(0, 100);
    expect(r.points).toBe(100);
    expect(r.tier.id).toBe('silver');
  });
  it('incrementa a partir de pontos existentes', () => {
    const r = addPoints(450, 50);
    expect(r.points).toBe(500);
    expect(r.tier.id).toBe('gold');
  });
});

describe('normalizeMemberInput', () => {
  it('normaliza e preenche defaults', () => {
    const r = normalizeMemberInput({ user_id: 'u1', user_name: 'A' });
    expect(r.tier).toBe('bronze');
    expect(r.status).toBe('active');
    expect(r.points).toBe(0);
  });
  it('rejeita tier inválido', () => {
    const r = normalizeMemberInput({ user_id: 'u1', tier: 'foo' });
    expect(r.tier).toBe('bronze');
  });
});

describe('normalizePackageInput', () => {
  it('aceita pacote válido', () => {
    const r = normalizePackageInput({ name: 'Pacote 10h', hours: 10, price: 250 });
    expect(r.valid).toBe(true);
    expect(r.value.validity_days).toBe(60);
  });
  it('rejeita sem nome', () => {
    const r = normalizePackageInput({ name: '', hours: 10, price: 250 });
    expect(r.valid).toBe(false);
  });
  it('rejeita horas inválidas', () => {
    expect(normalizePackageInput({ name: 'X', hours: 0, price: 100 }).valid).toBe(false);
    expect(normalizePackageInput({ name: 'X', hours: 500, price: 100 }).valid).toBe(false);
  });
  it('rejeita preço inválido', () => {
    expect(normalizePackageInput({ name: 'X', hours: 10, price: 0 }).valid).toBe(false);
  });
  it('rejeita validade > 365', () => {
    expect(normalizePackageInput({ name: 'X', hours: 10, price: 100, validity_days: 500 }).valid).toBe(false);
  });
});

describe('isPackageValid', () => {
  const now = new Date('2026-07-15').getTime();
  it('true se expires > now', () => {
    const pkg = { expires_at: new Date('2026-08-15').getTime() };
    expect(isPackageValid(pkg, now)).toBe(true);
  });
  it('false se expirou', () => {
    const pkg = { expires_at: new Date('2026-07-01').getTime() };
    expect(isPackageValid(pkg, now)).toBe(false);
  });
  it('false se null', () => {
    expect(isPackageValid(null, now)).toBe(false);
  });
});

describe('getPackageRemainingHours', () => {
  it('calcula restante', () => {
    expect(getPackageRemainingHours({ total_hours: 10, used_hours: 3 })).toBe(7);
  });
  it('0 se não tem', () => {
    expect(getPackageRemainingHours(null)).toBe(0);
    expect(getPackageRemainingHours({})).toBe(0);
  });
});

describe('consumePackageHours', () => {
  it('consome e retorna', () => {
    const pkg = { total_hours: 10, used_hours: 3 };
    const r = consumePackageHours(pkg, 2);
    expect(r.used_hours).toBe(5);
  });
  it('não consome mais que disponível', () => {
    const pkg = { total_hours: 10, used_hours: 8 };
    const r = consumePackageHours(pkg, 5);
    expect(r.used_hours).toBe(10);  // só 2 disponíveis
  });
  it('null para pkg null', () => {
    expect(consumePackageHours(null, 1)).toBeNull();
  });
});

describe('calculateCashbackPct', () => {
  it('0% para valores baixos', () => {
    expect(calculateCashbackPct(0)).toBe(0);
    expect(calculateCashbackPct(50)).toBe(0);
  });
  it('escalonado', () => {
    expect(calculateCashbackPct(100)).toBe(1);
    expect(calculateCashbackPct(500)).toBe(3);
    expect(calculateCashbackPct(2000)).toBe(5);
    expect(calculateCashbackPct(5000)).toBe(7);
  });
});

describe('calculateCashback', () => {
  it('calcula valor', () => {
    expect(calculateCashback(100, 0)).toBe(0);
    expect(calculateCashback(100, 2000)).toBe(5);  // 5% de 100
    expect(calculateCashback(200, 2000)).toBe(10);
  });
});
