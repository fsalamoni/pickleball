/**
 * Regras dos DOCUMENTOS do clube-associação (`club_x/{clube}/docs`, Bloco D2):
 *
 *  1. a equipe do acervo (`docs`) e a administração leem tudo, rascunho inclusive; a
 *     comunicação, o associado comum e o estranho não leem rascunho nem "só a equipe";
 *  2. NINGUÉM grava pelo navegador — nem a administração, nem a secretaria (a escrita
 *     é do servidor, `functions/clubDocs.js`, que numera e copia o arquivo);
 *  3. o público lê só `pub == true`, com a associação aberta; o "só associados"
 *     (`members == true`) só o membro do clube lê;
 *  4. as CONSULTAS por `pub` e por `members` são prováveis para a regra; a sem
 *     filtro não é;
 *  5. o cargo de quem saiu do clube não lê; o contador de números não é de ninguém.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const CLUBE = 'clubA';
const PRES = 'pres1';
const SEC = 'sec1';
const COM = 'com1';
const MEMBRO = 'membro1';
const EX = 'ex1';
const ZE = 'ze1';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-club-docs-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const ref = (db, kind, id) => doc(db, 'club_x', CLUBE, kind, id);

async function semear({ publicado = true } = {}) {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { club_association: true } });
    await setDoc(doc(db, 'clubs', CLUBE), { name: 'Clube A', association: { enabled: true, published: publicado } });
    await setDoc(doc(db, 'club_members', `${CLUBE}_${PRES}`), { club_id: CLUBE, user_id: PRES, role: 'admin' });
    await Promise.all([SEC, COM, MEMBRO, EX].map((u) => setDoc(doc(db, 'club_members', `${CLUBE}_${u}`), { club_id: CLUBE, user_id: u, role: 'member' })));
    await setDoc(ref(db, 'staff', SEC), { user_id: SEC, perms: ['docs'], term_end_ms: 0 });
    await setDoc(ref(db, 'staff', COM), { user_id: COM, perms: ['comms'], term_end_ms: 0 });
    await setDoc(ref(db, 'staff', EX), { user_id: EX, perms: ['docs'], term_end_ms: 0 });
    await setDoc(ref(db, 'docs', 'rascunho'), { club_id: CLUBE, status: 'draft', visibility: 'public', pub: false, members: false });
    await setDoc(ref(db, 'docs', 'publico'), { club_id: CLUBE, status: 'published', visibility: 'public', pub: true, members: true });
    await setDoc(ref(db, 'docs', 'associados'), { club_id: CLUBE, status: 'published', visibility: 'members', pub: false, members: true });
    await setDoc(ref(db, 'docs', 'equipe'), { club_id: CLUBE, status: 'published', visibility: 'staff', pub: false, members: false });
    await setDoc(ref(db, 'seq', 'docs'), { club_id: CLUBE, counters: { 'resolution:2027': 3 } });
  });
  // Quem saiu do clube perde o poder do cargo (o cargo só vale para membro).
  await semRegras(async (db) => { await deleteDoc(doc(db, 'club_members', `${CLUBE}_${EX}`)); });
}

describe('documentos do clube nas regras', () => {
  beforeEach(() => semear());

  it('1. a secretaria e a administração leem tudo; comunicação, associado e estranho não leem rascunho nem "só a equipe"', async () => {
    for (const id of ['rascunho', 'publico', 'associados', 'equipe']) {
      await assertSucceeds(getDoc(ref(como(PRES), 'docs', id)));
      await assertSucceeds(getDoc(ref(como(SEC), 'docs', id)));
    }
    for (const quem of [COM, MEMBRO, ZE]) {
      await assertFails(getDoc(ref(como(quem), 'docs', 'rascunho')));
      await assertFails(getDoc(ref(como(quem), 'docs', 'equipe')));
    }
  });

  it('2. ninguém grava pelo navegador, nem a administração nem a secretaria', async () => {
    for (const quem of [PRES, SEC]) {
      await assertFails(setDoc(ref(como(quem), 'docs', 'novo'), { club_id: CLUBE, status: 'published', pub: true, members: true }));
      await assertFails(updateDoc(ref(como(quem), 'docs', 'rascunho'), { status: 'published', pub: true }));
      await assertFails(updateDoc(ref(como(quem), 'docs', 'publico'), { title: 'Mudou' }));
      await assertFails(deleteDoc(ref(como(quem), 'docs', 'publico')));
      await assertFails(setDoc(ref(como(quem), 'seq', 'docs'), { club_id: CLUBE, counters: {} }));
    }
  });

  it('3. o público lê só o público; o "só associados" é do membro do clube', async () => {
    await assertSucceeds(getDoc(ref(como(ZE), 'docs', 'publico')));
    await assertFails(getDoc(ref(como(ZE), 'docs', 'associados')));
    await assertSucceeds(getDoc(ref(como(MEMBRO), 'docs', 'associados')));
    await assertSucceeds(getDoc(ref(como(MEMBRO), 'docs', 'publico')));
    await assertFails(getDoc(ref(como(MEMBRO), 'docs', 'equipe')));
    await semear({ publicado: false });
    await assertFails(getDoc(ref(como(ZE), 'docs', 'publico'))); // associação fechada ao público
    await assertSucceeds(getDoc(ref(como(MEMBRO), 'docs', 'publico'))); // o membro segue lendo
  });

  it('4. a CONSULTA por pub e por members é provável; a sem filtro não', async () => {
    const pub = await assertSucceeds(getDocs(query(collection(como(ZE), 'club_x', CLUBE, 'docs'), where('pub', '==', true))));
    if (pub.size !== 1) throw new Error(`esperava 1 documento público, veio ${pub.size}`);
    const membros = await assertSucceeds(getDocs(query(collection(como(MEMBRO), 'club_x', CLUBE, 'docs'), where('members', '==', true))));
    if (membros.size !== 2) throw new Error(`esperava 2 documentos para o membro, veio ${membros.size}`);
    await assertFails(getDocs(query(collection(como(ZE), 'club_x', CLUBE, 'docs'), where('members', '==', true))));
    await assertFails(getDocs(collection(como(ZE), 'club_x', CLUBE, 'docs')));
    await assertFails(getDocs(collection(como(MEMBRO), 'club_x', CLUBE, 'docs')));
    await assertSucceeds(getDocs(collection(como(SEC), 'club_x', CLUBE, 'docs')));
  });

  it('5. o cargo de quem saiu do clube não lê; o contador é só do servidor', async () => {
    await assertFails(getDoc(ref(como(EX), 'docs', 'rascunho')));
    await assertFails(getDoc(ref(como(SEC), 'seq', 'docs')));
    await assertFails(getDoc(ref(como(ZE), 'seq', 'docs')));
  });
});
