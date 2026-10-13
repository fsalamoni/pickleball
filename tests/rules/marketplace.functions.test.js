/**
 * MERCADO — as funções do servidor contra o EMULADOR (transações de verdade).
 *
 * `functions/marketplace.js` roda com o Admin SDK, que ignora a regra; o que
 * protege o estoque e o preço é a transação. Teste com banco falso não prova
 * transação, então estes casos rodam no emulador:
 *
 *  1. ⭐ fechar o carrinho tira do estoque, usa o preço do BANCO e cria um
 *     pedido por vendedor; vendedor com problema não derruba o outro;
 *  2. ⭐ ninguém compra mais do que há, nem de si mesmo;
 *  3. ⭐ aceitar copia o Pix para o pedido e libera o endereço; sem Pix, não aceita;
 *  4. ⭐ cancelar e expirar devolvem o estoque;
 *  5. ⭐ oferta aceita vira pedido aceito pelo valor combinado;
 *  6. ⭐ a avaliação é cega até o outro lado avaliar, e a nota chega ao vendedor;
 *  7. termo proibido tira o anúncio do ar.
 */
import { createRequire } from 'node:module';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const require = createRequire(import.meta.url);
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const market = require('../../functions/marketplace.js');

const PROJECT = 'picklerush-market-fn';
const ANA = 'ana1'; // vende
const BIA = 'bia1'; // compra
const CAIO = 'caio1'; // vende também
const NOW = 1_800_000_000_000;

let testEnv;
let app;
let db;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({ projectId: PROJECT, firestore: { host: '127.0.0.1', port: 8080 } });
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  app = initializeApp({ projectId: PROJECT }, 'market-fn');
  db = getFirestore(app);
});
afterAll(async () => {
  await testEnv?.cleanup();
  if (app) await deleteApp(app);
});

const anuncio = (over = {}) => ({
  seller_key: `athlete_${ANA}`, seller_type: 'athlete', seller_name: 'Ana', created_by: ANA, seller_uid: ANA,
  title: 'Raquete Joola', price_cents: 80000, quantity: 2, quantity_sold: 0, status: 'active',
  fulfillment: ['meetup', 'shipping'], shipping_cents: 2500, accepts_offers: true, media: [], ...over,
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  const b = db.batch();
  b.set(db.doc('platform_settings/global'), { feature_flags: { marketplace: true } });
  b.set(db.doc(`users/${BIA}`), { platform_name: 'Bia' });
  b.set(db.doc(`market_sellers/athlete_${ANA}`), { seller_key: `athlete_${ANA}`, seller_type: 'athlete', display_name: 'Ana', status: 'active' });
  b.set(db.doc(`market_sellers/athlete_${ANA}/private/data`), { pix_key_type: 'email', pix_key: 'ana@x.com', receiver_name: 'Ana Souza' });
  b.set(db.doc(`market_sellers/athlete_${CAIO}`), { seller_key: `athlete_${CAIO}`, seller_type: 'athlete', display_name: 'Caio', status: 'active' });
  b.set(db.doc('market_listings/raq'), anuncio());
  b.set(db.doc('market_listings/bola'), anuncio({ title: 'Bolas Franklin', price_cents: 6000, quantity: 10 }));
  b.set(db.doc('market_listings/caio1'), anuncio({ seller_key: `athlete_${CAIO}`, seller_name: 'Caio', created_by: CAIO, seller_uid: CAIO, quantity: 1, status: 'paused' }));
  b.set(db.doc(`market_carts/${BIA}`), { items: [{ listing_id: 'raq', quantity: 1 }, { listing_id: 'outro', quantity: 1 }] });
  await b.commit();
});

const ctx = (over = {}) => ({ db, FieldValue, now: NOW, ...over });
const listing = async (id) => (await db.doc(`market_listings/${id}`).get()).data();
const order = async (id) => (await db.doc(`market_orders/${id}`).get()).data();

