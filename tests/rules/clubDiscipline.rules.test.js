/**
 * Regras da DISCIPLINA e da OUVIDORIA do clube-associação (`club_x/{clube}/cases` e `ombud`, Bloco E1):
 *
 *  1. a sanção é lida pela própria pessoa e pela disciplina (e pela administração); outro
 *     associado, a secretaria e o financeiro não leem a sanção alheia;
 *  2. a CONSULTA "as minhas sanções" (`user_id == eu`) é provável; a sem filtro só a disciplina faz;
 *  3. a ouvidoria só a disciplina lê — quem enviou (identificado ou não) não lê o documento
 *     (acompanha o estado pelo servidor, pelo protocolo);
 *  4. NINGUÉM grava pelo navegador, nem a administração nem a disciplina nem a própria pessoa;
 *  5. o cargo de quem saiu do clube não lê.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const CLUBE = 'clubA';
const PRES = 'pres1';
const DISC = 'disc1';
const SEC = 'sec1';
const FIN = 'fin1';
const ANA = 'ana1';
const BIA = 'bia1';
const EX = 'ex1';
const ZE = 'ze1';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-club-discipline-test',
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
    await Promise.all([DISC, SEC, FIN, ANA, BIA, EX].map((u) => setDoc(doc(db, 'club_members', `${CLUBE}_${u}`), { club_id: CLUBE, user_id: u, role: 'member' })));
    await setDoc(ref(db, 'staff', DISC), { user_id: DISC, perms: ['discipline'], term_end_ms: 0 });
    await setDoc(ref(db, 'staff', SEC), { user_id: SEC, perms: ['docs'], term_end_ms: 0 });
    await setDoc(ref(db, 'staff', FIN), { user_id: FIN, perms: ['finance'], term_end_ms: 0 });
    await setDoc(ref(db, 'staff', EX), { user_id: EX, perms: ['discipline'], term_end_ms: 0 });
    await setDoc(ref(db, 'cases', 'sa'), { club_id: CLUBE, user_id: ANA, kind: 'warning', status: 'active' });
    await setDoc(ref(db, 'cases', 'sb'), { club_id: CLUBE, user_id: BIA, kind: 'fine', status: 'active' });
    await setDoc(ref(db, 'ombud', 'anonima'), { club_id: CLUBE, anonymous: true, reporter_uid: null, body: 'texto', status: 'open' });
    await setDoc(ref(db, 'ombud', 'identificada'), { club_id: CLUBE, anonymous: false, reporter_uid: ANA, body: 'texto', status: 'open' });
  });
  await semRegras(async (db) => { await deleteDoc(doc(db, 'club_members', `${CLUBE}_${EX}`)); });
}

describe('disciplina do clube nas regras', () => {
  beforeEach(() => semear());

  it('1. a sanção é da própria pessoa, da disciplina e da administração; não da secretaria, do financeiro nem de outro associado', async () => {
    for (const quem of [ANA, DISC, PRES]) await assertSucceeds(getDoc(ref(como(quem), 'cases', 'sa')));
    for (const quem of [BIA, SEC, FIN, ZE]) await assertFails(getDoc(ref(como(quem), 'cases', 'sa')));
  });

  it('2. "as minhas sanções" é uma consulta provável; a sem filtro só a disciplina faz', async () => {
    const minhas = await assertSucceeds(getDocs(query(collection(como(ANA), 'club_x', CLUBE, 'cases'), where('user_id', '==', ANA))));
    if (minhas.size !== 1) throw new Error(`esperava 1 sanção, veio ${minhas.size}`);
    await assertFails(getDocs(query(collection(como(ANA), 'club_x', CLUBE, 'cases'), where('user_id', '==', BIA))));
    await assertFails(getDocs(collection(como(ANA), 'club_x', CLUBE, 'cases')));
    await assertFails(getDocs(collection(como(SEC), 'club_x', CLUBE, 'cases')));
    for (const quem of [DISC, PRES]) await assertSucceeds(getDocs(collection(como(quem), 'club_x', CLUBE, 'cases')));
  });

  it('3. a ouvidoria é só da disciplina: nem quem enviou lê o documento', async () => {
    for (const id of ['anonima', 'identificada']) {
      for (const quem of [DISC, PRES]) await assertSucceeds(getDoc(ref(como(quem), 'ombud', id)));
      for (const quem of [ANA, BIA, SEC, FIN, ZE]) await assertFails(getDoc(ref(como(quem), 'ombud', id)));
    }
    await assertFails(getDocs(collection(como(ANA), 'club_x', CLUBE, 'ombud')));
    await assertSucceeds(getDocs(collection(como(DISC), 'club_x', CLUBE, 'ombud')));
  });

  it('4. ninguém grava pelo navegador', async () => {
    for (const quem of [PRES, DISC, ANA]) {
      await assertFails(setDoc(ref(como(quem), 'cases', 'nova'), { club_id: CLUBE, user_id: ANA, kind: 'warning', status: 'active' }));
      await assertFails(updateDoc(ref(como(quem), 'cases', 'sa'), { status: 'overturned' }));
      await assertFails(deleteDoc(ref(como(quem), 'cases', 'sa')));
      await assertFails(setDoc(ref(como(quem), 'ombud', 'nova'), { club_id: CLUBE, anonymous: true, body: 'texto', status: 'open' }));
      await assertFails(updateDoc(ref(como(quem), 'ombud', 'anonima'), { status: 'closed' }));
    }
  });

  it('5. o cargo de quem saiu do clube não lê', async () => {
    await assertFails(getDoc(ref(como(EX), 'ombud', 'anonima')));
    await assertFails(getDoc(ref(como(EX), 'cases', 'sa')));
  });
});
