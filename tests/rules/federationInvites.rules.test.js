/**
 * Regras dos CONVITES para filiar (`federation_invites`) e do interruptor de
 * módulo da federação:
 *
 *  1. ⭐ o convite lê a pessoa convidada e a secretaria (`members`/`admin`) —
 *     ninguém mais; as consultas da pessoa (por `user_id`) e da secretaria
 *     (por `federation_id`) são prováveis;
 *  2. ⭐ ninguém grava pelo navegador — nem a presidência: convidar, recusar e
 *     cancelar são do servidor (`federationMembership`);
 *  3. o admin liga e desliga UM módulo (`modules.x`) sem regravar os outros;
 *     quem não é admin da federação, não.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';

const PRES = 'pres1';
const TES = 'tes1';
const ANA = 'ana1';
const ZE = 'ze1';
const FED = 'fedA';
const INV = `${FED}_${ANA}`;

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-invites-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();

beforeEach(async () => {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { federations: true } });
    await setDoc(doc(db, 'federations', FED), { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', published: true, created_by: PRES, modules: { news: true } });
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), { federation_id: FED, user_id: PRES, role: 'president' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${TES}`), { federation_id: FED, user_id: TES, role: 'treasurer' });
    await setDoc(doc(db, 'federation_invites', INV), { federation_id: FED, user_id: ANA, plan_id: 'anual', status: 'pending', created_at_ms: 1, expires_at_ms: 9e15 });
  });
});

describe('convites: leitura', () => {
  it('1. a convidada e a secretaria leem; o financeiro e os outros, não', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_invites', INV)));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_invites'), where('user_id', '==', ANA))));
    await assertSucceeds(getDoc(doc(como(PRES), 'federation_invites', INV)));
    await assertSucceeds(getDocs(query(collection(como(PRES), 'federation_invites'), where('federation_id', '==', FED))));
    await assertFails(getDoc(doc(como(TES), 'federation_invites', INV)));
    await assertFails(getDoc(doc(como(ZE), 'federation_invites', INV)));
    await assertFails(getDocs(query(collection(como(ZE), 'federation_invites'), where('federation_id', '==', FED))));
  });
});

describe('convites: escrita', () => {
  it('2. ninguém grava pelo navegador', async () => {
    await assertFails(setDoc(doc(como(PRES), 'federation_invites', `${FED}_${ZE}`), { federation_id: FED, user_id: ZE, plan_id: 'anual', status: 'pending' }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_invites', INV), { status: 'declined' }));
    await assertFails(updateDoc(doc(como(PRES), 'federation_invites', INV), { status: 'cancelled' }));
    await assertFails(deleteDoc(doc(como(ANA), 'federation_invites', INV)));
  });
});

describe('interruptor de módulo', () => {
  it('3. o admin liga e desliga um módulo; o financeiro não', async () => {
    await assertSucceeds(updateDoc(doc(como(PRES), 'federations', FED), { 'modules.ranking': true, updated_at: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(como(PRES), 'federations', FED), { 'modules.news': false }));
    await assertFails(updateDoc(doc(como(TES), 'federations', FED), { 'modules.store': true }));
  });
});
