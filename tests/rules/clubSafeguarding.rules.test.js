/**
 * Regras da PROTEÇÃO DE MENORES do clube-associação (`club_x/{clube}/safeguard` e `.../minors`,
 * Bloco E2b):
 *
 *  1. leem só a disciplina e a administração — nem o financeiro, nem a secretaria, nem a própria
 *     pessoa (ela vê o que é dela pela função do servidor, que não devolve o caminho do arquivo),
 *     nem quem saiu do clube (o cargo vale só para membro);
 *  2. NINGUÉM grava pelo navegador — nem a administração, nem a disciplina, nem a própria pessoa
 *     (o responsável do menor e a conferência da certidão são do servidor);
 *  3. a pessoa não lê o registro de outra.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

const CLUBE = 'clubA';
const PRES = 'pres1';
const DISC = 'disc1';
const FIN = 'fin1';
const SEC = 'sec1';
const MENOR = 'menor1';
const EX = 'ex1';
const ZE = 'ze1';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-club-safeguarding-test',
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
    await Promise.all([DISC, FIN, SEC, MENOR, EX].map((u) => setDoc(doc(db, 'club_members', `${CLUBE}_${u}`), { club_id: CLUBE, user_id: u, role: 'member' })));
    await setDoc(ref(db, 'staff', DISC), { user_id: DISC, perms: ['discipline'], term_end_ms: 0 });
    await setDoc(ref(db, 'staff', FIN), { user_id: FIN, perms: ['finance'], term_end_ms: 0 });
    await setDoc(ref(db, 'staff', SEC), { user_id: SEC, perms: ['members'], term_end_ms: 0 });
    await setDoc(ref(db, 'staff', EX), { user_id: EX, perms: ['discipline'], term_end_ms: 0 });
    await setDoc(ref(db, 'safeguard', MENOR), { club_id: CLUBE, user_id: MENOR, name: 'Menor', pledge_version: 1 });
    await setDoc(ref(db, 'minors', MENOR), { club_id: CLUBE, user_id: MENOR, guardian: { name: 'Responsável', phone: '51999990000', consent: true } });
  });
  await semRegras(async (db) => { await deleteDoc(doc(db, 'club_members', `${CLUBE}_${EX}`)); });
}

describe('proteção de menores do clube nas regras', () => {
  beforeEach(() => semear());

  it('1. leem a disciplina e a administração; os demais não, nem a própria pessoa', async () => {
    for (const kind of ['safeguard', 'minors']) {
      for (const quem of [DISC, PRES]) await assertSucceeds(getDoc(ref(como(quem), kind, MENOR)));
      for (const quem of [FIN, SEC, MENOR, ZE, EX]) await assertFails(getDoc(ref(como(quem), kind, MENOR)));
    }
  });

  it('1b. a lista inteira também só abre para a disciplina', async () => {
    for (const kind of ['safeguard', 'minors']) {
      await assertSucceeds(getDocs(collection(como(DISC), 'club_x', CLUBE, kind)));
      await assertFails(getDocs(collection(como(MENOR), 'club_x', CLUBE, kind)));
      await assertFails(getDocs(collection(como(FIN), 'club_x', CLUBE, kind)));
    }
  });

  it('2. ninguém grava pelo navegador', async () => {
    for (const quem of [PRES, DISC, MENOR]) {
      await assertFails(setDoc(ref(como(quem), 'safeguard', 'novo'), { club_id: CLUBE, user_id: quem, name: 'X', background: { status: 'valid', valid_until: '2099-01-01' } }));
      await assertFails(updateDoc(ref(como(quem), 'safeguard', MENOR), { background: { status: 'valid', valid_until: '2099-01-01' } }));
      await assertFails(deleteDoc(ref(como(quem), 'safeguard', MENOR)));
      await assertFails(setDoc(ref(como(quem), 'minors', 'novo'), { club_id: CLUBE, user_id: quem, guardian: { name: 'Eu mesmo' } }));
      await assertFails(updateDoc(ref(como(quem), 'minors', MENOR), { 'guardian.consent': false }));
      await assertFails(deleteDoc(ref(como(quem), 'minors', MENOR)));
    }
  });
});
