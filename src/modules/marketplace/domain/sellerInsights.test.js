import { describe, expect, it } from 'vitest';
import { salesCsv, sellerMetrics, topSellingItems } from './sellerInsights.js';

const NOW = Date.UTC(2026, 9, 14, 12);
const D = 86400000;
const o = (x) => ({ placed_at_ms: NOW - D, total_cents: 10000, items: [{ listing_id: 'a', title: 'Raquete', quantity: 1, unit_price_cents: 10000 }], ...x });

describe('sellerMetrics', () => {
  it('conta só a janela e calcula taxa e ticket', () => {
    const m = sellerMetrics([
      o({ status: 'completed' }), o({ status: 'paid', total_cents: 5000, gift_card_cents: 5000 }),
      o({ status: 'cancelled' }), o({ status: 'placed' }), o({ status: 'completed', placed_at_ms: NOW - 40 * D }),
    ], { now: NOW });
    expect(m.orders).toBe(4);
    expect(m.sold).toBe(2);
    expect(m.revenue_cents).toBe(20000);
    expect(m.avg_ticket_cents).toBe(10000);
    expect(m.completion_rate).toBeCloseTo(2 / 3);
  });
  it('sem nada decidido, a taxa é desconhecida (não 0%)', () => {
    expect(sellerMetrics([o({ status: 'placed' })], { now: NOW }).completion_rate).toBeNull();
  });
});

describe('topSellingItems', () => {
  it('soma por anúncio e ordena pela receita', () => {
    const t = topSellingItems([o({ status: 'completed' }), o({ status: 'paid', items: [{ listing_id: 'b', title: 'Bola', quantity: 3, unit_price_cents: 2000 }] })], { now: NOW });
    expect(t.map((x) => x.title)).toEqual(['Raquete', 'Bola']);
  });
});

describe('salesCsv', () => {
  it('usa ; e escapa fórmula e aspas', () => {
    const csv = salesCsv([o({ code: 'M1', status: 'completed', buyer_name: '=HYPERLINK("x")' })]);
    expect(csv.startsWith('﻿Pedido;')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('100,00');
  });
});
