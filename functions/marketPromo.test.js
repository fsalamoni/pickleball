/**
 * Cupons e vale-presente no SERVIDOR, contra o Firestore falso: o pedido que
 * aplica o cupom e usa o vale, o cancelamento que devolve os dois, e o ciclo
 * do vale (comprar, pagar, emitir, resgatar, cancelar).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const m = require('./marketplace.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const SETTINGS = m.serverSettings(null);
const AGORA = Date.UTC(2026, 9, 14, 12);
const SK = 'athlete_vend';

function cenario(extra = {}) {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { marketplace: true } },
    'users/bia': { full_name: 'Bia Souza' },
    'users/caio': { full_name: 'Caio Lima' },
    [`market_sellers/${SK}`]: {
      seller_type: 'athlete', display_name: 'Loja do Vend', status: 'active', owner_uid: 'vend',
      gift_cards: { enabled: true, amounts_cents: [5000, 10000] },
    },
    [`market_sellers/${SK}/private/data`]: { pix_key: 'pix@v', pix_key_type: 'email' },
    'market_listings/L1': { seller_key: SK, title: 'Raquete', status: 'active', quantity: 5, price_cents: 20000, fulfillment: ['meetup', 'shipping'], shipping_cents: 2000 },
    [`market_coupons/${SK}_DEZ`]: { seller_key: SK, code: 'DEZ', kind: 'percent', value: 10, active: true, once_per_buyer: true, uses_count: 0 },
    ...extra,
  });
}
const ctx = (db, now = AGORA) => ({ db, FieldValue: FakeFieldValue, now, settings: SETTINGS });
const doc = (db, path) => db.store.docs.get(path);
const vales = (db) => [...db.store.docs.entries()].filter(([k]) => /^market_gift_cards\/[^/]+$/.test(k)).map(([k, v]) => ({ id: k.split('/')[1], ...v }));

async function pedir(db, g = {}) {
  const r = await m.placeOrders(ctx(db), 'bia', {
    groups: [{ seller_key: SK, fulfillment: 'meetup', items: [{ listing_id: 'L1', quantity: 1 }], ...g }],
  });
  return r;
}

describe('cupom no pedido', () => {
  it('aplica o desconto, conta o uso e recusa a segunda vez', async () => {
    const db = cenario();
    const r = await pedir(db, { coupon_code: 'dez' });
    expect(r.failures).toEqual([]);
    const o = doc(db, `market_orders/${r.orders[0].id}`);
    expect(o).toMatchObject({ subtotal_cents: 20000, discount_cents: 2000, total_cents: 18000 });
    expect(o.coupon).toMatchObject({ code: 'DEZ', discount_cents: 2000 });
    expect(doc(db, `market_coupons/${SK}_DEZ`).uses_count).toBe(1);
    expect(doc(db, `market_coupons/${SK}_DEZ/market_coupon_uses/bia`).count).toBe(1);
    const de_novo = await pedir(db, { coupon_code: 'DEZ' });
    expect(de_novo.orders).toEqual([]);
    expect(de_novo.failures[0].error || de_novo.failures[0].message).toMatch(/já usou/);
  });

  it('cancelar devolve o uso', async () => {
    const db = cenario();
    const r = await pedir(db, { coupon_code: 'DEZ' });
    await m.applyOrderAction(ctx(db), r.orders[0].id, 'cancel', 'buyer', 'bia', { reason: 'Desisti' });
    expect(doc(db, `market_coupons/${SK}_DEZ`).uses_count).toBe(0);
    expect(doc(db, `market_coupons/${SK}_DEZ/market_coupon_uses/bia`).count).toBe(0);
  });

  it('cupom inexistente não vira pedido com preço cheio calado', async () => {
    const db = cenario();
    const r = await pedir(db, { coupon_code: 'NAOEXISTE' });
    expect(r.orders).toEqual([]);
    expect(r.failures).toHaveLength(1);
  });
});

describe('vale-presente', () => {
  it('comprar → pagar → o vale nasce para quem comprou, a dar', async () => {
    const db = cenario();
    const r = await m.giftCardAction(ctx(db), { uid: 'bia' }, { action: 'buy', seller_key: SK, amount_cents: 5000, recipient_name: 'Caio', message: 'Parabéns!' });
    const o = doc(db, `market_orders/${r.id}`);
    expect(o).toMatchObject({ source: 'gift_card', fulfillment: 'digital', status: 'accepted', total_cents: 5000 });
    await expect(m.giftCardAction(ctx(db), { uid: 'bia' }, { action: 'buy', seller_key: SK, amount_cents: 7000 })).rejects.toThrow(/valores da loja/);
    await expect(m.giftCardAction(ctx(db), { uid: 'vend' }, { action: 'buy', seller_key: SK, amount_cents: 5000 })).rejects.toThrow(/você mesmo/);

    await m.applyOrderAction(ctx(db), r.id, 'confirm_payment', 'seller', 'vend');
    expect(doc(db, `market_orders/${r.id}`).status).toBe('delivered');
    const [v] = vales(db);
    expect(v).toMatchObject({ seller_key: SK, buyer_uid: 'bia', holder_uid: 'bia', balance_cents: 5000, recipient_name: 'Caio', status: 'active' });
    expect(v.claimed_at_ms).toBeUndefined();
    // comprar vale não conta como "já comprou" para cupom de primeira compra
    expect(await m.hasBoughtFrom(db, 'bia', SK)).toBe(false);
  });

  it('resgatar passa o vale; outra conta não toma de volta', async () => {
    const db = cenario({ 'market_gift_cards/g1': { code: 'PRK-AAAA-BBBB-CCCC', seller_key: SK, seller_name: 'Loja', balance_cents: 5000, initial_cents: 5000, status: 'active', buyer_uid: 'bia', holder_uid: 'bia' } });
    await expect(m.giftCardAction(ctx(db), { uid: 'caio' }, { action: 'claim', code: 'prk aaaa bbbb cccx' })).rejects.toThrow(/Não achamos/);
    const r = await m.giftCardAction(ctx(db), { uid: 'caio' }, { action: 'claim', code: 'prkaaaabbbbcccc' });
    expect(r).toMatchObject({ already: false, balance_cents: 5000 });
    expect(doc(db, 'market_gift_cards/g1')).toMatchObject({ holder_uid: 'caio', claimed_at_ms: AGORA });
    await expect(m.giftCardAction(ctx(db), { uid: 'bia' }, { action: 'claim', code: 'PRK-AAAA-BBBB-CCCC' })).rejects.toThrow(/outra conta/);
  });

  it('usar o vale no pedido abate o saldo; cancelar devolve', async () => {
    const db = cenario({ 'market_gift_cards/g1': { code: 'PRK-AAAA-BBBB-CCCC', seller_key: SK, balance_cents: 5000, initial_cents: 5000, status: 'active', buyer_uid: 'x', holder_uid: 'bia', claimed_at_ms: 1 } });
    const r = await pedir(db, { gift_card_ids: ['g1'] });
    expect(r.failures).toEqual([]);
    const o = doc(db, `market_orders/${r.orders[0].id}`);
    expect(o).toMatchObject({ gift_card_cents: 5000, total_cents: 15000 });
    expect(doc(db, 'market_gift_cards/g1')).toMatchObject({ balance_cents: 0, status: 'used' });
    await m.applyOrderAction(ctx(db), r.orders[0].id, 'cancel', 'buyer', 'bia', { reason: 'Desisti' });
    expect(doc(db, 'market_gift_cards/g1')).toMatchObject({ balance_cents: 5000, status: 'active' });
  });

  it('vale de outra pessoa ou de outra loja não entra', async () => {
    const db = cenario({ 'market_gift_cards/g1': { code: 'PRK-AAAA-BBBB-CCCC', seller_key: 'store_outra', balance_cents: 5000, status: 'active', holder_uid: 'bia' } });
    const r = await pedir(db, { gift_card_ids: ['g1'] });
    expect(r.orders).toEqual([]);
  });

  it('emitir é só da loja; cancelar pede motivo e só a loja cancela', async () => {
    const db = cenario();
    await expect(m.giftCardAction(ctx(db), { uid: 'bia' }, { action: 'issue', seller_key: SK, amount_cents: 5000 })).rejects.toThrow();
    const e = await m.giftCardAction(ctx(db), { uid: 'vend' }, { action: 'issue', seller_key: SK, amount_cents: 3000, recipient_name: 'Caio' });
    expect(e.code).toMatch(/^PRK-/);
    expect(doc(db, `market_gift_cards/${e.id}`)).toMatchObject({ source: 'issued', holder_uid: null, balance_cents: 3000 });
    await expect(m.giftCardAction(ctx(db), { uid: 'bia' }, { action: 'cancel', id: e.id, reason: 'x' })).rejects.toThrow();
    await m.giftCardAction(ctx(db), { uid: 'vend' }, { action: 'cancel', id: e.id, reason: 'Emitido por engano' });
    expect(doc(db, `market_gift_cards/${e.id}`).status).toBe('cancelled');
  });
});
