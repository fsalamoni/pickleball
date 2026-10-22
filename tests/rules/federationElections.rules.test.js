/**
 * Regras das ELEIÇÕES da federação:
 *
 *  1. ⭐ ninguém grava pelo navegador (edital, chapa, eleitor, apoio, cédula)
 *     — nem a presidência; tudo passa por `federationElections`;
 *  2. edital e chapa ACEITA são públicos (com o módulo ligado e a federação
 *     publicada); rascunho e chapa em análise só comissão, admin e a própria
 *     chapa;
 *  3. o eleitor do colégio: só ele mesmo e a COMISSÃO leem (a comissão vê
 *     quem votou, nunca em quem — a cédula não tem uid);
 *  4. ⭐ a CÉDULA ninguém lê, nem a comissão, nem o admin;
 *  5. sem comissão nomeada, o admin da federação conduz.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const PRES = 'pres1';
const COM = 'com1';
const ANA = 'ana1';
const ZE = 'ze1';
const FED = 'fedA';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-elections-test',
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
    await setDoc(doc(db, 'federations', FED), { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', published: true, created_by: PRES, modules: { elections: true } });
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), { federation_id: FED, user_id: PRES, role: 'president' });
    await setDoc(doc(db, 'federation_elections', 'e1'), { federation_id: FED, title: 'Eleições', status: 'published', public: true, commission_uids: [COM] });
    await setDoc(doc(db, 'federation_elections', 'e2'), { federation_id: FED, title: 'Rascunho', status: 'draft', public: false, commission_uids: [] });
    await setDoc(doc(db, 'federation_candidacies', 'aceita'), { federation_id: FED, election_id: 'e1', status: 'accepted', public: true, member_uids: [ANA], submitted_by: ANA });
    await setDoc(doc(db, 'federation_candidacies', 'analise'), { federation_id: FED, election_id: 'e1', status: 'submitted', public: false, member_uids: [ANA], submitted_by: ANA });
    await setDoc(doc(db, 'federation_candidacies', 'semcom'), { federation_id: FED, election_id: 'e2', status: 'submitted', public: false, member_uids: ['x'], submitted_by: 'x' });
    await setDoc(doc(db, 'federation_election_voters', `e1_${ANA}`), { federation_id: FED, election_id: 'e1', user_id: ANA, weight: 1, voted_at_ms: 5, receipt: 'AB12' });
    await setDoc(doc(db, 'federation_election_endorsements', `e1_c1_${ANA}`), { federation_id: FED, election_id: 'e1', user_id: ANA, candidacy_id: 'x' });
    await setDoc(doc(db, 'federation_ballots', 'f00d'), { election_id: 'e1', choices: { c1: 'aceita' }, weight: 1 });
  });
});

describe('eleições: leitura', () => {
  it('2. edital e chapa aceita públicos; o resto não', async () => {
    await assertSucceeds(getDoc(doc(anonimo(), 'federation_elections', 'e1')));
    await assertSucceeds(getDocs(query(collection(como(ZE), 'federation_elections'), where('federation_id', '==', FED), where('public', '==', true))));
    await assertFails(getDoc(doc(como(ZE), 'federation_elections', 'e2')));
    await assertSucceeds(getDocs(query(collection(como(ZE), 'federation_candidacies'), where('federation_id', '==', FED), where('election_id', '==', 'e1'), where('public', '==', true))));
    await assertFails(getDoc(doc(como(ZE), 'federation_candidacies', 'analise')));
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_candidacies', 'analise')));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_candidacies'), where('member_uids', 'array-contains', ANA))));
  });

  it('2b. módulo desligado tira o edital do público', async () => {
    await semRegras((db) => updateDoc(doc(db, 'federations', FED), { modules: {} }));
    await assertFails(getDoc(doc(como(ZE), 'federation_elections', 'e1')));
  });

  it('comissão e admin leem tudo da eleição; a comissão encontra as suas', async () => {
    await assertSucceeds(getDocs(query(collection(como(COM), 'federation_elections'), where('commission_uids', 'array-contains', COM))));
    await assertSucceeds(getDocs(query(collection(como(PRES), 'federation_elections'), where('federation_id', '==', FED))));
    await assertSucceeds(getDocs(query(collection(como(COM), 'federation_candidacies'), where('federation_id', '==', FED), where('election_id', '==', 'e1'))));
    await assertFails(getDocs(query(collection(como(ZE), 'federation_candidacies'), where('federation_id', '==', FED), where('election_id', '==', 'e1'))));
  });

  it('3. eleitor: ele mesmo e a comissão; ninguém mais', async () => {
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_election_voters'), where('user_id', '==', ANA))));
    await assertSucceeds(getDocs(query(collection(como(COM), 'federation_election_voters'), where('federation_id', '==', FED), where('election_id', '==', 'e1'))));
    await assertFails(getDoc(doc(como(ZE), 'federation_election_voters', `e1_${ANA}`)));
    await assertFails(getDoc(doc(como(PRES), 'federation_election_voters', `e1_${ANA}`)));
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_election_endorsements', `e1_c1_${ANA}`)));
    await assertFails(getDoc(doc(como(PRES), 'federation_election_endorsements', `e1_c1_${ANA}`)));
  });

  it('4. a cédula ninguém lê', async () => {
    for (const uid of [ANA, COM, PRES]) {
      await assertFails(getDoc(doc(como(uid), 'federation_ballots', 'f00d')));
      await assertFails(getDocs(query(collection(como(uid), 'federation_ballots'), where('election_id', '==', 'e1'))));
    }
  });

  it('5. sem comissão, o admin conduz', async () => {
    await assertSucceeds(getDoc(doc(como(PRES), 'federation_candidacies', 'semcom')));
    await assertFails(getDoc(doc(como(COM), 'federation_candidacies', 'semcom')));
  });
});

describe('eleições: escrita', () => {
  it('1. ninguém grava pelo navegador', async () => {
    await assertFails(setDoc(doc(como(PRES), 'federation_elections', 'novo'), { federation_id: FED, title: 'x' }));
    await assertFails(updateDoc(doc(como(COM), 'federation_elections', 'e1'), { status: 'voting' }));
    await assertFails(setDoc(doc(como(ANA), 'federation_candidacies', 'nova'), { federation_id: FED, election_id: 'e1', member_uids: [ANA] }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_election_voters', `e1_${ANA}`), { voted_at_ms: 9 }));
    await assertFails(setDoc(doc(como(ANA), 'federation_ballots', 'x'), { election_id: 'e1', choices: {}, weight: 6 }));
    await assertFails(setDoc(doc(como(ANA), 'federation_election_endorsements', `e1_c1_${ZE}`), { user_id: ANA }));
  });
});
