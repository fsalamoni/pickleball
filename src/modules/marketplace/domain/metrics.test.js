import { describe, expect, it } from 'vitest';
import { marketMetrics, promoOverview } from './metrics.js';

const now = Date.UTC(2026, 9, 14);
const dia = 86400000;

describe('marketMetrics', () => {
  it('só o concluído conta como vendido', () => {
    const m = marketMetrics([
      { status: 'completed', total_cents: 10000, placed_at_ms: now - 2 * dia },
      { status: 'completed', total_cents: 5000, placed_at_ms: now - 60 * dia },
      { status: 'cancelled', total_cents: 9999 },
      { status: 'expired', total_cents: 1 },
      { status: 'paid', total_cents: 300 },
      { status: 'disputed', total_cents: 700 },
    ], { now });
    expect(m.completedCents).toBe(15000);
    expect(m.recentCompletedCents).toBe(10000);
    expect(m.recentCompletedCount).toBe(1);
    expect(m.activeCount).toBe(1);
    expect(m.disputedCount).toBe(1);
    expect(m.lostCount).toBe(2);
    expect(m.completionRate).toBe(0.5);
    expect(m.avgTicketCents).toBe(7500);
  });

  it('sem pedido decidido, a taxa é desconhecida (não zero)', () => {
    const m = marketMetrics([{ status: 'placed' }], { now });
    expect(m.completionRate).toBeNull();
    expect(m.avgTicketCents).toBeNull();
  });
});

describe('cupons e vales para o admin', () => {
  it('conta o que está no ar e o saldo que as lojas ainda devem', () => {
    const coupons = [
      { code: 'A', active: true, uses_count: 3 },
      { code: 'B', active: false, uses_count: 9 },
      { code: 'C', active: true, ends_at_ms: now - dia, uses_count: 1 },
      { code: 'D', active: true, max_uses: 2, uses_count: 2 },
    ];
    const cards = [
      { seller_key: 'x', seller_name: 'X', status: 'active', balance_cents: 5000, expires_at_ms: now + dia },
      { seller_key: 'x', seller_name: 'X', status: 'active', balance_cents: 1000 },
      { seller_key: 'y', seller_name: 'Y', status: 'active', balance_cents: 7000, expires_at_ms: now + dia },
      { seller_key: 'y', status: 'active', balance_cents: 2000, expires_at_ms: now - dia },
      { seller_key: 'y', status: 'used', balance_cents: 0 },
      { seller_key: 'y', status: 'cancelled', balance_cents: 900 },
    ];
    const m = promoOverview(coupons, cards, { now });
    expect(m.couponsActive).toBe(1);
    expect(m.couponUses).toBe(15);
    expect(m.topCoupons[0].code).toBe('B');
    expect(m.giftCardsActive).toBe(3);
    expect(m.openBalanceCents).toBe(13000);
    expect(m.expiredBalanceCents).toBe(2000);
    expect(m.giftCardsByStore.map((s) => [s.seller_key, s.balance_cents])).toEqual([['y', 7000], ['x', 6000]]);
  });

  it('sem nada, zero de verdade', () => {
    const m = promoOverview([], [], { now });
    expect(m.openBalanceCents).toBe(0);
    expect(m.giftCardsByStore).toEqual([]);
  });
});
