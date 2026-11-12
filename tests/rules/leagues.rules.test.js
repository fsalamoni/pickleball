/**
 * LIGAS (docs/57-LIGAS.md): a árvore `leagues/**` é lida por quem tem conta e
 * NUNCA escrita pelo cliente — nem pelo organizador, nem pelo admin da
 * plataforma. Toda escrita passa pela função `leagues`.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

let testEnv;
const as = (uid) => testEnv.authenticatedContext(uid).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-leagues-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', 'adm'), { role: 'platform_admin' });
    await setDoc(doc(db, 'leagues', 'l1'), { name: 'Liga', status: 'open', admins: ['ana'], member_uids: ['ana', 'bia'] });
    await setDoc(doc(db, 'leagues', 'l1', 'entries', 'e1'), { division_id: 'd1', player_uids: ['bia'], status: 'active' });
    await setDoc(doc(db, 'leagues', 'l1', 'matches', 'm1'), { division_id: 'd1', side_a: 'e1', side_b: 'e2', games: [] });
  });
});

describe('leagues', () => {
  it('quem tem conta lê a liga, as inscrições e os jogos; "minhas ligas" por member_uids', async () => {
    await assertSucceeds(getDoc(doc(as('cau'), 'leagues', 'l1')));
    await assertSucceeds(getDocs(collection(as('cau'), 'leagues', 'l1', 'entries')));
    await assertSucceeds(getDoc(doc(as('cau'), 'leagues', 'l1', 'matches', 'm1')));
    await assertSucceeds(getDocs(query(collection(as('bia'), 'leagues'), where('member_uids', 'array-contains', 'bia'))));
  });

  it('sem conta não lê', async () => {
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'leagues', 'l1')));
  });

  it('ninguém escreve pelo cliente: nem o organizador, nem o atleta, nem o admin', async () => {
    await assertFails(setDoc(doc(as('cau'), 'leagues', 'l2'), { name: 'Falsa', admins: ['cau'] }));
    await assertFails(updateDoc(doc(as('ana'), 'leagues', 'l1'), { name: 'Outra' }));
    await assertFails(setDoc(doc(as('bia'), 'leagues', 'l1', 'entries', 'e9'), { division_id: 'd1', player_uids: ['bia'] }));
    await assertFails(updateDoc(doc(as('ana'), 'leagues', 'l1', 'matches', 'm1'), { games: [{ a: 11, b: 0 }] }));
    await assertFails(deleteDoc(doc(as('adm'), 'leagues', 'l1')));
  });
});
