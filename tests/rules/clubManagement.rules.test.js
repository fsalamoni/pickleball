/**
 * Regras do PATRIMÔNIO do clube-associação (`club_x/{clube}/assets`, Bloco E2a):
 *
 *  1. leem o financeiro, a diretoria esportiva, o conselho fiscal e a administração; a secretaria,
 *     um associado comum, quem não é do clube e quem saiu do clube (cargo vale só para membro) não;
 *  2. NINGUÉM grava pelo navegador — nem a administração, nem o financeiro, nem a diretoria esportiva;
 *  3. com a flag desligada a escrita continua fechada (e o servidor recusa).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

const CLUBE = 'clubA';
const PRES = 'pres1';
const ESP = 'esp1';
const FIN = 'fin1';
const FISC = 'fisc1';
const SEC = 'sec1';
const ANA = 'ana1';
const EX = 'ex1';
const ZE = 'ze1';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-club-management-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const ref = (db, kind, id) => doc(db, 'club_x', CLUBE, kind, id);

async function semear() {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { club_association: true } });
    await setDoc(doc(db, 'clubs', CLUBE), { name: 'Clube A', association: { enabled: true, published: true } });
    await setDoc(doc(db, 'club_members', `${CLUBE}_${PRES}`), { club_id: CLUBE, user_id: PRES, role: 'admin' });
    await Promise.all([ESP, FIN, FISC, SEC, ANA, EX].map((u) => setDoc(doc(db, 'club_members', `${CLUBE}_${u}`), { club_id: CLUBE, user_id: u, role: 'member' })));
    await setDoc(ref(db, 'staff', ESP), { user_id: ESP, perms: ['sports'], term_end_ms: 0 });
    await setDoc(ref(db, 'staff', FIN), { user_id: FIN, perms: ['finance'], term_end_ms: 0 });
    await setDoc(ref(db, 'staff', FISC), { user_id: FISC, perms: ['fiscal'], term_end_ms: 0 });
    await setDoc(ref(db, 'staff', SEC), { user_id: SEC, perms: ['docs'], term_end_ms: 0 });
    await setDoc(ref(db, 'staff', EX), { user_id: EX, perms: ['finance'], term_end_ms: 0 });
    await setDoc(ref(db, 'assets', 'b1'), { club_id: CLUBE, name: 'Rede', quantity: 4, status: 'active', loans: [] });
  });
  await semRegras(async (db) => { await deleteDoc(doc(db, 'club_members', `${CLUBE}_${EX}`)); });
}

describe('patrimônio do clube nas regras', () => {
  beforeEach(() => semear());

  it('1. leem o financeiro, a diretoria esportiva, o conselho fiscal e a administração; os demais não', async () => {
    for (const quem of [FIN, ESP, FISC, PRES]) await assertSucceeds(getDoc(ref(como(quem), 'assets', 'b1')));
    for (const quem of [SEC, ANA, ZE, EX]) await assertFails(getDoc(ref(como(quem), 'assets', 'b1')));
  });

  it('1b. a lista inteira também só abre para quem lê', async () => {
    await assertSucceeds(getDocs(collection(como(ESP), 'club_x', CLUBE, 'assets')));
    await assertFails(getDocs(collection(como(ANA), 'club_x', CLUBE, 'assets')));
  });

  it('2. ninguém grava pelo navegador', async () => {
    for (const quem of [PRES, FIN, ESP, FISC]) {
      await assertFails(setDoc(ref(como(quem), 'assets', 'novo'), { club_id: CLUBE, name: 'X', quantity: 1, status: 'active', loans: [] }));
      await assertFails(updateDoc(ref(como(quem), 'assets', 'b1'), { quantity: 99 }));
      await assertFails(deleteDoc(ref(como(quem), 'assets', 'b1')));
    }
  });
});
