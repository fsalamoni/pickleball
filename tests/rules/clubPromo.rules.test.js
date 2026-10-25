/**
 * Regras dos CUPONS e CAMPANHAS do clube-associação (`promo_coupons` e
 * `promo_campaigns` com `issuer_type == 'club'`, Bloco C2):
 *
 *  1. emite a comunicação (`comms`) e a administração do clube; a secretaria,
 *     o associado comum e o estranho não;
 *  2. só com a flag ligada E a página pública do clube no ar;
 *  3. ninguém emite em nome de outro clube, e o emissor não muda no update;
 *  4. `promo_settings/{clube}` (custo do vale, modelos) é só da equipe.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const CLUBE = 'clubA';
const OUTRO = 'clubB';
const PRES = 'pres1';
const COM = 'com1';
const SEC = 'sec1';
const MEMBRO = 'membro1';
const ZE = 'ze1';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-club-promo-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();

const cupom = (extra = {}) => ({ issuer_type: 'club', issuer_id: CLUBE, issuer_name: 'Clube A', name: 'Café', kind: 'discount', ...extra });
const campanha = (extra = {}) => ({ issuer_type: 'club', issuer_id: CLUBE, issuer_name: 'Clube A', name: 'Torneio de fim de ano', ...extra });

async function semear({ flag = true, publicado = true } = {}) {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { club_association: flag } });
    await setDoc(doc(db, 'clubs', CLUBE), { name: 'Clube A', association: { enabled: true, published: publicado } });
    await setDoc(doc(db, 'clubs', OUTRO), { name: 'Clube B', association: { enabled: true, published: true } });
    await setDoc(doc(db, 'club_members', `${CLUBE}_${PRES}`), { club_id: CLUBE, user_id: PRES, role: 'admin' });
    await Promise.all([COM, SEC, MEMBRO].map((u) => setDoc(doc(db, 'club_members', `${CLUBE}_${u}`), { club_id: CLUBE, user_id: u, role: 'member' })));
    await setDoc(doc(db, 'club_x', CLUBE, 'staff', COM), { user_id: COM, perms: ['comms'], term_end_ms: 0 });
    await setDoc(doc(db, 'club_x', CLUBE, 'staff', SEC), { user_id: SEC, perms: ['members'], term_end_ms: 0 });
  });
}

describe('cupons e campanhas do clube', () => {
  beforeEach(() => semear());

  it('1. a comunicação e a administração emitem; secretaria, associado e estranho não', async () => {
    await assertSucceeds(setDoc(doc(como(COM), 'promo_coupons', 'c1'), cupom()));
    await assertSucceeds(setDoc(doc(como(PRES), 'promo_coupons', 'c2'), cupom()));
    await assertSucceeds(setDoc(doc(como(COM), 'promo_campaigns', 'g1'), campanha()));
    await assertFails(setDoc(doc(como(SEC), 'promo_coupons', 'c3'), cupom()));
    await assertFails(setDoc(doc(como(MEMBRO), 'promo_coupons', 'c4'), cupom()));
    await assertFails(setDoc(doc(como(ZE), 'promo_campaigns', 'g2'), campanha()));
  });

  it('2. conta logada lê (o associado confere o código); o visitante sem conta não', async () => {
    await semRegras((db) => setDoc(doc(db, 'promo_coupons', 'c9'), cupom()));
    await assertSucceeds(getDoc(doc(como(MEMBRO), 'promo_coupons', 'c9')));
    await assertSucceeds(getDoc(doc(como(ZE), 'promo_coupons', 'c9')));
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'promo_coupons', 'c9')));
  });

  it('3. ⭐ ninguém emite em nome de outro clube; o emissor não muda no update', async () => {
    await assertFails(setDoc(doc(como(COM), 'promo_coupons', 'c1'), cupom({ issuer_id: OUTRO })));
    await assertFails(setDoc(doc(como(COM), 'promo_campaigns', 'g1'), campanha({ issuer_id: OUTRO })));
    await semRegras((db) => setDoc(doc(db, 'promo_coupons', 'c9'), cupom()));
    await assertFails(updateDoc(doc(como(COM), 'promo_coupons', 'c9'), { issuer_id: OUTRO }));
    await assertSucceeds(updateDoc(doc(como(COM), 'promo_coupons', 'c9'), { name: 'Café novo' }));
  });

  it('4. quem emite apaga o que emitiu; a secretaria não', async () => {
    await semRegras((db) => setDoc(doc(db, 'promo_coupons', 'c9'), cupom()));
    await assertFails(deleteDoc(doc(como(SEC), 'promo_coupons', 'c9')));
    await assertSucceeds(deleteDoc(doc(como(COM), 'promo_coupons', 'c9')));
  });

  it('5. página do clube fora do ar: ninguém cria; flag desligada: nem a equipe', async () => {
    await semear({ publicado: false });
    await assertFails(setDoc(doc(como(COM), 'promo_coupons', 'c1'), cupom()));
    await assertFails(setDoc(doc(como(PRES), 'promo_campaigns', 'g1'), campanha()));
    await semear({ flag: false });
    await assertFails(setDoc(doc(como(PRES), 'promo_coupons', 'c1'), cupom()));
  });

  it('6. configurações privadas (custo do vale): só a equipe de comunicação e a administração', async () => {
    await assertSucceeds(setDoc(doc(como(COM), 'promo_settings', CLUBE), { coupon_costs: { c1: 5 } }));
    await assertSucceeds(getDoc(doc(como(PRES), 'promo_settings', CLUBE)));
    await assertFails(getDoc(doc(como(SEC), 'promo_settings', CLUBE)));
    await assertFails(getDoc(doc(como(MEMBRO), 'promo_settings', CLUBE)));
    await assertFails(setDoc(doc(como(COM), 'promo_settings', OUTRO), { coupon_costs: {} }));
  });
});
