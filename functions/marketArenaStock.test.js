/**
 * O estoque ÚNICO da arena no Mercado, contra o Firestore falso: ligar o
 * anúncio ao produto, o pedido que reserva, o pagamento que vira saída no
 * estoque da arena e o cancelamento que a desfaz.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const m = require('./marketplace.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const SETTINGS = m.serverSettings(null);

function cenario(prod = {}) {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { marketplace: true } },
    'arena_managers/m1': { arena_id: 'a1', user_id: 'gestor' },
    'market_sellers/arena_a1': { seller_type: 'arena', display_name: 'Arena A', status: 'active' },
    'market_sellers/arena_a1/private/data': { pix_key: 'pix@a', pix_key_type: 'email' },
    'market_listings/L1': {
      seller_key: 'arena_a1', title: 'Bola X', status: 'active', quantity: 50, price_cents: 2500, fulfillment: ['pickup'],
    },
    'arena_inventory_products/p1': { arena_id: 'a1', name: 'Bola X', stock_qty: 10, ...prod },
    'arena_inventory_products/pOutra': { arena_id: 'a2', name: 'Bola Y', stock_qty: 3 },
  });
}

const doc = (db, path) => db.store.docs.get(path);
const saidas = (db) => [...db.store.docs.entries()].filter(([k]) => k.startsWith('arena_inventory_exits/')).map(([, v]) => v);
const ctx = (db) => ({ db, FieldValue: FakeFieldValue, now: Date.UTC(2026, 9, 14, 2), settings: SETTINGS });

describe('regras puras', () => {
  it('reservado = pedidos abertos e não pagos, só do produto', () => {
    const it1 = { arena_product_id: 'p1', quantity: 2 };
    expect(m.reservedFor([
      { status: 'placed', items: [it1] },
      { status: 'payment_review', items: [it1, { arena_product_id: 'p9', quantity: 5 }] },
      { status: 'paid', items: [it1] },
      { status: 'cancelled', items: [it1] },
      { status: 'accepted', items: [{ listing_id: 'x', quantity: 7 }] },
    ], 'p1')).toBe(4);
  });
  it('anúncio acompanha estoque − reservado; sem controle de estoque, nada muda', () => {
    const src = { kind: 'arena_product', id: 'p1', tracked: true };
    expect(m.linkedListingPatch({ status: 'active', quantity: 50, source: src }, { stock_qty: 10 }, 3)).toEqual({ quantity: 7 });
    expect(m.linkedListingPatch({ status: 'active', quantity: 5, source: src }, { stock_qty: 2 }, 2)).toEqual({ quantity: 0, status: 'sold_out' });
    expect(m.linkedListingPatch({ status: 'sold_out', quantity: 0, source: src }, { stock_qty: 4 }, 0)).toEqual({ quantity: 4, status: 'active' });
    expect(m.linkedListingPatch({ status: 'paused', quantity: 1, source: src }, { stock_qty: 1 }, 0)).toEqual({});
    // Sem controle de estoque: a quantidade fica com quem vende, e a tela fica sabendo.
    expect(m.linkedListingPatch({ status: 'active', quantity: 3, source: src }, { stock_qty: null }, 0))
      .toEqual({ source: { ...src, tracked: false } });
    expect(m.linkedListingPatch({ status: 'active', quantity: 3, source: { ...src, tracked: false } }, { stock_qty: null }, 0)).toEqual({});
    expect(m.linkedListingPatch({ status: 'active', quantity: 3 }, null)).toEqual({ status: 'paused', source: null });
  });
});

describe('ligar o anúncio ao estoque', () => {
  it('só quem gere a arena, só produto da própria arena', async () => {
    const db = cenario();
    await expect(m.linkArenaProduct(ctx(db), { uid: 'estranho' }, { listingId: 'L1', productId: 'p1' })).rejects.toThrow(/gere a arena/);
    await expect(m.linkArenaProduct(ctx(db), { uid: 'gestor' }, { listingId: 'L1', productId: 'pOutra' })).rejects.toThrow(/não é do estoque/);
  });

  it('liga os dois lados e a quantidade passa a ser a do estoque', async () => {
    const db = cenario();
    await m.linkArenaProduct(ctx(db), { uid: 'gestor' }, { listingId: 'L1', productId: 'p1' });
    expect(doc(db, 'market_listings/L1').source).toEqual({ kind: 'arena_product', id: 'p1', tracked: true });
    expect(doc(db, 'arena_inventory_products/p1').market_listing_id).toBe('L1');
    expect(doc(db, 'market_listings/L1').quantity).toBe(10);
  });

  it('desligar limpa os dois lados', async () => {
    const db = cenario();
    await m.linkArenaProduct(ctx(db), { uid: 'gestor' }, { listingId: 'L1', productId: 'p1' });
    await m.linkArenaProduct(ctx(db), { uid: 'gestor' }, { listingId: 'L1', productId: null });
    expect(doc(db, 'market_listings/L1').source).toBe(null);
    expect(doc(db, 'arena_inventory_products/p1').market_listing_id).toBe(null);
  });

  it('o gatilho não confia só no produto: anúncio que não aponta de volta fica intocado', async () => {
    const db = cenario({ market_listing_id: 'L1' });
    expect(await m.syncArenaListing(ctx(db), 'p1', null, doc(db, 'arena_inventory_products/p1'))).toBe(null);
    expect(doc(db, 'market_listings/L1').quantity).toBe(50);
  });
});

describe('do pedido ao estoque da arena', () => {
  async function comprar(db) {
    await m.linkArenaProduct(ctx(db), { uid: 'gestor' }, { listingId: 'L1', productId: 'p1' });
    const r = await m.placeOrders(ctx(db), 'bia', {
      groups: [{ seller_key: 'arena_a1', fulfillment: 'pickup', items: [{ listing_id: 'L1', quantity: 3 }] }],
    });
    expect(r.failures).toEqual([]);
    return r.orders[0].id;
  }

  it('o pedido leva o produto; reservar não mexe no estoque da arena', async () => {
    const db = cenario();
    const id = await comprar(db);
    expect(doc(db, `market_orders/${id}`).items[0].arena_product_id).toBe('p1');
    expect(doc(db, 'market_listings/L1').quantity).toBe(7);
    expect(doc(db, 'arena_inventory_products/p1').stock_qty).toBe(10);
    // Se o produto mudar agora, o reservado continua descontado.
    expect(await m.syncArenaListing(ctx(db), 'p1', null, doc(db, 'arena_inventory_products/p1'))).toBe(null);
  });

  it('pagamento confirmado vira saída; cancelar depois devolve', async () => {
    const db = cenario();
    const id = await comprar(db);
    await m.applyOrderAction(ctx(db), id, 'accept', 'seller', 'gestor');
    await m.applyOrderAction(ctx(db), id, 'confirm_payment', 'seller', 'gestor');

    const [s] = saidas(db);
    expect(s).toMatchObject({
      product_id: 'p1', arena_id: 'a1', quantity: 3, exit_type: 'sale', unit_price: 25, total_price: 75,
      market_order_id: id, channel: 'mercado', date: '2026-10-13',
    });
    expect(s.buyer_name).toBeUndefined();
    expect(doc(db, 'arena_inventory_products/p1').stock_qty).toBe(7);
    expect(doc(db, `market_orders/${id}`).arena_stock_applied).toBe(true);
    // Estoque 7, nada reservado: o anúncio segue em 7, sem pular.
    expect(await m.syncArenaListing(ctx(db), 'p1', null, doc(db, 'arena_inventory_products/p1'))).toBe(null);

    await m.applyOrderAction(ctx(db), id, 'admin_cancel', 'admin', 'adm', { reason: 'Teste' });
    expect(saidas(db)).toEqual([]);
    expect(doc(db, 'arena_inventory_products/p1').stock_qty).toBe(10);
    expect(doc(db, 'market_listings/L1').quantity).toBe(10);
    expect(doc(db, `market_orders/${id}`).arena_stock_applied).toBe(false);
  });

  it('cancelar antes de pagar não toca no estoque da arena', async () => {
    const db = cenario();
    const id = await comprar(db);
    await m.applyOrderAction(ctx(db), id, 'cancel', 'buyer', 'bia', { reason: 'Desisti' });
    expect(saidas(db)).toEqual([]);
    expect(doc(db, 'arena_inventory_products/p1').stock_qty).toBe(10);
    expect(doc(db, 'market_listings/L1').quantity).toBe(10);
  });

  it('produto apagado tira o anúncio do ar', async () => {
    const db = cenario();
    await m.linkArenaProduct(ctx(db), { uid: 'gestor' }, { listingId: 'L1', productId: 'p1' });
    const antes = doc(db, 'arena_inventory_products/p1');
    await m.syncArenaListing(ctx(db), 'p1', antes, null);
    expect(doc(db, 'market_listings/L1')).toMatchObject({ status: 'paused', source: null });
  });
});
