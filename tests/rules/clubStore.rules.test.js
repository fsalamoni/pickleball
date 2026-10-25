/**
 * Regras da LOJA do clube-associação no Mercado (`market_sellers/club_{id}`,
 * `market_listings` com `seller_key == club_{id}`, Bloco C3):
 *
 *  1. opera a loja a administração do clube e o cargo com `finance`; a
 *     comunicação, o associado comum e o estranho não;
 *  2. o vendedor só nasce com a flag do clube ligada E a página pública no ar;
 *  3. ninguém abre a loja de outro clube, nem com selo/avaliação de confiança;
 *  4. o anúncio é de quem opera; o Pix (`private/data`) é só dessa equipe.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const CLUBE = 'clubA';
const OUTRO = 'clubB';
const PRES = 'pres1';
const TES = 'tes1';
const COM = 'com1';
const MEMBRO = 'membro1';
const ZE = 'ze1';
const CHAVE = `club_${CLUBE}`;

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-club-store-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();

const vendedor = (uid, extra = {}) => ({ seller_key: CHAVE, seller_type: 'club', entity_id: CLUBE, owner_uid: uid, status: 'active', display_name: 'Loja do Clube A', ...extra });

async function semear({ flag = true, publicado = true, marketplace = true } = {}) {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { club_association: flag, marketplace } });
    await setDoc(doc(db, 'clubs', CLUBE), { name: 'Clube A', association: { enabled: true, published: publicado } });
    await setDoc(doc(db, 'clubs', OUTRO), { name: 'Clube B', association: { enabled: true, published: true } });
    await setDoc(doc(db, 'club_members', `${CLUBE}_${PRES}`), { club_id: CLUBE, user_id: PRES, role: 'admin' });
    await Promise.all([TES, COM, MEMBRO].map((u) => setDoc(doc(db, 'club_members', `${CLUBE}_${u}`), { club_id: CLUBE, user_id: u, role: 'member' })));
    await setDoc(doc(db, 'club_x', CLUBE, 'staff', TES), { user_id: TES, perms: ['finance'], term_end_ms: 0 });
    await setDoc(doc(db, 'club_x', CLUBE, 'staff', COM), { user_id: COM, perms: ['comms'], term_end_ms: 0 });
  });
}

describe('loja do clube no Mercado', () => {
  beforeEach(() => semear());

  it('1. a administração e o financeiro abrem a loja; comunicação, associado e estranho não', async () => {
    await assertSucceeds(setDoc(doc(como(PRES), 'market_sellers', CHAVE), vendedor(PRES)));
    await semear();
    await assertSucceeds(setDoc(doc(como(TES), 'market_sellers', CHAVE), vendedor(TES)));
    await assertFails(setDoc(doc(como(COM), 'market_sellers', CHAVE), vendedor(COM)));
    await assertFails(setDoc(doc(como(MEMBRO), 'market_sellers', CHAVE), vendedor(MEMBRO)));
    await assertFails(setDoc(doc(como(ZE), 'market_sellers', CHAVE), vendedor(ZE)));
  });

  it('2. página do clube fora do ar ou flag desligada: a loja não nasce', async () => {
    await semear({ publicado: false });
    await assertFails(setDoc(doc(como(PRES), 'market_sellers', CHAVE), vendedor(PRES)));
    await semear({ flag: false });
    await assertFails(setDoc(doc(como(PRES), 'market_sellers', CHAVE), vendedor(PRES)));
  });

  it('3. ⭐ nada de loja de outro clube, nem pendente, nem verificada', async () => {
    await assertFails(setDoc(doc(como(PRES), 'market_sellers', `club_${OUTRO}`), vendedor(PRES, { seller_key: `club_${OUTRO}`, entity_id: OUTRO })));
    await assertFails(setDoc(doc(como(PRES), 'market_sellers', CHAVE), vendedor(PRES, { status: 'pending' })));
    await assertFails(setDoc(doc(como(PRES), 'market_sellers', CHAVE), vendedor(PRES, { verified: true })));
    await assertFails(setDoc(doc(como(PRES), 'market_sellers', CHAVE), vendedor(PRES, { seller_type: 'arena' })));
  });

  it('4. quem opera edita a vitrine e o anúncio; o Pix é só da equipe', async () => {
    await semRegras(async (db) => {
      await setDoc(doc(db, 'market_sellers', CHAVE), vendedor(PRES));
      await setDoc(doc(db, 'market_sellers', CHAVE, 'private', 'data'), { pix_key: 'clube@pix.com' });
    });
    await assertSucceeds(updateDoc(doc(como(TES), 'market_sellers', CHAVE), { bio: 'Camisetas e bolas' }));
    await assertFails(updateDoc(doc(como(TES), 'market_sellers', CHAVE), { verified: true }));
    await assertFails(updateDoc(doc(como(COM), 'market_sellers', CHAVE), { bio: 'x' }));
    await assertSucceeds(getDoc(doc(como(TES), 'market_sellers', CHAVE, 'private', 'data')));
    await assertFails(getDoc(doc(como(COM), 'market_sellers', CHAVE, 'private', 'data')));
    await assertFails(getDoc(doc(como(MEMBRO), 'market_sellers', CHAVE, 'private', 'data')));
    await assertSucceeds(getDoc(doc(como(MEMBRO), 'market_sellers', CHAVE)));
  });

  it('5. perder o cargo (ou sair do clube) tira o poder sobre a loja', async () => {
    await semRegras(async (db) => {
      await setDoc(doc(db, 'market_sellers', CHAVE), vendedor(PRES));
      await setDoc(doc(db, 'club_x', CLUBE, 'staff', TES), { user_id: TES, perms: ['finance'], term_end_ms: 1 });
    });
    await assertFails(updateDoc(doc(como(TES), 'market_sellers', CHAVE), { bio: 'vencido' }));
  });
});
