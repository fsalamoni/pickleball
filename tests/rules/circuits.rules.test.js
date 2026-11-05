/**
 * Circuitos (séries de torneios), varredura 2026-11-05: criar exige que o
 * `created_by` seja a própria conta. Antes qualquer conta logada criava um
 * circuito em nome de outra pessoa, e a leitura é pública.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

let testEnv;
const as = (uid) => testEnv.authenticatedContext(uid).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-circuits-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });
beforeEach(async () => { await testEnv.clearFirestore(); });

describe('circuits', () => {
  it('o criador cria o circuito em nome próprio', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), 'circuits', 'c1'), { name: 'Circuito', created_by: 'alice' }));
  });
  it('ninguém cria em nome de outra pessoa', async () => {
    await assertFails(setDoc(doc(as('invasor'), 'circuits', 'c2'), { name: 'Falso', created_by: 'alice' }));
  });
  it('sem conta não cria', async () => {
    await assertFails(setDoc(doc(testEnv.unauthenticatedContext().firestore(), 'circuits', 'c3'), { name: 'X', created_by: null }));
  });
  it('o criador continua virando admin do próprio circuito', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), 'circuits', 'c4'), { name: 'Circuito', created_by: 'alice' }));
    await assertSucceeds(setDoc(doc(as('alice'), 'circuit_admins', 'c4_alice'), { circuit_id: 'c4', user_id: 'alice', role: 'owner' }));
    await assertFails(setDoc(doc(as('invasor'), 'circuit_admins', 'c4_invasor'), { circuit_id: 'c4', user_id: 'invasor', role: 'owner' }));
  });
});