async function comprar(items, extra = {}) {
  return market.placeOrders(ctx(), BIA, {
    groups: [{ seller_key: `athlete_${ANA}`, fulfillment: 'meetup', items }],
    ...extra,
  });
}

describe('⭐ fechar o carrinho', () => {
  it('cria o pedido, tira do estoque e limpa o carrinho', async () => {
    const r = await comprar([{ listing_id: 'raq', quantity: 1 }, { listing_id: 'bola', quantity: 3 }]);
    expect(r.failures).toEqual([]);
    expect(r.orders).toHaveLength(1);
    const o = await order(r.orders[0].id);
    expect(o.status).toBe('placed');
    expect(o.total_cents).toBe(80000 + 3 * 6000);
    expect(o.buyer_name).toBe('Bia');
    expect(o.seller_manager_uids).toEqual([ANA]);
    expect(o.shipping_visible).toBe(false);
    expect((await listing('raq')).quantity).toBe(1);
    expect((await listing('bola')).quantity_sold).toBe(3);
    const cart = (await db.doc(`market_carts/${BIA}`).get()).data();
    expect(cart.items.map((i) => i.listing_id)).toEqual(['outro']);
    const avisos = await db.collection('notifications').where('user_id', '==', ANA).get();
    expect(avisos.docs[0].data().type).toBe('market');
  });

  it('a última unidade vira esgotado', async () => {
    await comprar([{ listing_id: 'raq', quantity: 2 }]);
    expect((await listing('raq')).status).toBe('sold_out');
  });

  it('⭐ não vende mais do que há, nem pelo preço velho', async () => {
    const r = await comprar([{ listing_id: 'raq', quantity: 3 }]);
    expect(r.orders).toEqual([]);
    expect(r.failures[0].error).toMatch(/só há 2/);
    const r2 = await comprar([{ listing_id: 'raq', quantity: 1, expected_price_cents: 70000 }]);
    expect(r2.failures[0].error).toMatch(/preço/);
    expect((await listing('raq')).quantity).toBe(2);
  });

  it('⭐ um vendedor com problema não derruba o outro', async () => {
    const r = await market.placeOrders(ctx(), BIA, {
      groups: [
        { seller_key: `athlete_${ANA}`, fulfillment: 'meetup', items: [{ listing_id: 'bola', quantity: 1 }] },
        { seller_key: `athlete_${CAIO}`, fulfillment: 'meetup', items: [{ listing_id: 'caio1', quantity: 1 }] },
      ],
    });
    expect(r.orders).toHaveLength(1);
    expect(r.failures[0].seller_key).toBe(`athlete_${CAIO}`);
  });

  it('⭐ ninguém compra de si mesmo', async () => {
    const r = await market.placeOrders(ctx(), ANA, { groups: [{ seller_key: `athlete_${ANA}`, fulfillment: 'meetup', items: [{ listing_id: 'raq', quantity: 1 }] }] });
    expect(r.failures[0].error).toMatch(/você mesmo/);
  });

  it('envio pede endereço e guarda no privado do pedido', async () => {
    const r = await market.placeOrders(ctx(), BIA, {
      groups: [{ seller_key: `athlete_${ANA}`, fulfillment: 'shipping', items: [{ listing_id: 'raq', quantity: 1 }] }],
      shipping: { name: 'Bia Lima', street: 'Rua B', number: '2', city: 'Recife', state: 'PE', cep: '50000000' },
    });
    const o = await order(r.orders[0].id);
    expect(o.shipping_cents).toBe(2500);
    const priv = (await db.doc(`market_orders/${r.orders[0].id}/private/shipping`).get()).data();
    expect(priv.address.city).toBe('Recife');
  });

  it('com a flag desligada, não compra', async () => {
    await db.doc('platform_settings/global').set({ feature_flags: {} });
    await expect(comprar([{ listing_id: 'raq', quantity: 1 }])).rejects.toThrow(/fechadas/);
  });
});

