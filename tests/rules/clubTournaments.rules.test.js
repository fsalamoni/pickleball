/**
 * Regras do TORNEIO DO CLUBE (`tournaments.club_id`, Bloco E3b):
 *
 *  1. marcar o torneio com um clube (na criação ou depois) só a administração do clube e a
 *     diretoria esportiva (`sports`), com a flag `club_association` ligada — qualquer outra conta
 *     (associado comum, financeiro, quem não é do clube) é recusada;
 *  2. torneio sem `club_id` segue como sempre (ninguém é barrado);
 *  3. a lista pública por `club_id ==` funciona para quem não tem conta;
 *  4. quem já tem `club_id` pode editar o resto do torneio sem mexer no selo, e tirar o selo é livre.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteField, collection, getDocs, query, where } from 'firebase/firestore';

const CLUBE = 'clubA';
const PRES = 'pres1';
const ESP = 'esp1';
const FIN = 'fin1';
const ATL = 'atl1';
const ZE = 'ze1';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-club-tournaments-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const anonimo = () => testEnv.unauthenticatedContext().firestore();

async function semear({ flag = true } = {}) {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { club_association: flag } });
    await setDoc(doc(db, 'clubs', CLUBE), { name: 'Clube A', association: { enabled: true, published: true } });
    await setDoc(doc(db, 'club_members', `${CLUBE}_${PRES}`), { club_id: CLUBE, user_id: PRES, role: 'admin' });
    await Promise.all([ESP, FIN, ATL].map((u) => setDoc(doc(db, 'club_members', `${CLUBE}_${u}`), { club_id: CLUBE, user_id: u, role: 'member' })));
    await setDoc(doc(db, 'club_x', CLUBE, 'staff', ESP), { user_id: ESP, perms: ['sports'], term_end_ms: 0 });
    await setDoc(doc(db, 'club_x', CLUBE, 'staff', FIN), { user_id: FIN, perms: ['finance'], term_end_ms: 0 });
    // Um torneio do clube já existente (criado por quem tem a permissão) e um comum.
    await setDoc(doc(db, 'tournaments', 'doClube'), { creator_uid: ESP, name: 'Aberto do Clube', club_id: CLUBE, club_name: 'Clube A', status: 'draft' });
    await setDoc(doc(db, 'tournaments', 'comum'), { creator_uid: ATL, name: 'Comum', status: 'draft' });
  });
}

const novo = (uid, extra = {}) => ({ creator_uid: uid, name: 'Novo', status: 'draft', ...extra });
const ref = (db, id) => doc(db, 'tournaments', id);

describe('torneio do clube nas regras', () => {
  beforeEach(() => semear());

  it('1. criar com o selo do clube: administração e diretoria esportiva sim; os demais não', async () => {
    for (const quem of [PRES, ESP]) await assertSucceeds(setDoc(ref(como(quem), `t_${quem}`), novo(quem, { club_id: CLUBE, club_name: 'Clube A' })));
    for (const quem of [FIN, ATL, ZE]) await assertFails(setDoc(ref(como(quem), `t_${quem}`), novo(quem, { club_id: CLUBE, club_name: 'Clube A' })));
  });

  it('1b. com a flag desligada ninguém marca o torneio com o clube (nem a administração)', async () => {
    await semear({ flag: false });
    await assertFails(setDoc(ref(como(PRES), 't1'), novo(PRES, { club_id: CLUBE })));
    await assertSucceeds(setDoc(ref(como(PRES), 't2'), novo(PRES)));
  });

  it('2. torneio sem clube segue como sempre', async () => {
    for (const quem of [PRES, FIN, ATL, ZE]) await assertSucceeds(setDoc(ref(como(quem), `c_${quem}`), novo(quem)));
  });

  it('1c. depois de criado, pôr o selo em torneio próprio exige a mesma permissão', async () => {
    await assertFails(updateDoc(ref(como(ATL), 'comum'), { club_id: CLUBE, club_name: 'Clube A' }));
    await semRegras((db) => setDoc(ref(db, 'doEsp'), { creator_uid: ESP, name: 'X', status: 'draft' }));
    await assertSucceeds(updateDoc(ref(como(ESP), 'doEsp'), { club_id: CLUBE, club_name: 'Clube A' }));
  });

  it('4. editar o resto do torneio do clube não mexe no selo, e tirar o selo é livre', async () => {
    await assertSucceeds(updateDoc(ref(como(ESP), 'doClube'), { name: 'Aberto do Clube 2027' }));
    await assertSucceeds(updateDoc(ref(como(ESP), 'doClube'), { club_id: deleteField(), club_name: deleteField() }));
  });

  it('4b. quem perdeu a permissão ainda edita o torneio, mas não troca o clube do selo', async () => {
    await semRegras((db) => setDoc(ref(db, 'doFin'), { creator_uid: FIN, name: 'Y', status: 'draft', club_id: CLUBE, club_name: 'Clube A' }));
    await assertSucceeds(updateDoc(ref(como(FIN), 'doFin'), { name: 'Y2' }));
    await assertFails(updateDoc(ref(como(FIN), 'doFin'), { club_name: 'Outro nome' }));
  });

  it('3. a lista pública por club_id funciona sem conta', async () => {
    const snap = await assertSucceeds(getDocs(query(collection(anonimo(), 'tournaments'), where('club_id', '==', CLUBE))));
    if (snap.size !== 1) throw new Error(`esperava 1 torneio do clube, veio ${snap.size}`);
  });
});
