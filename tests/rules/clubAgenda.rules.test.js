/**
 * Regras da AGENDA OFICIAL do clube-associação (`club_x/{clube}/events`, Bloco D2b):
 *
 *  1. a secretaria (`docs`), a diretoria esportiva (`sports`) e a administração leem
 *     tudo, o "só a equipe" inclusive; a comunicação, o associado comum e o estranho não;
 *  2. NINGUÉM grava pelo navegador — a escrita é do servidor (`functions/clubAgenda.js`);
 *  3. o público lê só `pub == true`, com a associação aberta; o "só associados"
 *     (`members == true`) só o membro do clube lê;
 *  4. as CONSULTAS por `pub` e por `members` são prováveis para a regra; a sem filtro
 *     só a equipe da agenda faz;
 *  5. o cargo de quem saiu do clube não lê.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const CLUBE = 'clubA';
const PRES = 'pres1';
const SEC = 'sec1';
const ESP = 'esp1';
const COM = 'com1';
const MEMBRO = 'membro1';
const EX = 'ex1';
const ZE = 'ze1';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-club-agenda-test',
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
    await Promise.all([SEC, ESP, COM, MEMBRO, EX].map((u) => setDoc(doc(db, 'club_members', `${CLUBE}_${u}`), { club_id: CLUBE, user_id: u, role: 'member' })));
    await setDoc(ref(db, 'staff', SEC), { user_id: SEC, perms: ['docs'], term_end_ms: 0 });
    await setDoc(ref(db, 'staff', ESP), { user_id: ESP, perms: ['sports'], term_end_ms: 0 });
    await setDoc(ref(db, 'staff', COM), { user_id: COM, perms: ['comms'], term_end_ms: 0 });
    await setDoc(ref(db, 'staff', EX), { user_id: EX, perms: ['docs'], term_end_ms: 0 });
    await setDoc(ref(db, 'events', 'publico'), { club_id: CLUBE, visibility: 'public', pub: true, members: true });
    await setDoc(ref(db, 'events', 'associados'), { club_id: CLUBE, visibility: 'members', pub: false, members: true });
    await setDoc(ref(db, 'events', 'equipe'), { club_id: CLUBE, visibility: 'staff', pub: false, members: false });
  });
  // Quem saiu do clube perde o poder do cargo (o cargo só vale para membro).
  await semRegras(async (db) => { await deleteDoc(doc(db, 'club_members', `${CLUBE}_${EX}`)); });
}

describe('agenda do clube nas regras', () => {
  beforeEach(() => semear());

  it('1. secretaria, diretoria esportiva e administração leem tudo; comunicação, associado e estranho não leem "só a equipe"', async () => {
    for (const id of ['publico', 'associados', 'equipe']) {
      for (const quem of [PRES, SEC, ESP]) await assertSucceeds(getDoc(ref(como(quem), 'events', id)));
    }
    for (const quem of [COM, MEMBRO, ZE]) await assertFails(getDoc(ref(como(quem), 'events', 'equipe')));
  });

  it('2. ninguém grava pelo navegador, nem a administração nem a secretaria', async () => {
    for (const quem of [PRES, SEC, ESP]) {
      await assertFails(setDoc(ref(como(quem), 'events', 'novo'), { club_id: CLUBE, visibility: 'public', pub: true, members: true }));
      await assertFails(updateDoc(ref(como(quem), 'events', 'publico'), { title: 'Mudou' }));
      await assertFails(deleteDoc(ref(como(quem), 'events', 'publico')));
    }
  });

  it('3. o público lê só o público; o "só associados" é do membro do clube', async () => {
    await assertSucceeds(getDoc(ref(como(ZE), 'events', 'publico')));
    await assertFails(getDoc(ref(como(ZE), 'events', 'associados')));
    await assertSucceeds(getDoc(ref(como(MEMBRO), 'events', 'associados')));
    await assertSucceeds(getDoc(ref(como(MEMBRO), 'events', 'publico')));
    await assertFails(getDoc(ref(como(MEMBRO), 'events', 'equipe')));
    await semear({ publicado: false });
    await assertFails(getDoc(ref(como(ZE), 'events', 'publico'))); // associação fechada ao público
    await assertSucceeds(getDoc(ref(como(MEMBRO), 'events', 'publico'))); // o membro segue lendo
  });

  it('4. a CONSULTA por pub e por members é provável; a sem filtro só a equipe da agenda faz', async () => {
    const pub = await assertSucceeds(getDocs(query(collection(como(ZE), 'club_x', CLUBE, 'events'), where('pub', '==', true))));
    if (pub.size !== 1) throw new Error(`esperava 1 evento público, veio ${pub.size}`);
    const membros = await assertSucceeds(getDocs(query(collection(como(MEMBRO), 'club_x', CLUBE, 'events'), where('members', '==', true))));
    if (membros.size !== 2) throw new Error(`esperava 2 eventos para o membro, veio ${membros.size}`);
    await assertFails(getDocs(query(collection(como(ZE), 'club_x', CLUBE, 'events'), where('members', '==', true))));
    await assertFails(getDocs(collection(como(ZE), 'club_x', CLUBE, 'events')));
    await assertFails(getDocs(collection(como(MEMBRO), 'club_x', CLUBE, 'events')));
    await assertFails(getDocs(collection(como(COM), 'club_x', CLUBE, 'events')));
    for (const quem of [SEC, ESP, PRES]) await assertSucceeds(getDocs(collection(como(quem), 'club_x', CLUBE, 'events')));
  });

  it('5. o cargo de quem saiu do clube não lê', async () => {
    await assertFails(getDoc(ref(como(EX), 'events', 'equipe')));
  });
});
