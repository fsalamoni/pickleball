import { describe, it, expect } from 'vitest';
import {
  allocateGiftCards, couponBenefitLabel, couponConditionsLabel, couponDiscount, couponDocId, couponLive, couponProblem,
  giftCardAmountProblem, giftCardCode, giftCardConfig, giftCardProblem, maskGiftCardCode, normalizeCouponCode,
  normalizeGiftCardCode, orderPricing, sortGiftCardsForUse, validateCouponInput,
} from './promotions.js';

const itens = [
  { listing_id: 'a', unit_price_cents: 10000, quantity: 2 },
  { listing_id: 'b', unit_price_cents: 5000, quantity: 1 },
];
const cupom = (x = {}) => ({ seller_key: 'athlete_u1', code: 'PROMO10', kind: 'percent', value: 10, active: true, ...x });

describe('cupom', () => {
  it('código normalizado e id por vendedor', () => {
    expect(normalizeCouponCode(' promo-10 ')).toBe('PROMO10');
    expect(normalizeCouponCode('Verão!')).toBe('VERAO');
    expect(couponDocId('store_u1', 'abc 12')).toBe('store_u1_ABC12');
  });

  it('valida o formulário', () => {
    expect(validateCouponInput({ code: 'AB', kind: 'percent', value: 10 }).errors.code).toBeTruthy();
    expect(validateCouponInput({ code: 'ABC', kind: 'percent', value: 95 }).errors.value).toBeTruthy();
    expect(validateCouponInput({ code: 'ABC', kind: 'amount', value: 5000, min_subtotal_cents: 4000 }).errors.min_subtotal_cents).toBeTruthy();
    expect(validateCouponInput({ code: 'ABC', kind: 'percent', value: 10, starts_at_ms: 20, ends_at_ms: 10 }).errors.ends_at_ms).toBeTruthy();
    const ok = validateCouponInput({ code: 'frete', kind: 'free_shipping', value: 99, public: 1 });
    expect(ok.ok).toBe(true);
    expect(ok.value).toMatchObject({ code: 'FRETE', value: 0, public: true, active: true, max_uses: null });
  });

  it('rótulos', () => {
    expect(couponBenefitLabel(cupom())).toBe('10% de desconto');
    expect(couponBenefitLabel(cupom({ kind: 'free_shipping' }))).toBe('Frete grátis');
    expect(couponConditionsLabel(cupom({ once_per_buyer: true, max_uses: 10, uses_count: 7 }))).toBe('1 por pessoa · restam 3');
  });

  it('no ar: ativo, no prazo e com usos', () => {
    expect(couponLive(cupom(), 100)).toBe(true);
    expect(couponLive(cupom({ active: false }), 100)).toBe(false);
    expect(couponLive(cupom({ ends_at_ms: 50 }), 100)).toBe(false);
    expect(couponLive(cupom({ max_uses: 2, uses_count: 2 }), 100)).toBe(false);
  });

  it('diz POR QUE não vale', () => {
    const ctx = { sellerKey: 'athlete_u1', items: itens, fulfillment: 'meetup', now: 100 };
    expect(couponProblem(cupom(), ctx)).toBeNull();
    expect(couponProblem(cupom(), { ...ctx, sellerKey: 'outro' })).toMatch(/não existe/);
    expect(couponProblem(cupom({ starts_at_ms: 200 }), ctx)).toMatch(/começa/);
    expect(couponProblem(cupom({ once_per_buyer: true }), { ...ctx, buyerUses: 1 })).toMatch(/já usou/);
    expect(couponProblem(cupom({ first_purchase_only: true }), { ...ctx, hasBoughtBefore: true })).toMatch(/primeira/);
    expect(couponProblem(cupom({ min_subtotal_cents: 30000 }), ctx)).toMatch(/a partir de/);
    expect(couponProblem(cupom({ listing_ids: ['z'] }), ctx)).toMatch(/outros anúncios/);
    expect(couponProblem(cupom({ kind: 'free_shipping' }), ctx)).toMatch(/envio/);
    expect(couponProblem(cupom({ kind: 'free_shipping' }), { ...ctx, fulfillment: 'shipping', shippingToAgree: true })).toMatch(/combinar/);
  });

  it('desconto nunca passa dos itens em que vale', () => {
    expect(couponDiscount(cupom(), { items: itens })).toEqual({ discount_cents: 2500, shipping_discount_cents: 0 });
    expect(couponDiscount(cupom({ listing_ids: ['b'] }), { items: itens }).discount_cents).toBe(500);
    expect(couponDiscount(cupom({ kind: 'amount', value: 999999, listing_ids: ['b'] }), { items: itens }).discount_cents).toBe(5000);
    expect(couponDiscount(cupom({ kind: 'free_shipping' }), { items: itens, shippingCents: 1990 }).shipping_discount_cents).toBe(1990);
  });
});

