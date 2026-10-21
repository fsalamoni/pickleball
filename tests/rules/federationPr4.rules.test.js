/**
 * Regras das FEDERAÇÕES — PR 4: notícias, patrocinadores, cupons e campanhas
 * com a federação como emissora e a loja oficial no Mercado.
 *
 *  1. ⭐ notícia publicada e PÚBLICA: qualquer um lê (até sem conta); "só
 *     filiados": quem tem filiação ATIVA; rascunho: só a comunicação;
 *  2. ⭐ só comunicação/presidência escreve, só com o módulo `news`, e nunca
 *     `notified_at`/`notified_count` (o aviso é do servidor);
 *  3. ⭐ patrocinadores: lista curta, só a presidência (admin) grava;
 *  4. ⭐ cupom/campanha da federação: só a comunicação, só com `promos`;
 *  5. ⭐ loja oficial: admin/financeiro abre o vendedor `federation_{id}` com
 *     o módulo `store`; secretaria não.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const PRES = 'pres1';
const COM = 'com1';
const SEC = 'sec1';
const TES = 'tes1';
const ANA = 'ana1';
const BIA = 'bia1';
const FED = 'fedA';
const FED2 = 'fedB';

const federacao = (over = {}) => ({
  name: 'Federação Gaúcha de Pickleball', acronym: 'FGP', slug: 'fgp', level: 'state', state: 'RS',
  status: 'approved', created_by: PRES, modules: { news: true, sponsors: true, promos: true, store: true }, payment: {}, rules: {}, ...over,
});
const staff = (uid, role, fed = FED) => ({ federation_id: fed, user_id: uid, role, user_name: uid });
const noticia = (over = {}) => ({ federation_id: FED, title: 'Etapa estadual', body: 'Inscrições abertas até sexta.', status: 'published', audience: 'public', ...over });
const cupom = (over = {}) => ({ issuer_type: 'federation', issuer_id: FED, code: 'FGP10', kind: 'discount', type: 'percent', value: 10, active: true, ...over });
const vendedor = (uid, over = {}) => ({ seller_key: `federation_${FED}`, seller_type: 'federation', entity_id: FED, owner_uid: uid, status: 'active', display_name: 'Loja FGP', ...over });

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed4-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const anonimo = () => testEnv.unauthenticatedContext().firestore();

beforeEach(async () => {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { federations: true, marketplace: true } });
    await setDoc(doc(db, 'federations', FED), federacao());
    await setDoc(doc(db, 'federations', FED2), federacao({ slug: 'fed-b', acronym: 'FB', modules: {} }));
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), staff(PRES, 'president'));
    await setDoc(doc(db, 'federation_staff', `${FED}_${COM}`), staff(COM, 'communication'));
    await setDoc(doc(db, 'federation_staff', `${FED}_${SEC}`), staff(SEC, 'secretary'));
    await setDoc(doc(db, 'federation_staff', `${FED}_${TES}`), staff(TES, 'treasurer'));
    await setDoc(doc(db, 'federation_staff', `${FED2}_${COM}`), staff(COM, 'communication', FED2));
    await setDoc(doc(db, 'federation_members', `${FED}_${ANA}`), { federation_id: FED, user_id: ANA, status: 'active' });
    await setDoc(doc(db, 'federation_members', `${FED}_${BIA}`), { federation_id: FED, user_id: BIA, status: 'awaiting_payment' });
    await setDoc(doc(db, 'federation_news', 'pub'), noticia());
    await setDoc(doc(db, 'federation_news', 'mem'), noticia({ audience: 'members' }));
    await setDoc(doc(db, 'federation_news', 'rasc'), noticia({ status: 'draft' }));
  });
});

describe('1. leitura das notícias', () => {
  it('publicada e pública: qualquer um, até sem conta, e a consulta da página', async () => {
    await assertSucceeds(getDoc(doc(anonimo(), 'federation_news', 'pub')));
    await assertSucceeds(getDocs(query(collection(anonimo(), 'federation_news'), where('federation_id', '==', FED), where('audience', '==', 'public'), where('status', '==', 'published'))));
  });
  it('"só filiados": filiação ativa lê; pendente e sem conta não', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_news', 'mem')));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_news'), where('federation_id', '==', FED), where('audience', '==', 'members'), where('status', '==', 'published'))));
    await assertFails(getDoc(doc(como(BIA), 'federation_news', 'mem')));
    await assertFails(getDoc(doc(anonimo(), 'federation_news', 'mem')));
  });
  it('rascunho: só a comunicação e a presidência; a lista da Central é deles', async () => {
    await assertFails(getDoc(doc(como(ANA), 'federation_news', 'rasc')));
    await assertFails(getDoc(doc(como(SEC), 'federation_news', 'rasc')));
    await assertSucceeds(getDoc(doc(como(COM), 'federation_news', 'rasc')));
    await assertSucceeds(getDocs(query(collection(como(PRES), 'federation_news'), where('federation_id', '==', FED))));
  });
});

describe('2. escrita das notícias', () => {
  it('comunicação cria; secretaria e filiado não; sem o módulo, ninguém', async () => {
    await assertSucceeds(setDoc(doc(como(COM), 'federation_news', 'n1'), noticia()));
    await assertFails(setDoc(doc(como(SEC), 'federation_news', 'n2'), noticia()));
    await assertFails(setDoc(doc(como(ANA), 'federation_news', 'n3'), noticia()));
    await assertFails(setDoc(doc(como(COM), 'federation_news', 'n4'), noticia({ federation_id: FED2 })));
  });
  it('o aviso é do servidor: o cliente não grava notified_at/notified_count nem troca a federação', async () => {
    await assertFails(setDoc(doc(como(COM), 'federation_news', 'n5'), noticia({ notified_count: 10 })));
    await assertFails(updateDoc(doc(como(COM), 'federation_news', 'pub'), { notified_count: 10 }));
    await assertFails(updateDoc(doc(como(COM), 'federation_news', 'pub'), { federation_id: FED2 }));
    await assertSucceeds(updateDoc(doc(como(COM), 'federation_news', 'pub'), { title: 'Etapa estadual — novo prazo' }));
  });
});

describe('3. patrocinadores', () => {
  it('a presidência grava a lista curta; a comunicação não mexe na federação', async () => {
    const lista = [{ name: 'Marca X', tier: 'official' }];
    await assertSucceeds(updateDoc(doc(como(PRES), 'federations', FED), { sponsors: lista }));
    await assertFails(updateDoc(doc(como(PRES), 'federations', FED), { sponsors: Array.from({ length: 13 }, (_, i) => ({ name: `M${i}` })) }));
    await assertFails(updateDoc(doc(como(COM), 'federations', FED), { sponsors: lista }));
  });
});

describe('4. cupons e campanhas da federação', () => {
  it('a comunicação emite com o módulo `promos`; outro papel ou federação sem o módulo, não', async () => {
    await assertSucceeds(setDoc(doc(como(COM), 'promo_coupons', 'c1'), cupom()));
    await assertFails(setDoc(doc(como(SEC), 'promo_coupons', 'c2'), cupom()));
    await assertFails(setDoc(doc(como(COM), 'promo_coupons', 'c3'), cupom({ issuer_id: FED2 })));
    await assertSucceeds(setDoc(doc(como(COM), 'promo_campaigns', 'k1'), { issuer_type: 'federation', issuer_id: FED, title: 'Etapa' }));
  });
  it('o emissor não muda no update; as configurações privadas são da comunicação', async () => {
    await semRegras((db) => setDoc(doc(db, 'promo_coupons', 'c9'), cupom()));
    await assertFails(updateDoc(doc(como(COM), 'promo_coupons', 'c9'), { issuer_id: FED2 }));
    await assertSucceeds(setDoc(doc(como(COM), 'promo_settings', FED), { coupon_costs: {} }));
    await assertFails(getDoc(doc(como(SEC), 'promo_settings', FED)));
  });
});

describe('5. loja oficial no Mercado', () => {
  it('admin ou financeiro abre o vendedor da federação; secretaria não; sem `store`, ninguém', async () => {
    await assertSucceeds(setDoc(doc(como(TES), 'market_sellers', `federation_${FED}`), vendedor(TES)));
    await assertFails(setDoc(doc(como(SEC), 'market_sellers', `federation_${FED}`), vendedor(SEC)));
    await semRegras((db) => updateDoc(doc(db, 'federations', FED), { modules: { news: true } }));
    await assertFails(setDoc(doc(como(PRES), 'market_sellers', `federation_${FED}`), vendedor(PRES)));
  });
  it('a loja nasce ativa e não traz selo nem reputação', async () => {
    await assertFails(setDoc(doc(como(PRES), 'market_sellers', `federation_${FED}`), vendedor(PRES, { status: 'pending' })));
    await assertFails(setDoc(doc(como(PRES), 'market_sellers', `federation_${FED}`), vendedor(PRES, { verified: true })));
  });
});
