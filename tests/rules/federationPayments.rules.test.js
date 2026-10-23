/**
 * Regras do PIX COM BAIXA AUTOMÁTICA (rodada 3, Bloco 6a, `docs/50` §43):
 *
 *  1. ⭐ a chave do provedor (`federation_secrets`) ninguém lê nem grava pelo
 *     navegador — nem a equipe financeira, nem o admin da federação;
 *  2. ⭐ o sinal `payment_gateway` o admin da federação não grava (só o servidor);
 *  3. ⭐ o pagador não grava o Pix do provedor (`gateway`) nem se dá baixa.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PRES = 'pres1';
const TES = 'tes1';
const ANA = 'ana1';
const FED = 'fedA';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-payments-test',
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
    await setDoc(doc(db, 'federations', FED), { name: 'Federação', acronym: 'F', slug: 'f', status: 'approved', created_by: PRES, published: true, modules: {} });
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), { federation_id: FED, user_id: PRES, role: 'president' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${TES}`), { federation_id: FED, user_id: TES, role: 'treasurer' });
    await setDoc(doc(db, 'federation_secrets', FED), { federation_id: FED, provider: 'mercadopago', mercadopago: { access_token: 'APP_USR-x' } });
    await setDoc(doc(db, 'federation_charges', 'ch1'), { federation_id: FED, payer_uid: ANA, status: 'open', amount_cents: 5000 });
  });
});

describe('Pix com baixa automática', () => {
  it('1. a chave do provedor ninguém lê nem grava pelo navegador', async () => {
    await assertFails(getDoc(doc(como(PRES), 'federation_secrets', FED)));
    await assertFails(getDoc(doc(como(TES), 'federation_secrets', FED)));
    await assertFails(setDoc(doc(como(PRES), 'federation_secrets', FED), { provider: 'asaas' }));
  });

  it('2. o admin da federação não liga o sinal sozinho', async () => {
    await assertFails(updateDoc(doc(como(PRES), 'federations', FED), { payment_gateway: { provider: 'mercadopago', enabled: true } }));
  });

  it('3. o pagador só declara; não grava o Pix do provedor nem a baixa', async () => {
    await assertFails(updateDoc(doc(como(ANA), 'federation_charges', 'ch1'), { gateway: { provider: 'mercadopago', id: '1', payload: 'x' } }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_charges', 'ch1'), { status: 'paid' }));
    await assertSucceeds(updateDoc(doc(como(ANA), 'federation_charges', 'ch1'), { status: 'declared', declared_at: '2026-10-23', declared_note: '' }));
  });
});
