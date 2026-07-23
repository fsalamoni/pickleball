import { describe, it, expect } from 'vitest';
import {
  classifyNps, calculateNps, normalizeCouponInput, isCouponValid, applyCoupon,
  generateReferralCode, calculateLoyaltyPoints, CAMPAIGN_STATUS, COUPON_TYPE, NPS_SCORE,
} from './marketing.js';

describe('classifyNps', () => {
  it('classifica detractor (0-6)', () => {
    expect(classifyNps(0)).toBe('detractor');
    expect(classifyNps(6)).toBe('detractor');
  });
  it('classifica passive (7-8)', () => {
    expect(classifyNps(7)).toBe('passive');
    expect(classifyNps(8)).toBe('passive');
  });
  it('classifica promoter (9-10)', () => {
    expect(classifyNps(9)).toBe('promoter');
    expect(classifyNps(10)).toBe('promoter');
  });
  it('null para inválido', () => {
    expect(classifyNps(NaN)).toBeNull();
    expect(classifyNps(null)).toBeNull();
  });
});

describe('calculateNps', () => {
  it('NPS 100 para todos promoters', () => {
    expect(calculateNps([{ score: 10 }, { score: 9 }])).toBe(100);
  });
  it('NPS -100 para todos detractors', () => {
    expect(calculateNps([{ score: 0 }, { score: 3 }])).toBe(-100);
  });
  it('NPS 0 para mix equilibrado', () => {
    expect(calculateNps([{ score: 10 }, { score: 0 }])).toBe(0);
  });
  it('0 para vazio', () => {
    expect(calculateNps([])).toBe(0);
  });
});

describe('normalizeCouponInput', () => {
  it('aceita cupom percent válido', () => {
    const r = normalizeCouponInput({ code: 'verao10', type: 'percent', value: 10 });
    expect(r.valid).toBe(true);
    expect(r.value.code).toBe('VERAO10');
  });
  it('aceita cupom fixed', () => {
    const r = normalizeCouponInput({ code: 'desconto', type: 'fixed', value: 50 });
    expect(r.valid).toBe(true);
  });
  it('rejeita sem código', () => {
    expect(normalizeCouponInput({ value: 10 }).valid).toBe(false);
  });
  it('rejeita percent > 100', () => {
    expect(normalizeCouponInput({ code: 'X', type: 'percent', value: 150 }).valid).toBe(false);
  });
});

describe('isCouponValid', () => {
  it('true se ativo e não expirou', () => {
    const c = { active: true, used_count: 0 };
    expect(isCouponValid(c, Date.now())).toBe(true);
  });
  it('false se inativo', () => {
    expect(isCouponValid({ active: false }, Date.now())).toBe(false);
  });
  it('false se atingiu max_uses', () => {
    expect(isCouponValid({ active: true, used_count: 10, max_uses: 10 }, Date.now())).toBe(false);
  });
  it('false se expirou', () => {
    const yesterday = Date.now() - 86_400_000;
    expect(isCouponValid({ active: true, used_count: 0, expires_at: yesterday }, Date.now())).toBe(false);
  });
});

describe('applyCoupon', () => {
  it('aplica percent', () => {
    expect(applyCoupon(100, { active: true, type: 'percent', value: 10 })).toBe(90);
  });
  it('aplica fixed', () => {
    expect(applyCoupon(100, { active: true, type: 'fixed', value: 30 })).toBe(70);
  });
  it('não aplica se inválido', () => {
    expect(applyCoupon(100, null)).toBe(100);
    expect(applyCoupon(100, { active: false, type: 'percent', value: 10 })).toBe(100);
  });
});

describe('generateReferralCode', () => {
  it('gera código único', () => {
    const c1 = generateReferralCode('user123abc');
    const c2 = generateReferralCode('user456def');
    expect(c1).toBeTruthy();
    expect(c2).toBeTruthy();
    expect(c1).not.toBe(c2);
  });
});

describe('calculateLoyaltyPoints', () => {
  it('1 ponto por R$1', () => {
    expect(calculateLoyaltyPoints(100)).toBe(100);
    expect(calculateLoyaltyPoints(50.7)).toBe(50);
  });
  it('0 para inválido', () => {
    expect(calculateLoyaltyPoints(0)).toBe(0);
    expect(calculateLoyaltyPoints(-10)).toBe(0);
  });
});
