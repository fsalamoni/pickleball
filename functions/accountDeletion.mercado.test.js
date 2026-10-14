/**
 * Exclusão de cadastro — o MERCADO, com as especificações reais, contra o
 * Firestore falso. Protege: o carrinho, os favoritos, as buscas, o Pix e o
 * endereço somem; os pedidos, as ofertas, as perguntas e as avaliações
 * ficam sem o nome; a loja sai do ar; pedido em andamento IMPEDE; nada de
 * outra pessoa (nem a ficha da arena que ela gere) some.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { analyzeAccount, executeAccountDeletion, STORAGE_PREFIXES } = require('../functions/accountDeletion.js');
const { createFakeDb, createFakeAuth, createFakeBucket, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const HOJE = '2026-10-13';
const ADMIN = { uid: 'admin', name: 'Dono', email: 'dono@x.com' };

function cenario(extra = {}) {
  const db = createFakeDb({
    'users/ana': { uid: 'ana', full_name: 'Ana Souza' },
    'users/bia': { uid: 'bia', full_name: 'Bia Lima' },
    'market_sellers/athlete_ana': { seller_type: 'athlete', owner_uid: 'ana', display_name: 'Ana Souza', status: 'active' },
    'market_sellers/athlete_ana/private/data': { pix_key: 'ana@pix' },
    'market_sellers/arena_a1': { seller_type: 'arena', owner_uid: 'ana', display_name: 'Arena A', status: 'active' },
    'market_listings/l1': { seller_key: 'athlete_ana', seller_name: 'Ana Souza', status: 'active', title: 'Raquete' },
    'market_listings/l2': { seller_key: 'arena_a1', seller_name: 'Arena A', status: 'active', title: 'Bola' },
    'market_orders/o1': { buyer_uid: 'bia', buyer_name: 'Bia Lima', seller_key: 'athlete_ana', seller_name: 'Ana Souza', status: 'completed' },
    'market_orders/o1/private/shipping': { street: 'Rua da Bia' },
    'market_orders/o2': { buyer_uid: 'ana', buyer_name: 'Ana Souza', seller_key: 'arena_a1', seller_name: 'Arena A', status: 'cancelled' },
    'market_orders/o2/private/shipping': { street: 'Rua da Ana' },
    'market_offers/f1': { buyer_uid: 'ana', buyer_name: 'Ana Souza', status: 'declined' },
    'market_questions/q1': { asker_uid: 'ana', asker_name: 'Ana Souza', text: 'Tem nota?' },
    'market_reviews/o1_buyer': { author_uid: 'bia', author_name: 'Bia Lima', rating: 5 },
    'market_reviews/o2_buyer': { author_uid: 'ana', author_name: 'Ana Souza', rating: 4 },
    'market_carts/ana': { items: [] },
    'market_carts/bia': { items: [] },
    'market_favorites/ana_l2': { uid: 'ana', listing_id: 'l2' },
    'market_favorites/bia_l1': { uid: 'bia', listing_id: 'l1' },
    'market_saved_searches/s1': { uid: 'ana', label: 'raquete' },
    'market_disputes/o2': { buyer_uid: 'ana', status: 'resolved' },
    'market_coupons/athlete_ana_DEZ': { seller_key: 'athlete_ana', code: 'DEZ' },
    'market_coupons/arena_a1_DEZ': { seller_key: 'arena_a1', code: 'DEZ' },
    'market_gift_cards/g1': { seller_key: 'arena_a1', buyer_uid: 'ana', holder_uid: 'bia', recipient_name: 'Bia', from_name: 'Ana', message: 'Oi', balance_cents: 5000 },
    'market_gift_cards/g2': { seller_key: 'arena_a1', buyer_uid: 'bia', holder_uid: 'bia', recipient_name: 'Bia', from_name: 'Bia', message: '', balance_cents: 5000 },
    ...extra,
  });
  const auth = createFakeAuth(['ana', 'bia'], { log: db.store.log });
  const bucket = createFakeBucket(['mercado/ana/a.webp', 'mercado/bia/b.webp']);
  return { db, ctx: { db, auth, bucket } };
}

const executar = (ctx) => executeAccountDeletion(ctx, 'ana', {
  actor: ADMIN, reason: 'pedido da titular', hojeISO: HOJE, FieldValue: FakeFieldValue,
});

describe('exclusão de conta: o Mercado', () => {
  it('a pasta mercado/ do Storage entra', () => {
    expect(STORAGE_PREFIXES.map((f) => f('u'))).toContain('mercado/u/');
  });

  it('⭐ pedido em andamento (comprando ou vendendo) impede', async () => {
    for (const extra of [
      { 'market_orders/o3': { buyer_uid: 'ana', seller_key: 'arena_x', status: 'paid' } },
      { 'market_orders/o3': { buyer_uid: 'bia', seller_key: 'athlete_ana', status: 'placed' } },
    ]) {
      const { ctx } = cenario(extra);
      // eslint-disable-next-line no-await-in-loop
      const { report } = await analyzeAccount(ctx, 'ana', { actorUid: 'admin', hojeISO: HOJE });
      expect(report.canDelete).toBe(false);
      expect(report.blockers.map((b) => b.label).join()).toMatch(/Mercado/);
    }
  });

  it('⭐ apaga exatamente o que é dela e tira o nome do resto', async () => {
    const { db, ctx } = cenario();
    const antes = new Set(db.store.docs.keys());
    const r = await executar(ctx);
    expect(r.status).toBe('deleted');
    const sumiram = [...antes].filter((p) => !db.store.docs.has(p)).sort();
    expect(sumiram).toEqual([
      'market_carts/ana',
      'market_coupons/athlete_ana_DEZ',
      'market_favorites/ana_l2',
      'market_orders/o2/private/shipping',
      'market_saved_searches/s1',
      'market_sellers/athlete_ana/private/data',
      'users/ana',
    ]);
    const g = (p) => db.store.docs.get(p);
    expect(g('market_sellers/athlete_ana')).toMatchObject({ display_name: 'Vendedor removido', status: 'suspended' });
    expect(g('market_listings/l1')).toMatchObject({ seller_name: 'Vendedor removido', status: 'closed' });
    expect(g('market_orders/o1').seller_name).toBe('Vendedor removido');
    expect(g('market_orders/o2').buyer_name).toBe('Usuário removido');
    expect(g('market_offers/f1').buyer_name).toBe('Usuário removido');
    expect(g('market_questions/q1').asker_name).toBe('Usuário removido');
    expect(g('market_reviews/o2_buyer').author_name).toBe('Usuário removido');
    // o que é da arena e de outras pessoas fica intacto
    expect(g('market_sellers/arena_a1').display_name).toBe('Arena A');
    expect(g('market_listings/l2')).toMatchObject({ seller_name: 'Arena A', status: 'active' });
    expect(g('market_orders/o1/private/shipping')).toBeTruthy();
    expect(g('market_reviews/o1_buyer').author_name).toBe('Bia Lima');
    // vale: o saldo fica, os nomes e o recado saem; o vale de outra pessoa fica intacto
    expect(g('market_gift_cards/g1')).toMatchObject({ recipient_name: '', from_name: '', message: '', balance_cents: 5000, holder_uid: 'bia' });
    expect(g('market_gift_cards/g2').from_name).toBe('Bia');
    expect(g('market_coupons/arena_a1_DEZ')).toBeTruthy();
  });
});
