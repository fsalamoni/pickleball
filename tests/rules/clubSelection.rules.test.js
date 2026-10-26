/**
 * Regras da SELEÇÃO do clube-associação (`club_x/{clube}/callups` e `.../callup_members`, Bloco E3):
 *
 *  1. a convocação ABERTA ou ENCERRADA (`pub`) é pública com a associação publicada; rascunho e
 *     cancelada só a diretoria esportiva e a administração leem; sem a associação publicada nem o
 *     público lê;
 *  2. os convites (`callup_members`) só a diretoria esportiva e a administração leem — nem o
 *     financeiro, nem o convidado (ele vê o que é dele pela função do servidor);
 *  3. NINGUÉM grava pelo navegador — o convite, a trava de proteção e a lista pública são do servidor.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';

const CLUBE = 'clubA';
const PRES = 'pres1';
const ESP = 'esp1';
const FIN = 'fin1';
const ATL = 'atl1';
const ZE = 'ze1';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-club-selection-test',
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
    await Promise.all([ESP, FIN, ATL].map((u) => setDoc(doc(db, 'club_members', `${CLUBE}_${u}`), { club_id: CLUBE, user_id: u, role: 'member' })));
    await setDoc(ref(db, 'staff', ESP), { user_id: ESP, perms: ['sports'], term_end_ms: 0 });
    await setDoc(ref(db, 'staff', FIN), { user_id: FIN, perms: ['finance'], term_end_ms: 0 });
    await setDoc(ref(db, 'callups', 'aberta'), { club_id: CLUBE, title: 'Interclubes', status: 'open', pub: true, roster: [{ key: 'abc', name: 'Ana', role: 'athlete' }] });
    await setDoc(ref(db, 'callups', 'rascunho'), { club_id: CLUBE, title: 'Rascunho', status: 'draft', pub: false, roster: [] });
    await setDoc(ref(db, 'callup_members', 'aberta_atl1'), { club_id: CLUBE, callup_id: 'aberta', user_id: ATL, status: 'invited', uniform_size: 'M' });
  });
}

describe('seleção do clube nas regras', () => {
  beforeEach(() => semear());

  it('1. a convocação pública lê qualquer um; o rascunho só a diretoria esportiva e a administração', async () => {
    for (const quem of [ESP, PRES, FIN, ATL, ZE]) await assertSucceeds(getDoc(ref(como(quem), 'callups', 'aberta')));
    for (const quem of [ESP, PRES]) await assertSucceeds(getDoc(ref(como(quem), 'callups', 'rascunho')));
    for (const quem of [FIN, ATL, ZE]) await assertFails(getDoc(ref(como(quem), 'callups', 'rascunho')));
  });

  it('1b. a consulta pública (pub == true) funciona para quem não é do clube; a lista inteira não', async () => {
    await assertSucceeds(getDocs(query(collection(como(ZE), 'club_x', CLUBE, 'callups'), where('pub', '==', true))));
    await assertFails(getDocs(collection(como(ZE), 'club_x', CLUBE, 'callups')));
    await assertSucceeds(getDocs(collection(como(ESP), 'club_x', CLUBE, 'callups')));
  });

  it('1c. com a associação não publicada o público não lê a convocação', async () => {
    await semear({ publicado: false });
    await assertFails(getDoc(ref(como(ZE), 'callups', 'aberta')));
    await assertSucceeds(getDoc(ref(como(ESP), 'callups', 'aberta')));
  });

  it('2. os convites só a diretoria esportiva e a administração leem — nem o financeiro, nem o convidado', async () => {
    for (const quem of [ESP, PRES]) await assertSucceeds(getDoc(ref(como(quem), 'callup_members', 'aberta_atl1')));
    for (const quem of [FIN, ATL, ZE]) await assertFails(getDoc(ref(como(quem), 'callup_members', 'aberta_atl1')));
    await assertFails(getDocs(collection(como(ATL), 'club_x', CLUBE, 'callup_members')));
  });

  it('3. ninguém grava pelo navegador', async () => {
    for (const quem of [PRES, ESP, ATL]) {
      await assertFails(setDoc(ref(como(quem), 'callups', 'novo'), { club_id: CLUBE, title: 'X', status: 'open', pub: true }));
      await assertFails(updateDoc(ref(como(quem), 'callups', 'aberta'), { title: 'Mudou' }));
      await assertFails(deleteDoc(ref(como(quem), 'callups', 'aberta')));
      await assertFails(setDoc(ref(como(quem), 'callup_members', 'aberta_novo'), { club_id: CLUBE, callup_id: 'aberta', user_id: quem, status: 'accepted' }));
      await assertFails(updateDoc(ref(como(quem), 'callup_members', 'aberta_atl1'), { status: 'accepted' }));
      await assertFails(deleteDoc(ref(como(quem), 'callup_members', 'aberta_atl1')));
    }
  });
});