describe('⭐ a máquina do pedido', () => {
  async function pedido() {
    const r = await comprar([{ listing_id: 'raq', quantity: 1 }]);
    return r.orders[0].id;
  }

  it('aceitar copia o Pix e libera o endereço', async () => {
    const id = await pedido();
    await expect(market.orderAction(ctx(), { uid: BIA }, { orderId: id, action: 'accept' })).rejects.toThrow(/não pode/);
    await market.orderAction(ctx(), { uid: ANA }, { orderId: id, action: 'accept' });
    const o = await order(id);
    expect(o.status).toBe('accepted');
    expect(o.payment.pix_key).toBe('ana@x.com');
    expect(o.shipping_visible).toBe(true);
  });

  it('sem Pix cadastrado, não aceita', async () => {
    await db.doc(`market_sellers/athlete_${ANA}/private/data`).delete();
    const id = await pedido();
    await expect(market.orderAction(ctx(), { uid: ANA }, { orderId: id, action: 'accept' })).rejects.toThrow(/Pix/);
  });

  it('caminho feliz até concluir conta a venda', async () => {
    const id = await pedido();
    await market.orderAction(ctx(), { uid: ANA }, { orderId: id, action: 'accept' });
    await market.orderAction(ctx(), { uid: BIA }, { orderId: id, action: 'send_proof', proof_path: `mercado/${BIA}/pix.pdf` });
    await market.orderAction(ctx(), { uid: ANA }, { orderId: id, action: 'confirm_payment' });
    await market.orderAction(ctx(), { uid: ANA }, { orderId: id, action: 'ready' });
    await market.orderAction(ctx(), { uid: BIA }, { orderId: id, action: 'confirm_received' });
    expect((await order(id)).status).toBe('completed');
    expect((await db.doc(`market_sellers/athlete_${ANA}`).get()).data().sales_count).toBe(1);
    const eventos = await db.collection(`market_orders/${id}/events`).get();
    expect(eventos.size).toBe(6);
  });

  it('comprovante só da própria pasta', async () => {
    const id = await pedido();
    await market.orderAction(ctx(), { uid: ANA }, { orderId: id, action: 'accept' });
    await expect(market.orderAction(ctx(), { uid: BIA }, { orderId: id, action: 'send_proof', proof_path: `mercado/${ANA}/x.pdf` })).rejects.toThrow(/Comprovante/);
  });

  it('⭐ cancelar devolve o estoque; motivo é obrigatório', async () => {
    const id = await pedido();
    expect((await listing('raq')).quantity).toBe(1);
    await expect(market.orderAction(ctx(), { uid: BIA }, { orderId: id, action: 'cancel' })).rejects.toThrow(/motivo/);
    await market.orderAction(ctx(), { uid: BIA }, { orderId: id, action: 'cancel', reason: 'Desisti' });
    expect((await listing('raq')).quantity).toBe(2);
    expect((await order(id)).status).toBe('cancelled');
  });

  it('⭐ a rotina expira o pedido parado e devolve o estoque', async () => {
    const r = await comprar([{ listing_id: 'raq', quantity: 2 }]);
    expect((await listing('raq')).status).toBe('sold_out');
    const feitos = await market.housekeeping(ctx({ now: NOW + 73 * 3600000 }));
    expect(feitos.expired).toBe(1);
    expect((await order(r.orders[0].id)).status).toBe('expired');
    const l = await listing('raq');
    expect(l.quantity).toBe(2);
    expect(l.status).toBe('active');
  });

  it('disputa abre o registro para a moderação', async () => {
    const id = await pedido();
    await market.orderAction(ctx(), { uid: ANA }, { orderId: id, action: 'accept' });
    await market.orderAction(ctx(), { uid: ANA }, { orderId: id, action: 'confirm_payment' });
    await market.orderAction(ctx(), { uid: BIA }, { orderId: id, action: 'open_dispute', reason: 'Não recebi' });
    expect((await db.doc(`market_disputes/${id}`).get()).data().status).toBe('open');
    await expect(market.orderAction(ctx(), { uid: ANA }, { orderId: id, action: 'resolve_seller', reason: 'ok' })).rejects.toThrow(/não pode/);
    await market.orderAction(ctx(), { uid: 'adm', isPlatformAdmin: true }, { orderId: id, action: 'resolve_buyer', reason: 'Sem prova de envio' });
    expect((await order(id)).status).toBe('cancelled');
    expect((await listing('raq')).quantity).toBe(2);
  });
});

