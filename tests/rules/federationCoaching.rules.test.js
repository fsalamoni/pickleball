/**
 * Regras da LICENÇA DE PROFESSOR e da PROTEÇÃO DE MENORES (Bloco 4):
 *
 *  1. ⭐ licença, selo e registro de proteção: ninguém grava pelo navegador —
 *     nem a presidência (só o servidor, `federationCoaching`);
 *  2. a licença lê o professor e a equipe de cursos (ou o admin); o registro
 *     da proteção lê a pessoa e quem tem `safeguarding` — mais ninguém;
 *  3. o selo é público (o perfil do professor o mostra a qualquer visitante);
 *  4. ⭐ a denúncia de proteção de menor: só com o módulo ligado; a disciplina
 *     NÃO a lê nem a trata (é do responsável pela proteção); as listas das
 *     duas equipes são prováveis pelo `kind`;
 *  5. o admin master tem `safeguarding` mesmo com o cargo gravado antes dela.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { addDoc, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const PRES = 'pres1';
const CUR = 'cur1';
const DISC = 'disc1';
const SGO = 'sgo1';
const ANA = 'ana1';
const ZE = 'ze1';
const FED = 'fedA';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-coaching-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const relato = (kind, extra = {}) => ({ federation_id: FED, kind, status: 'open', body: 'Relato com mais de vinte caracteres.', anonymous: false, reporter_uid: ANA, ...extra });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { federations: true } });
    await setDoc(doc(db, 'federations', FED), { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', published: true, created_by: PRES, modules: { discipline: true, safeguarding: true, coach_licenses: true, courses: true } });
    // Cargo gravado com a lista de permissões ANTIGA (sem `safeguarding`): o master ganha assim mesmo.
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), { federation_id: FED, user_id: PRES, role: 'president', perms: ['admin', 'members'] });
    await setDoc(doc(db, 'federation_staff', `${FED}_${CUR}`), { federation_id: FED, user_id: CUR, role: 'referees' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${DISC}`), { federation_id: FED, user_id: DISC, role: 'discipline' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${SGO}`), { federation_id: FED, user_id: SGO, role: 'custom', perms: ['safeguarding'] });
    await setDoc(doc(db, 'federation_coach_licenses', `${FED}_${ANA}`), { federation_id: FED, user_id: ANA, status: 'active', level: 'l1' });
    await setDoc(doc(db, 'federation_coach_badges', ANA), { user_id: ANA, federation_ids: [FED], badges: [{ federation_id: FED, acronym: 'FGP' }] });
    await setDoc(doc(db, 'federation_safeguarding', `${FED}_${ANA}`), { federation_id: FED, user_id: ANA, background: { status: 'valid', valid_until: '2027-01-01' } });
    await setDoc(doc(db, 'federation_reports', 'rMinor'), relato('minor_protection'));
    await setDoc(doc(db, 'federation_reports', 'rConduct'), relato('conduct'));
  });
});

describe('licença, selo e registro: escrita', () => {
  it('1. ninguém grava pelo navegador, nem a presidência nem o próprio professor', async () => {
    for (const uid of [PRES, CUR, SGO, ANA]) {
      await assertFails(setDoc(doc(como(uid), 'federation_coach_licenses', `${FED}_${ZE}`), { federation_id: FED, user_id: ZE, status: 'active' }));
      await assertFails(updateDoc(doc(como(uid), 'federation_coach_licenses', `${FED}_${ANA}`), { status: 'active', level: 'l3' }));
      await assertFails(setDoc(doc(como(uid), 'federation_coach_badges', uid), { user_id: uid, badges: [] }));
      await assertFails(updateDoc(doc(como(uid), 'federation_safeguarding', `${FED}_${ANA}`), { background: { status: 'valid', valid_until: '2099-01-01' } }));
    }
  });
});

describe('licença, selo e registro: leitura', () => {
  it('2. licença: o professor e cursos/admin; registro: a pessoa e a proteção', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_coach_licenses', `${FED}_${ANA}`)));
    await assertSucceeds(getDoc(doc(como(CUR), 'federation_coach_licenses', `${FED}_${ANA}`)));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_coach_licenses'), where('user_id', '==', ANA))));
    await assertFails(getDoc(doc(como(SGO), 'federation_coach_licenses', `${FED}_${ANA}`)));
    await assertFails(getDoc(doc(como(ZE), 'federation_coach_licenses', `${FED}_${ANA}`)));

    await assertSucceeds(getDoc(doc(como(ANA), 'federation_safeguarding', `${FED}_${ANA}`)));
    await assertSucceeds(getDoc(doc(como(SGO), 'federation_safeguarding', `${FED}_${ANA}`)));
    await assertFails(getDoc(doc(como(CUR), 'federation_safeguarding', `${FED}_${ANA}`)));
    await assertFails(getDoc(doc(como(DISC), 'federation_safeguarding', `${FED}_${ANA}`)));
    await assertFails(getDoc(doc(como(ZE), 'federation_safeguarding', `${FED}_${ANA}`)));
  });

  it('3. o selo é público, inclusive sem conta; a lista por federação é provável', async () => {
    await assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'federation_coach_badges', ANA)));
    await assertSucceeds(getDocs(query(collection(como(ZE), 'federation_coach_badges'), where('federation_ids', 'array-contains', FED))));
  });

  it('5. o master (cargo antigo) tem `safeguarding`', async () => {
    await assertSucceeds(getDoc(doc(como(PRES), 'federation_safeguarding', `${FED}_${ANA}`)));
    await assertSucceeds(getDoc(doc(como(PRES), 'federation_reports', 'rMinor')));
  });
});

describe('denúncia de proteção de menor', () => {
  it('4a. a disciplina não lê nem trata; a proteção lê e trata', async () => {
    await assertFails(getDoc(doc(como(DISC), 'federation_reports', 'rMinor')));
    await assertFails(updateDoc(doc(como(DISC), 'federation_reports', 'rMinor'), { status: 'in_review' }));
    await assertSucceeds(getDoc(doc(como(DISC), 'federation_reports', 'rConduct')));
    await assertSucceeds(getDoc(doc(como(SGO), 'federation_reports', 'rMinor')));
    await assertSucceeds(updateDoc(doc(como(SGO), 'federation_reports', 'rMinor'), { status: 'in_review' }));
    await assertFails(getDoc(doc(como(SGO), 'federation_reports', 'rConduct')));
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_reports', 'rMinor')));
  });

  it('4b. as listas: a disciplina pelos tipos dela, a proteção pelo de menor; sem o filtro, recusa', async () => {
    await assertSucceeds(getDocs(query(collection(como(DISC), 'federation_reports'), where('federation_id', '==', FED), where('kind', 'in', ['conduct', 'referee', 'organization', 'other']))));
    await assertFails(getDocs(query(collection(como(DISC), 'federation_reports'), where('federation_id', '==', FED))));
    await assertSucceeds(getDocs(query(collection(como(SGO), 'federation_reports'), where('federation_id', '==', FED), where('kind', '==', 'minor_protection'))));
    await assertFails(getDocs(query(collection(como(SGO), 'federation_reports'), where('federation_id', '==', FED))));
  });

  it('4c. enviar: só com a proteção ligada', async () => {
    await assertSucceeds(addDoc(collection(como(ZE), 'federation_reports'), relato('minor_protection', { reporter_uid: ZE })));
    await assertSucceeds(addDoc(collection(como(ZE), 'federation_reports'), relato('minor_protection', { anonymous: true, reporter_uid: null })));
    await semRegras((db) => updateDoc(doc(db, 'federations', FED), { 'modules.safeguarding': false }));
    await assertFails(addDoc(collection(como(ZE), 'federation_reports'), relato('minor_protection', { reporter_uid: ZE })));
    await assertSucceeds(addDoc(collection(como(ZE), 'federation_reports'), relato('conduct', { reporter_uid: ZE })));
  });
});
