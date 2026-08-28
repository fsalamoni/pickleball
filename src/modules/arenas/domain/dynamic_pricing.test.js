import { describe, it, expect } from 'vitest';
import { applyDynamicPricing, normalizeDynamicConfig, dynamicPricingLabel } from './dynamic_pricing.js';

const config = {
  offpeak: { weekdays: [1, 2, 3, 4, 5], start: '08:00', end: '16:00', discount_pct: 20 },
  peak: { weekdays: [1, 2, 3, 4, 5], start: '18:00', end: '22:00', surcharge_pct: 30 },
};

describe('dynamic_pricing', () => {
  it('desconto na janela de baixa', () => {
    const r = applyDynamicPricing(100, { weekday: 2, minutes: 9 * 60, config });
    expect(r.kind).toBe('offpeak');
    expect(r.pct).toBe(20);
    expect(r.price).toBe(80);
  });

  it('sobretaxa na janela de pico', () => {
    const r = applyDynamicPricing(100, { weekday: 2, minutes: 19 * 60, config });
    expect(r.kind).toBe('peak');
    expect(r.price).toBe(130);
  });

  it('fora das janelas, preço não muda', () => {
    const r = applyDynamicPricing(100, { weekday: 2, minutes: 17 * 60, config });
    expect(r.kind).toBeNull();
    expect(r.price).toBe(100);
  });

  it('fim de semana fora dos weekdays não aplica', () => {
    const r = applyDynamicPricing(100, { weekday: 0, minutes: 9 * 60, config });
    expect(r.kind).toBeNull();
  });

  it('sem config → preço intacto', () => {
    expect(applyDynamicPricing(100, {}).price).toBe(100);
    expect(applyDynamicPricing(100, { config: { enabled: false, offpeak: config.offpeak } }).price).toBe(100);
  });

  it('normalizeDynamicConfig limita percentuais e weekdays', () => {
    const n = normalizeDynamicConfig({ offpeak: { weekdays: [1, 9, -1], start: '08:00', end: '16:00', discount_pct: 200 } });
    expect(n.offpeak.discount_pct).toBe(90);
    expect(n.offpeak.weekdays).toEqual([1]);
  });

  it('dynamicPricingLabel', () => {
    expect(dynamicPricingLabel('offpeak', 20)).toBe('Baixa −20%');
    expect(dynamicPricingLabel('peak', 30)).toBe('Pico +30%');
    expect(dynamicPricingLabel(null, 0)).toBeNull();
  });
});
