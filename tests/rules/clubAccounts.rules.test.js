/**
 * Regras das CONTAS do clube-associação (`club_x/{clube}/budgets|ledger|reports`,
 * Bloco D1):
 *
 *  1. leem o orçamento, os lançamentos e a prestação: a administração, o
 *     financeiro e o conselho fiscal; a comunicação, o associado comum e o
 *     estranho não;
 *  2. NINGUÉM grava pelo navegador — nem a administração, nem o financeiro
 *     (a escrita é do servidor, `functions/clubAccounts.js`);
 *  3. o público (qualquer conta logada) lê só a cópia publicada (`pub: true`) e
 *     só com a associação aberta ao público; o documento de trabalho não;
 *  4. o cargo de quem saiu do clube não lê.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const CLUBE = 'clubA';
const PRES = 'pres1';
const TES = 'tes1';
const FIS = 'fis1';
const COM = 'com1';
const MEMBRO = 'membro1';
const EX = 'ex1';
const ZE = 'ze1';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-club-accounts-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const ref = (db, kind, id) => doc(db, 'club_x', CLUBE, kind, id);

async function semear({ publicado = true, flag = true } = {}) {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { club_association: flag } });
    await setDoc(doc(db, 'clubs', CLUBE), { name: 'Clube A', association: { enabled: true, published: publicado } });
    await setDoc(doc(db, 'club_members', `${CLUBE}_${PRES}`), { club_id: CLUBE, user_id: PRES, role: 'admin' });
    await Promise.all([TES, FIS, COM, MEMBRO, EX].map((u) => setDoc(doc(db, 'club_members', `${CLUBE}_${u}`), { club_id: CLUBE, user_id: u, role: 'member' })));
    await setDoc(ref(db, 'staff', TES), { user_id: TES, perms: ['finance'], term_end_ms: 0 });
    await setDoc(ref(db, 'staff', FIS), { user_id: FIS, perms: ['fiscal'], term_end_ms: 0 });
    await setDoc(ref(db, 'staff', COM), { user_id: COM, perms: ['comms'], term_end_ms: 0 });
    await setDoc(ref(db, 'staff', EX), { user_id: EX, perms: ['finance'], term_end_ms: 0 });
    await setDoc(ref(db, 'budgets', '2027'), { club_id: CLUBE, year: 2027, status: 'draft', lines: { 'expense.travel': 100 } });
    await setDoc(ref(db, 'budgets', '2027_pub'), { club_id: CLUBE, year: 2027, pub: true, copy_of: '2027', published: { lines: {} } });
    await setDoc(ref(db, 'ledger', 'l1'), { club_id: CLUBE, kind: 'expense', amount_cents: 100, status: 'posted' });
    await setDoc(ref(db, 'reports', '2026'), { club_id: CLUBE, period: '2026', status: 'opinion' });
    await setDoc(ref(db, 'reports', '2025'), { club_id: CLUBE, period: '2025', status: 'published', pub: true });
  });
  // Quem saiu do clube perde o poder do cargo (o cargo só vale para membro).
  await semRegras(async (db) => { await deleteDoc(doc(db, 'club_members', `${CLUBE}_${EX}`)); });
}

describe('contas do clube nas regras', () => {
  beforeEach(() => semear());

  it('1. administração, financeiro e conselho fiscal leem; comunicação, associado e estranho não', async () => {
    for (const kind of [['budgets', '2027'], ['ledger', 'l1'], ['reports', '2026']]) {
      await assertSucceeds(getDoc(ref(como(PRES), ...kind)));
      await assertSucceeds(getDoc(ref(como(TES), ...kind)));
      await assertSucceeds(getDoc(ref(como(FIS), ...kind)));
      await assertFails(getDoc(ref(como(COM), ...kind)));
      await assertFails(getDoc(ref(como(MEMBRO), ...kind)));
      await assertFails(getDoc(ref(como(ZE), ...kind)));
    }
  });

  it('2. ninguém grava pelo navegador, nem a administração nem o financeiro', async () => {
    for (const quem of [PRES, TES, FIS]) {
      await assertFails(setDoc(ref(como(quem), 'ledger', 'novo'), { club_id: CLUBE, kind: 'income', amount_cents: 5 }));
      await assertFails(updateDoc(ref(como(quem), 'ledger', 'l1'), { status: 'void' }));
      await assertFails(deleteDoc(ref(como(quem), 'ledger', 'l1')));
      await assertFails(setDoc(ref(como(quem), 'budgets', '2028'), { club_id: CLUBE, year: 2028 }));
      await assertFails(updateDoc(ref(como(quem), 'reports', '2026'), { status: 'published', pub: true }));
      await assertFails(setDoc(ref(como(quem), 'reports', '2024'), { club_id: CLUBE, pub: true }));
    }
  });

  it('3. o público lê só a cópia publicada, com a associação aberta', async () => {
    await assertSucceeds(getDoc(ref(como(ZE), 'budgets', '2027_pub')));
    await assertSucceeds(getDoc(ref(como(ZE), 'reports', '2025')));
    await assertFails(getDoc(ref(como(ZE), 'budgets', '2027')));
    await assertFails(getDoc(ref(como(ZE), 'reports', '2026')));
    await assertFails(getDoc(ref(como(ZE), 'ledger', 'l1')));
    await semear({ publicado: false });
    await assertFails(getDoc(ref(como(ZE), 'budgets', '2027_pub')));
    await assertFails(getDoc(ref(como(ZE), 'reports', '2025')));
    await assertSucceeds(getDoc(ref(como(TES), 'budgets', '2027_pub'))); // a equipe segue lendo
  });

  it('5. a CONSULTA pública (pub == true) é provável para a regra; a sem filtro não', async () => {
    const pub = await assertSucceeds(getDocs(query(collection(como(ZE), 'club_x', CLUBE, 'reports'), where('pub', '==', true))));
    if (pub.size !== 1) throw new Error(`esperava 1 prestação publicada, veio ${pub.size}`);
    await assertSucceeds(getDocs(query(collection(como(ZE), 'club_x', CLUBE, 'budgets'), where('pub', '==', true))));
    await assertFails(getDocs(collection(como(ZE), 'club_x', CLUBE, 'reports')));
  });

  it('6. o conselho fiscal lê as cobranças (confere a receita); a comunicação não', async () => {
    await semRegras(async (db) => { await setDoc(ref(db, 'charges', 'k1'), { club_id: CLUBE, user_id: MEMBRO, status: 'paid', amount_cents: 1000 }); });
    await assertSucceeds(getDoc(ref(como(FIS), 'charges', 'k1')));
    await assertSucceeds(getDoc(ref(como(TES), 'charges', 'k1')));
    await assertFails(getDoc(ref(como(COM), 'charges', 'k1')));
    await assertFails(setDoc(ref(como(FIS), 'charges', 'k2'), { club_id: CLUBE, user_id: FIS, status: 'paid' }));
  });

  it('4. o cargo de quem saiu do clube não lê', async () => {
    await assertFails(getDoc(ref(como(EX), 'ledger', 'l1')));
    await assertFails(getDoc(ref(como(EX), 'budgets', '2027')));
  });
});
