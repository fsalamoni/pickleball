/**
 * PARIDADE cliente × servidor dos cupons e vales: a tela ESTIMA com
 * `promotions.js` e o servidor COBRA com `marketPromo.js`. Os dois têm de dar
 * o mesmo número e a mesma frase, senão o carrinho mostra um total e o
 * pedido sai com outro.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/marketplace/domain/promotions.js';

const require = createRequire(import.meta.url);
const s = require('./marketPromo.js');

const itens = [
  { listing_id: 'a', unit_price_cents: 10000, quantity: 2 },
  { listing_id: 'b', unit_price_cents: 5000, quantity: 3 },
];
const CUPONS = [
  { seller_key: 'k', kind: 'percent', value: 15 },
  { seller_key: 'k', kind: 'amount', value: 4000, min_subtotal_cents: 10000 },
  { seller_key: 'k', kind: 'amount', value: 99999, listing_ids: ['b'] },
  { seller_key: 'k', kind: 'free_shipping', value: 0 },
  { seller_key: 'k', kind: 'percent', value: 10, once_per_buyer: true, first_purchase_only: true, max_uses: 3, uses_count: 3 },
  { seller_key: 'k', kind: 'percent', value: 10, starts_at_ms: 500, ends_at_ms: 900, active: true },
  { seller_key: 'k', kind: 'percent', value: 10, active: false },
  { seller_key: 'outra', kind: 'percent', value: 10 },
];
const CTX = [
  { sellerKey: 'k', items: itens, fulfillment: 'shipping', now: 100 },
  { sellerKey: 'k', items: itens, fulfillment: 'meetup', now: 600, buyerUses: 1, hasBoughtBefore: true },
  { sellerKey: 'k', items: itens.slice(0, 1), fulfillment: 'shipping', shippingToAgree: true, now: 1000 },
];

describe('paridade: cupons e vales do Mercado', () => {
  it('as mesmas constantes', () => {
    ['COUPON_KIND', 'COUPON_LIMITS', 'GIFT_CARD_STATUS', 'GIFT_CARD_LIMITS', 'GIFT_CARD_VALIDITY_OPTIONS'].forEach((k) => {
      expect(JSON.parse(JSON.stringify(s[k])), k).toEqual(JSON.parse(JSON.stringify(c[k])));
    });
  });

  it('⭐ o mesmo veredito, o mesmo desconto e o mesmo total', () => {
    CUPONS.forEach((cp) => {
      expect(s.couponLive(cp, 600)).toBe(c.couponLive(cp, 600));
      expect(s.couponBenefitLabel(cp)).toBe(c.couponBenefitLabel(cp));
      expect(s.couponConditionsLabel(cp)).toBe(c.couponConditionsLabel(cp));
      CTX.forEach((ctx) => {
        expect(s.couponProblem(cp, ctx)).toBe(c.couponProblem(cp, ctx));
        const arg = { items: ctx.items, shippingCents: 1990, coupon: cp, giftCards: [{ id: 'g1', balance_cents: 3000 }, { id: 'g2', balance_cents: 900000 }] };
        expect(s.orderPricing(arg)).toEqual(c.orderPricing(arg));
      });
    });
  });

  it('a mesma validação de cupom e de vale', () => {
    [{ code: ' promo-10', kind: 'percent', value: '10' }, { code: 'x', kind: 'nada' }, { code: 'FRETE', kind: 'free_shipping', listing_ids: ['a', 'a', 3] }]
      .forEach((i) => expect(s.validateCouponInput(i)).toEqual(c.validateCouponInput(i)));
    [{}, { gift_cards: { enabled: true, amounts_cents: [100, 5000, 5000, 200000], allow_custom: true, validity_months: 24 } }].forEach((seller) => {
      const a = c.giftCardConfig(seller);
      expect(s.giftCardConfig(seller)).toEqual(a);
      [5000, 7000, 100, 600000].forEach((v) => expect(s.giftCardAmountProblem(a, v)).toBe(c.giftCardAmountProblem(a, v)));
    });
    const card = { seller_key: 'k', holder_uid: 'u', status: 'active', balance_cents: 10, expires_at_ms: 50 };
    [{ sellerKey: 'k', uid: 'u', now: 1 }, { sellerKey: 'x', uid: 'u', now: 1 }, { sellerKey: 'k', uid: 'u', now: 99 }]
      .forEach((ctx) => expect(s.giftCardProblem(card, ctx)).toBe(c.giftCardProblem(card, ctx)));
    ['prk7k2m9qxaab23', 'PRK-7K2M-9QXA-AB23', 'abc'].forEach((t) => expect(s.normalizeGiftCardCode(t)).toBe(c.normalizeGiftCardCode(t)));
    expect(s.couponDocId('k', 'abc-1')).toBe(c.couponDocId('k', 'abc-1'));
    expect(s.giftCardExpiry(0, 6)).toBe(c.giftCardExpiry(0, 6));
  });
});
