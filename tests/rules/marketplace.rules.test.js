/**
 * Regras do MERCADO (flag `marketplace`). Coleções novas `market_*`, aditivas.
 *
 *  1. ⭐ com a flag desligada ninguém cria vendedor, anúncio nem pergunta;
 *  2. ⭐ cada um vende só pela chave que opera (ele mesmo, a arena que gere,
 *     a própria loja); loja nasce "em análise" e só o admin aprova;
 *  3. ⭐ o anúncio não escreve vendas, reputação nem moderação; o removido
 *     pelo admin fica travado;
 *  4. ⭐ rascunho e pausado não aparecem para os outros;
 *  5. ⭐ pergunta pública, resposta só de quem vende;
 *  6. ⭐ pedido, oferta, avaliação e disputa: o navegador não escreve, e só as
 *     partes leem; o endereço só chega a quem vende depois do aceite;
 *  7. favorito, busca salva e carrinho são só do dono; Pix só do operador.
 *
 * (uids sem "_" de propósito: os do Firebase também não têm.)
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where,
} from 'firebase/firestore';

const ADMIN = 'admin1';
const ANA = 'ana1';
const BIA = 'bia1';
const PROF = 'prof1';
const GESTOR = 'gestor1';

const vendedor = (key, over = {}) => ({
  seller_key: key, seller_type: key.split('_')[0], entity_id: key.slice(key.indexOf('_') + 1),
  owner_uid: ANA, display_name: 'Ana Vende', status: 'active', ...over,
});
const anuncio = (over = {}) => ({
  seller_key: `athlete_${ANA}`, seller_type: 'athlete', seller_name: 'Ana Vende', created_by: ANA,
  title: 'Raquete Joola', description: 'Pouco uso', price_cents: 80000, quantity: 1,
  status: 'active', media: [], ...over,
});

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-market-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

async function semRegras(fn) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
}

beforeEach(async () => {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'users', ADMIN), { uid: ADMIN, role: 'platform_admin' });
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { marketplace: true } });
    await setDoc(doc(db, 'coaches', PROF), { uid: PROF, name: 'Prof' });
    await setDoc(doc(db, 'arena_managers', `arena1_${GESTOR}`), { arena_id: 'arena1', user_id: GESTOR });
    await setDoc(doc(db, 'market_sellers', `athlete_${ANA}`), vendedor(`athlete_${ANA}`));
    await setDoc(doc(db, 'market_listings', 'l1'), anuncio());
    await setDoc(doc(db, 'market_listings', 'rasc'), anuncio({ status: 'draft' }));
    await setDoc(doc(db, 'market_orders', 'o1'), {
      buyer_uid: BIA, seller_key: `athlete_${ANA}`, status: 'placed', shipping_visible: false,
    });
    await setDoc(doc(db, 'market_orders', 'o1', 'private', 'shipping'), { address: 'Rua A, 1' });
    await setDoc(doc(db, 'market_reviews', 'r1'), { author_uid: BIA, seller_key: `athlete_${ANA}`, visible: false, rating: 5 });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();

describe('⭐ a flag desligada fecha a porta', () => {
  it('sem a flag, ninguém cria vendedor nem anúncio', async () => {
    await semRegras((db) => setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: {} }));
    await assertFails(setDoc(doc(como(BIA), 'market_sellers', `athlete_${BIA}`), vendedor(`athlete_${BIA}`, { owner_uid: BIA })));
    await assertFails(setDoc(doc(como(ANA), 'market_listings', 'novo'), anuncio()));
  });
});

describe('⭐ vendedor: cada um pela chave que opera', () => {
  it('atleta cria o seu, não o de outra pessoa', async () => {
    await assertSucceeds(setDoc(doc(como(BIA), 'market_sellers', `athlete_${BIA}`), vendedor(`athlete_${BIA}`, { owner_uid: BIA })));
    await assertFails(setDoc(doc(como(BIA), 'market_sellers', `athlete_${PROF}`), vendedor(`athlete_${PROF}`, { owner_uid: BIA })));
  });
  it('não nasce verificado nem com vendas', async () => {
    await assertFails(setDoc(doc(como(BIA), 'market_sellers', `athlete_${BIA}`), vendedor(`athlete_${BIA}`, { owner_uid: BIA, verified: true })));
    await assertFails(setDoc(doc(como(BIA), 'market_sellers', `athlete_${BIA}`), vendedor(`athlete_${BIA}`, { owner_uid: BIA, sales_count: 50 })));
  });
  it('professor só com perfil de professor', async () => {
    await assertSucceeds(setDoc(doc(como(PROF), 'market_sellers', `coach_${PROF}`), vendedor(`coach_${PROF}`, { owner_uid: PROF })));
    await assertFails(setDoc(doc(como(BIA), 'market_sellers', `coach_${BIA}`), vendedor(`coach_${BIA}`, { owner_uid: BIA })));
  });
  it('arena só por quem a gere', async () => {
    await assertSucceeds(setDoc(doc(como(GESTOR), 'market_sellers', 'arena_arena1'), vendedor('arena_arena1', { owner_uid: GESTOR })));
    await assertFails(setDoc(doc(como(BIA), 'market_sellers', 'arena_arena1'), vendedor('arena_arena1', { owner_uid: BIA })));
  });
  it('⭐ loja nasce em análise; só o admin aprova', async () => {
    await assertFails(setDoc(doc(como(BIA), 'market_sellers', `store_${BIA}`), vendedor(`store_${BIA}`, { owner_uid: BIA, status: 'active' })));
    await assertSucceeds(setDoc(doc(como(BIA), 'market_sellers', `store_${BIA}`), vendedor(`store_${BIA}`, { owner_uid: BIA, status: 'pending' })));
    await assertFails(updateDoc(doc(como(BIA), 'market_sellers', `store_${BIA}`), { status: 'active' }));
    await assertSucceeds(updateDoc(doc(como(ADMIN), 'market_sellers', `store_${BIA}`), { status: 'active', verified: true }));
    await assertSucceeds(updateDoc(doc(como(BIA), 'market_sellers', `store_${BIA}`), { display_name: 'Loja da Bia' }));
  });
  it('loja recusada pode pedir de novo', async () => {
    await semRegras((db) => setDoc(doc(db, 'market_sellers', `store_${BIA}`), vendedor(`store_${BIA}`, { owner_uid: BIA, status: 'rejected', reject_reason: 'CNPJ' })));
    await assertSucceeds(updateDoc(doc(como(BIA), 'market_sellers', `store_${BIA}`), { status: 'pending', reject_reason: '' }));
  });
  it('a vitrine se edita; vendas e status não', async () => {
    await assertSucceeds(updateDoc(doc(como(ANA), 'market_sellers', `athlete_${ANA}`), { bio: 'Olá' }));
    await assertFails(updateDoc(doc(como(ANA), 'market_sellers', `athlete_${ANA}`), { sales_count: 99 }));
    await assertFails(updateDoc(doc(como(ANA), 'market_sellers', `athlete_${ANA}`), { status: 'suspended' }));
  });
  it('Pix só para o operador e o admin', async () => {
    const pix = { pix_key_type: 'email', pix_key: 'ana@x.com' };
    await assertSucceeds(setDoc(doc(como(ANA), 'market_sellers', `athlete_${ANA}`, 'private', 'data'), pix));
    await assertFails(getDoc(doc(como(BIA), 'market_sellers', `athlete_${ANA}`, 'private', 'data')));
    await assertSucceeds(getDoc(doc(como(ADMIN), 'market_sellers', `athlete_${ANA}`, 'private', 'data')));
  });
});

describe('⭐ anúncio', () => {
  it('cria pela sua chave, com o nome do vendedor', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'market_listings', 'n1'), anuncio()));
    await assertFails(setDoc(doc(como(ANA), 'market_listings', 'n2'), anuncio({ seller_name: 'Loja Oficial Joola' })));
    await assertFails(setDoc(doc(como(BIA), 'market_listings', 'n3'), anuncio({ created_by: BIA })));
  });
  it('não escreve vendas, reputação nem moderação', async () => {
    await assertFails(setDoc(doc(como(ANA), 'market_listings', 'n4'), anuncio({ quantity_sold: 10 })));
    await assertFails(updateDoc(doc(como(ANA), 'market_listings', 'l1'), { seller_rating_avg: 5 }));
    await assertFails(updateDoc(doc(como(ANA), 'market_listings', 'l1'), { status: 'removed' }));
    await assertSucceeds(updateDoc(doc(como(ANA), 'market_listings', 'l1'), { price_cents: 75000, status: 'paused' }));
  });
  it('preço precisa ser inteiro e positivo', async () => {
    await assertFails(setDoc(doc(como(ANA), 'market_listings', 'n5'), anuncio({ price_cents: 0 })));
    await assertFails(setDoc(doc(como(ANA), 'market_listings', 'n6'), anuncio({ price_cents: 10.5 })));
  });
  it('⭐ removido pelo admin fica travado para o vendedor', async () => {
    await assertSucceeds(updateDoc(doc(como(ADMIN), 'market_listings', 'l1'), { status: 'removed', moderation: { reason: 'réplica' } }));
    await assertFails(updateDoc(doc(como(ANA), 'market_listings', 'l1'), { status: 'active' }));
  });
  it('⭐ rascunho só para quem vende', async () => {
    await assertFails(getDoc(doc(como(BIA), 'market_listings', 'rasc')));
    await assertSucceeds(getDoc(doc(como(ANA), 'market_listings', 'rasc')));
    await assertSucceeds(getDoc(doc(como(BIA), 'market_listings', 'l1')));
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'market_listings', 'l1')));
  });
  it('a lista pública e a lista do vendedor são consultas que a regra prova', async () => {
    await assertSucceeds(getDocs(query(collection(como(BIA), 'market_listings'), where('status', 'in', ['active', 'sold_out']))));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'market_listings'), where('seller_key', '==', `athlete_${ANA}`))));
    await assertFails(getDocs(query(collection(como(BIA), 'market_listings'), where('seller_key', '==', `athlete_${ANA}`))));
  });
  it('⭐ vendedor suspenso não põe anúncio de volta no ar', async () => {
    await semRegras(async (db) => {
      await updateDoc(doc(db, 'market_sellers', `athlete_${ANA}`), { status: 'suspended' });
      await updateDoc(doc(db, 'market_listings', 'l1'), { status: 'paused', admin_paused: true });
    });
    await assertFails(updateDoc(doc(como(ANA), 'market_listings', 'l1'), { status: 'active' }));
    await assertSucceeds(updateDoc(doc(como(ANA), 'market_listings', 'l1'), { status: 'closed' }));
    await assertSucceeds(updateDoc(doc(como(ADMIN), 'market_listings', 'rasc'), { status: 'active' }));
  });
  it('apaga só o que nunca vendeu', async () => {
    await semRegras((db) => setDoc(doc(db, 'market_listings', 'vendido'), anuncio({ quantity_sold: 1 })));
    await assertFails(deleteDoc(doc(como(ANA), 'market_listings', 'vendido')));
    await assertSucceeds(deleteDoc(doc(como(ANA), 'market_listings', 'l1')));
  });
});

describe('⭐ perguntas', () => {
  const pergunta = (over = {}) => ({
    listing_id: 'l1', listing_title: 'Raquete', seller_key: `athlete_${ANA}`, asker_uid: BIA, asker_name: 'Bia',
    text: 'Tem nota fiscal?', status: 'open', ...over,
  });
  it('qualquer conta pergunta; quem vende não pergunta a si mesmo', async () => {
    await assertSucceeds(setDoc(doc(como(BIA), 'market_questions', 'q1'), pergunta()));
    await assertFails(setDoc(doc(como(ANA), 'market_questions', 'q2'), pergunta({ asker_uid: ANA })));
    await assertFails(setDoc(doc(como(BIA), 'market_questions', 'q3'), pergunta({ listing_id: 'rasc' })));
  });
  it('⭐ só quem vende responde, e só a resposta', async () => {
    await semRegras((db) => setDoc(doc(db, 'market_questions', 'q1'), pergunta()));
    const resp = { answer: 'Tem sim', status: 'answered', answered_by: ANA };
    await assertFails(updateDoc(doc(como(BIA), 'market_questions', 'q1'), resp));
    await assertFails(updateDoc(doc(como(ANA), 'market_questions', 'q1'), { ...resp, text: 'outra' }));
    await assertSucceeds(updateDoc(doc(como(ANA), 'market_questions', 'q1'), resp));
    await assertSucceeds(updateDoc(doc(como(ADMIN), 'market_questions', 'q1'), { status: 'hidden' }));
    await assertFails(getDocs(query(collection(como(PROF), 'market_questions'), where('listing_id', '==', 'l1'))));
    await assertSucceeds(getDocs(query(collection(como(PROF), 'market_questions'),
      where('listing_id', '==', 'l1'), where('status', 'in', ['open', 'answered']))));
  });
});

describe('⭐ o que só o servidor escreve', () => {
  it('pedido: o navegador não cria nem muda', async () => {
    await assertFails(setDoc(doc(como(BIA), 'market_orders', 'o2'), { buyer_uid: BIA, seller_key: `athlete_${ANA}`, status: 'paid' }));
    await assertFails(updateDoc(doc(como(ANA), 'market_orders', 'o1'), { status: 'completed' }));
    await assertFails(setDoc(doc(como(BIA), 'market_offers', 'of1'), { buyer_uid: BIA, seller_key: `athlete_${ANA}` }));
    await assertFails(setDoc(doc(como(BIA), 'market_reviews', 'r2'), { author_uid: BIA, visible: true }));
  });
  it('só as partes leem o pedido', async () => {
    await assertSucceeds(getDoc(doc(como(BIA), 'market_orders', 'o1')));
    await assertSucceeds(getDoc(doc(como(ANA), 'market_orders', 'o1')));
    await assertFails(getDoc(doc(como(PROF), 'market_orders', 'o1')));
    await assertSucceeds(getDocs(query(collection(como(BIA), 'market_orders'), where('buyer_uid', '==', BIA))));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'market_orders'), where('seller_key', '==', `athlete_${ANA}`))));
  });
  it('⭐ endereço: o vendedor só vê depois do aceite', async () => {
    await assertSucceeds(getDoc(doc(como(BIA), 'market_orders', 'o1', 'private', 'shipping')));
    await assertFails(getDoc(doc(como(ANA), 'market_orders', 'o1', 'private', 'shipping')));
    await semRegras((db) => updateDoc(doc(db, 'market_orders', 'o1'), { shipping_visible: true }));
    await assertSucceeds(getDoc(doc(como(ANA), 'market_orders', 'o1', 'private', 'shipping')));
  });
  it('⭐ avaliação cega: o vendedor não lê antes de revelar', async () => {
    await assertFails(getDoc(doc(como(ANA), 'market_reviews', 'r1')));
    await assertSucceeds(getDoc(doc(como(BIA), 'market_reviews', 'r1')));
    await assertSucceeds(getDocs(query(collection(como(PROF), 'market_reviews'), where('seller_key', '==', `athlete_${ANA}`), where('visible', '==', true))));
  });
});

describe('o que é só do dono', () => {
  it('favorito', async () => {
    await assertSucceeds(setDoc(doc(como(BIA), 'market_favorites', `${BIA}_l1`), { uid: BIA, listing_id: 'l1' }));
    await assertFails(setDoc(doc(como(BIA), 'market_favorites', `${ANA}_l1`), { uid: ANA, listing_id: 'l1' }));
    await assertSucceeds(getDoc(doc(como(BIA), 'market_favorites', `${BIA}_l9`)));
    await assertFails(getDoc(doc(como(ANA), 'market_favorites', `${BIA}_l1`)));
  });
  it('carrinho e busca salva', async () => {
    await assertSucceeds(setDoc(doc(como(BIA), 'market_carts', BIA), { items: [], saved: [] }));
    await assertFails(getDoc(doc(como(ANA), 'market_carts', BIA)));
    await assertSucceeds(setDoc(doc(como(BIA), 'market_saved_searches', 's1'), { uid: BIA, label: 'Raquetes', params: 'cat=raquetes' }));
    await assertFails(getDoc(doc(como(ANA), 'market_saved_searches', 's1')));
  });
});