describe('vale-presente', () => {
  it('configuração com padrões e valores válidos', () => {
    expect(giftCardConfig({}).enabled).toBe(false);
    const c = giftCardConfig({ gift_cards: { enabled: true, amounts_cents: [20000, 500, 5000, 5000], validity_months: 7 } });
    expect(c.amounts_cents).toEqual([5000, 20000]);
    expect(c.validity_months).toBe(12);
  });

  it('valor vendável', () => {
    const c = giftCardConfig({ gift_cards: { enabled: true, amounts_cents: [5000] } });
    expect(giftCardAmountProblem(c, 5000)).toBeNull();
    expect(giftCardAmountProblem(c, 7000)).toMatch(/valores da loja/);
    expect(giftCardAmountProblem({ ...c, allow_custom: true }, 7000)).toBeNull();
    expect(giftCardAmountProblem({ ...c, allow_custom: true }, 100)).toMatch(/entre/);
    expect(giftCardAmountProblem({ ...c, enabled: false }, 5000)).toMatch(/não vende/);
  });

  it('serve só na loja, para quem tem, no prazo e com saldo', () => {
    const v = { seller_key: 's', holder_uid: 'u', status: 'active', balance_cents: 100, expires_at_ms: 1000 };
    const ctx = { sellerKey: 's', uid: 'u', now: 10 };
    expect(giftCardProblem(v, ctx)).toBeNull();
    expect(giftCardProblem(v, { ...ctx, sellerKey: 'x' })).toMatch(/outra loja/);
    expect(giftCardProblem(v, { ...ctx, uid: 'x' })).toMatch(/Resgate/);
    expect(giftCardProblem({ ...v, status: 'cancelled' }, ctx)).toMatch(/cancelado/);
    expect(giftCardProblem(v, { ...ctx, now: 2000 })).toMatch(/venceu/);
    expect(giftCardProblem({ ...v, balance_cents: 0 }, ctx)).toMatch(/saldo/);
  });

  it('usa o que vence antes até cobrir o devido', () => {
    const cards = sortGiftCardsForUse([{ id: 'b', balance_cents: 3000 }, { id: 'a', balance_cents: 1000, expires_at_ms: 5 }]);
    expect(cards.map((c) => c.id)).toEqual(['a', 'b']);
    expect(allocateGiftCards(cards, 2500)).toEqual({ uses: [{ id: 'a', amount_cents: 1000 }, { id: 'b', amount_cents: 1500 }], total_cents: 2500 });
  });

  it('código: gerado, digitado de qualquer jeito, mascarado', () => {
    const code = giftCardCode(() => 0);
    expect(code).toBe('PRK-AAAA-AAAA-AAAA');
    expect(normalizeGiftCardCode('prk 7k2m9qxa ab23')).toBe('PRK-7K2M-9QXA-AB23');
    expect(normalizeGiftCardCode('123')).toBe('');
    expect(maskGiftCardCode('PRK-7K2M-9QXA-AB23')).toBe('···AB23');
  });
});

describe('preço do pedido', () => {
  it('subtotal − cupom + frete − vales, nunca negativo', () => {
    const p = orderPricing({ items: itens, shippingCents: 2000, coupon: cupom(), giftCards: [{ id: 'g', balance_cents: 50000 }] });
    expect(p).toMatchObject({ subtotal_cents: 25000, discount_cents: 2500, shipping_cents: 2000, gift_card_cents: 24500, total_cents: 0 });
    expect(p.gift_card_uses).toEqual([{ id: 'g', amount_cents: 24500 }]);
    const frete = orderPricing({ items: itens, shippingCents: 2000, coupon: cupom({ kind: 'free_shipping' }) });
    expect(frete.total_cents).toBe(25000);
  });
});