describe('⭐ a negociação', () => {
  it('oferta → contraproposta → aceite vira pedido pelo valor combinado', async () => {
    const { id } = await market.offerAction(ctx(), { uid: BIA }, { action: 'create', listingId: 'raq', amount_cents: 60000 });
    await expect(market.offerAction(ctx(), { uid: BIA }, { action: 'create', listingId: 'raq', amount_cents: 65000 })).rejects.toThrow(/aberta/);
    await market.offerAction(ctx(), { uid: ANA }, { offerId: id, action: 'counter', amount_cents: 70000 });
    const r = await market.offerAction(ctx(), { uid: BIA }, { offerId: id, action: 'accept_counter' });
    expect(r.status).toBe('ordered');
    const o = await order(r.orderId);
    expect(o.status).toBe('accepted');
    expect(o.total_cents).toBe(70000);
    expect(o.payment.pix_key).toBe('ana@x.com');
    expect((await listing('raq')).quantity).toBe(1);
  });

  it('não oferece no próprio anúncio nem acima do preço', async () => {
    await expect(market.offerAction(ctx(), { uid: ANA }, { action: 'create', listingId: 'raq', amount_cents: 60000 })).rejects.toThrow(/seu/);
    await expect(market.offerAction(ctx(), { uid: BIA }, { action: 'create', listingId: 'raq', amount_cents: 90000 })).rejects.toThrow(/menor/);
  });
});

describe('⭐ avaliação cega', () => {
  it('aparece quando os dois avaliam, e a nota chega ao vendedor', async () => {
    const r = await comprar([{ listing_id: 'raq', quantity: 1 }]);
    const id = r.orders[0].id;
    await expect(market.submitReview(ctx(), { uid: BIA }, { orderId: id, rating: 5 })).rejects.toThrow(/concluído/);
    await db.doc(`market_orders/${id}`).update({ status: 'completed' });
    const a = await market.submitReview(ctx(), { uid: BIA }, { orderId: id, rating: 4, comment: 'Ótima' });
    expect(a.visible).toBe(false);
    await expect(market.submitReview(ctx(), { uid: BIA }, { orderId: id, rating: 4 })).rejects.toThrow(/já avaliou/);
    const b = await market.submitReview(ctx(), { uid: ANA }, { orderId: id, rating: 5 });
    expect(b.visible).toBe(true);
    expect((await db.doc(`market_reviews/${id}_buyer`).get()).data().visible).toBe(true);
    const s = (await db.doc(`market_sellers/athlete_${ANA}`).get()).data();
    expect(s.rating_count).toBe(1);
    expect(s.rating_avg).toBe(4);
    expect((await listing('raq')).seller_rating_avg).toBe(4);
  });
});

describe('moderação automática', () => {
  it('termo proibido pausa o anúncio e avisa', async () => {
    const l = anuncio({ title: 'Raquete réplica perfeita' });
    await db.doc('market_listings/fake').set(l);
    expect(await market.moderateListing(ctx(), 'fake', l)).toMatch(/r.plica/);
    const salvo = await listing('fake');
    expect(salvo.status).toBe('paused');
    expect(salvo.moderation.auto).toBe(true);
    expect(await market.moderateListing(ctx(), 'raq', anuncio())).toBeNull();
  });
});
