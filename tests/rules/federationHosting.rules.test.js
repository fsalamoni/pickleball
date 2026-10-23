/**
 * Regras de SEDES E COPA (rodada 3, Bloco 3, `docs/50` §39):
 *
 *  1. o edital de sede: o rascunho só competições/admin; publicado, todos;
 *  2. a candidatura: quem gere a organização e a equipe; as notas só a equipe;
 *  3. a Copa: rascunho só a equipe da confederação; o elenco, as equipes da
 *     confederação e da estadual — e mais ninguém;
 *  4. as consultas das telas são prováveis;
 *  5. ⭐ ninguém grava pelo navegador, nem o admin (só o servidor).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const PRES = 'pres1';
const COMP = 'comp1';
const SEC = 'sec1';
const GES = 'ges1';
const ZE = 'ze1';
const CPRES = 'cpres1';
const FED = 'fedA';
const CONF = 'confB';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-hosting-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const anonimo = () => testEnv.unauthenticatedContext().firestore();

beforeEach(async () => {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { federations: true } });
    await setDoc(doc(db, 'federations', FED), { name: 'Federação Gaúcha', status: 'approved', published: true, created_by: PRES, modules: { host_bids: true } });
    await setDoc(doc(db, 'federations', CONF), { name: 'Confederação', status: 'approved', published: true, confederation: true, created_by: CPRES, modules: { federation_cup: true } });
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), { federation_id: FED, user_id: PRES, role: 'president' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${COMP}`), { federation_id: FED, user_id: COMP, role: 'competitions' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${SEC}`), { federation_id: FED, user_id: SEC, role: 'secretary' });
    await setDoc(doc(db, 'federation_staff', `${CONF}_${CPRES}`), { federation_id: CONF, user_id: CPRES, role: 'president' });
    await setDoc(doc(db, 'arena_managers', `ar1_${GES}`), { arena_id: 'ar1', user_id: GES });
    await setDoc(doc(db, 'federation_host_bids', 'pub'), { federation_id: FED, status: 'intent', title: 'Sede' });
    await setDoc(doc(db, 'federation_host_bids', 'rasc'), { federation_id: FED, status: 'draft', title: 'Rascunho' });
    await setDoc(doc(db, 'federation_host_entries', 'pub_arena_ar1'), { federation_id: FED, bid_id: 'pub', kind: 'arena', org_id: 'ar1', applicant_uid: GES, stage: 'intent' });
    await setDoc(doc(db, 'federation_host_scores', `pub_arena_ar1_${COMP}`), { federation_id: FED, bid_id: 'pub', entry_id: 'pub_arena_ar1', evaluator_uid: COMP });
    await setDoc(doc(db, 'federation_cups', 'copa'), { federation_id: CONF, status: 'open', title: 'Copa' });
    await setDoc(doc(db, 'federation_cups', 'copa-rasc'), { federation_id: CONF, status: 'draft', title: 'Copa rascunho' });
    await setDoc(doc(db, 'federation_cup_teams', `copa_${FED}`), { cup_id: 'copa', conf_id: CONF, federation_id: FED, status: 'draft', athletes: [], athlete_uids: ['ana1'] });
  });
});

describe('leitura', () => {
  it('1. edital: rascunho só competições/admin; publicado, qualquer pessoa', async () => {
    for (const db of [como(ZE), anonimo(), como(SEC)]) await assertSucceeds(getDoc(doc(db, 'federation_host_bids', 'pub')));
    for (const uid of [COMP, PRES]) await assertSucceeds(getDoc(doc(como(uid), 'federation_host_bids', 'rasc')));
    for (const uid of [SEC, ZE, GES]) await assertFails(getDoc(doc(como(uid), 'federation_host_bids', 'rasc')));
  });

  it('2. candidatura: quem gere e a equipe; notas só a equipe', async () => {
    for (const uid of [GES, COMP, PRES]) await assertSucceeds(getDoc(doc(como(uid), 'federation_host_entries', 'pub_arena_ar1')));
    for (const uid of [SEC, ZE]) await assertFails(getDoc(doc(como(uid), 'federation_host_entries', 'pub_arena_ar1')));
    await assertSucceeds(getDoc(doc(como(PRES), 'federation_host_scores', `pub_arena_ar1_${COMP}`)));
    for (const uid of [GES, SEC, ZE]) await assertFails(getDoc(doc(como(uid), 'federation_host_scores', `pub_arena_ar1_${COMP}`)));
  });

  it('3. Copa: rascunho só a confederação; elenco só as duas equipes', async () => {
    await assertSucceeds(getDoc(doc(anonimo(), 'federation_cups', 'copa')));
    await assertSucceeds(getDoc(doc(como(CPRES), 'federation_cups', 'copa-rasc')));
    await assertFails(getDoc(doc(como(PRES), 'federation_cups', 'copa-rasc')));
    for (const uid of [CPRES, COMP, PRES, 'ana1']) await assertSucceeds(getDoc(doc(como(uid), 'federation_cup_teams', `copa_${FED}`)));
    await assertSucceeds(getDocs(query(collection(como('ana1'), 'federation_cup_teams'), where('athlete_uids', 'array-contains', 'ana1'))));
    await assertFails(getDoc(doc(anonimo(), 'federation_cup_teams', `copa_${FED}`)));
    for (const uid of [SEC, ZE]) await assertFails(getDoc(doc(como(uid), 'federation_cup_teams', `copa_${FED}`)));
  });

  it('4. as consultas das telas são prováveis', async () => {
    await assertSucceeds(getDocs(query(collection(como(COMP), 'federation_host_bids'), where('federation_id', '==', FED))));
    await assertSucceeds(getDocs(query(collection(anonimo(), 'federation_host_bids'), where('federation_id', '==', FED), where('status', 'in', ['intent', 'proposal', 'review', 'result', 'cancelled']))));
    await assertFails(getDocs(query(collection(como(ZE), 'federation_host_bids'), where('federation_id', '==', FED))));
    await assertSucceeds(getDocs(query(collection(como(COMP), 'federation_host_entries'), where('bid_id', '==', 'pub'), where('federation_id', '==', FED))));
    await assertSucceeds(getDocs(query(collection(como(GES), 'federation_host_entries'), where('kind', '==', 'arena'), where('org_id', '==', 'ar1'))));
    await assertSucceeds(getDocs(query(collection(como(COMP), 'federation_host_scores'), where('bid_id', '==', 'pub'), where('federation_id', '==', FED))));
    await assertSucceeds(getDocs(query(collection(como(CPRES), 'federation_cups'), where('federation_id', '==', CONF))));
    await assertSucceeds(getDocs(query(collection(como(ZE), 'federation_cups'), where('federation_id', '==', CONF), where('status', 'in', ['open', 'closed', 'cancelled']))));
    await assertSucceeds(getDocs(query(collection(como(CPRES), 'federation_cup_teams'), where('conf_id', '==', CONF))));
    await assertSucceeds(getDocs(query(collection(como(COMP), 'federation_cup_teams'), where('federation_id', '==', FED))));
  });
});

describe('escrita', () => {
  it('5. ninguém grava pelo navegador, nem o admin', async () => {
    await assertFails(setDoc(doc(como(PRES), 'federation_host_bids', 'novo'), { federation_id: FED, status: 'draft' }));
    await assertFails(updateDoc(doc(como(PRES), 'federation_host_bids', 'pub'), { status: 'result' }));
    await assertFails(setDoc(doc(como(GES), 'federation_host_entries', 'pub_arena_ar1'), { federation_id: FED, kind: 'arena', org_id: 'ar1', stage: 'winner' }));
    await assertFails(setDoc(doc(como(COMP), 'federation_host_scores', `pub_arena_ar1_${PRES}`), { federation_id: FED, evaluator_uid: PRES }));
    await assertFails(updateDoc(doc(como(CPRES), 'federation_cups', 'copa'), { status: 'closed' }));
    await assertFails(updateDoc(doc(como(COMP), 'federation_cup_teams', `copa_${FED}`), { status: 'approved' }));
  });
});
