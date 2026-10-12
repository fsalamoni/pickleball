/**
 * `admin_access_logs` — o registro de leitura do suporte (05-ADMIN-SUPORTE §7).
 * Só o servidor escreve; só o admin lê — registro interno, o titular não vê.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

let testEnv;
const USER = 'user_uid';
const OTHER = 'other_uid';
const ADMIN = 'admin_uid';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ADMIN), { uid: ADMIN, role: 'platform_admin' });
    await setDoc(doc(db, 'admin_access_logs', 'l1'), {
      admin_uid: ADMIN, target_uid: USER, action: 'reveal_field', fields: ['email'], at_ms: 1,
    });
  });
});
const as = (uid) => testEnv.authenticatedContext(uid, { email: `${uid}@x.com`, email_verified: true }).firestore();

describe('admin_access_logs', () => {
  it('🔴 o titular NÃO lê os acessos aos próprios dados (registro interno)', async () => {
    await assertFails(getDocs(query(collection(as(USER), 'admin_access_logs'), where('target_uid', '==', USER))));
    await assertFails(getDoc(doc(as(USER), 'admin_access_logs', 'l1')));
  });
  it('🔴 outra pessoa não lê', async () => {
    await assertFails(getDoc(doc(as(OTHER), 'admin_access_logs', 'l1')));
    await assertFails(getDocs(query(collection(as(OTHER), 'admin_access_logs'), where('target_uid', '==', USER))));
  });
  it('o admin lê tudo', async () => {
    await assertSucceeds(getDocs(collection(as(ADMIN), 'admin_access_logs')));
  });
  it('🔴 ninguém escreve, apaga ou altera pelo cliente — nem o admin', async () => {
    await assertFails(setDoc(doc(as(ADMIN), 'admin_access_logs', 'l2'), { admin_uid: ADMIN, target_uid: USER }));
    await assertFails(updateDoc(doc(as(ADMIN), 'admin_access_logs', 'l1'), { reason_text: 'x' }));
    await assertFails(deleteDoc(doc(as(ADMIN), 'admin_access_logs', 'l1')));
    await assertFails(deleteDoc(doc(as(USER), 'admin_access_logs', 'l1')));
  });
});
