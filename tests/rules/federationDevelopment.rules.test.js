/**
 * Regras da REDE E DESENVOLVIMENTO (rodada 3, Bloco 3, `docs/50` §38):
 *
 *  1. a candidatura de embaixador: lê a própria pessoa, a secretaria e o
 *     admin — competições e qualquer outra pessoa não;
 *  2. o pedido de selo: lê quem gere a organização, a secretaria e o admin;
 *  3. as consultas usadas pelas telas são prováveis;
 *  4. ⭐ ninguém grava pelo navegador, nem o admin (só o servidor), e a lista
 *     pública de embaixadores (`federations.ambassadors_public`) também não.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const PRES = 'pres1';
const SEC = 'sec1';
const COMP = 'comp1';
const ANA = 'ana1';
const GES = 'ges1';
const ZE = 'ze1';
const FED = 'fedA';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-development-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();

beforeEach(async () => {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { federations: true } });
    await setDoc(doc(db, 'federations', FED), { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', published: true, created_by: PRES, modules: { ambassadors: true, club_seal: true, affiliations: true } });
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), { federation_id: FED, user_id: PRES, role: 'president' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${SEC}`), { federation_id: FED, user_id: SEC, role: 'secretary' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${COMP}`), { federation_id: FED, user_id: COMP, role: 'competitions' });
    await setDoc(doc(db, 'arena_managers', `ar1_${GES}`), { arena_id: 'ar1', user_id: GES });
    await setDoc(doc(db, 'federation_ambassadors', `${FED}_${ANA}`), { federation_id: FED, user_id: ANA, status: 'applied', motivation: 'Quero ajudar.' });
    await setDoc(doc(db, 'federation_club_seals', `${FED}_arena_ar1`), { federation_id: FED, kind: 'arena', org_id: 'ar1', applicant_uid: GES, status: 'applied' });
  });
});

describe('leitura', () => {
  it('1. embaixador: a pessoa, a secretaria e o admin; competições e outros não', async () => {
    const ref = (db) => doc(db, 'federation_ambassadors', `${FED}_${ANA}`);
    for (const uid of [ANA, SEC, PRES]) await assertSucceeds(getDoc(ref(como(uid))));
    for (const uid of [COMP, ZE, GES]) await assertFails(getDoc(ref(como(uid))));
    await assertFails(getDoc(ref(testEnv.unauthenticatedContext().firestore())));
  });

  it('2. selo: quem gere a arena, a secretaria e o admin; competições e outros não', async () => {
    const ref = (db) => doc(db, 'federation_club_seals', `${FED}_arena_ar1`);
    for (const uid of [GES, SEC, PRES]) await assertSucceeds(getDoc(ref(como(uid))));
    for (const uid of [COMP, ZE, ANA]) await assertFails(getDoc(ref(como(uid))));
  });

  it('3. as consultas das telas são prováveis', async () => {
    await assertSucceeds(getDocs(query(collection(como(SEC), 'federation_ambassadors'), where('federation_id', '==', FED))));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_ambassadors'), where('user_id', '==', ANA))));
    await assertSucceeds(getDocs(query(collection(como(PRES), 'federation_club_seals'), where('federation_id', '==', FED))));
    await assertSucceeds(getDocs(query(collection(como(GES), 'federation_club_seals'), where('kind', '==', 'arena'), where('org_id', '==', 'ar1'))));
    await assertFails(getDocs(query(collection(como(COMP), 'federation_ambassadors'), where('federation_id', '==', FED))));
  });
});

describe('escrita', () => {
  it('4. ninguém grava pelo navegador, nem o admin; a lista pública também não', async () => {
    await assertFails(setDoc(doc(como(ZE), 'federation_ambassadors', `${FED}_${ZE}`), { federation_id: FED, user_id: ZE, status: 'applied' }));
    await assertFails(updateDoc(doc(como(PRES), 'federation_ambassadors', `${FED}_${ANA}`), { status: 'appointed' }));
    await assertFails(deleteDoc(doc(como(ANA), 'federation_ambassadors', `${FED}_${ANA}`)));
    await assertFails(updateDoc(doc(como(GES), 'federation_club_seals', `${FED}_arena_ar1`), { status: 'granted' }));
    await assertFails(setDoc(doc(como(PRES), 'federation_club_seals', `${FED}_club_c1`), { federation_id: FED, kind: 'club', org_id: 'c1' }));
    await assertFails(updateDoc(doc(como(PRES), 'federations', FED), { ambassadors_public: [{ name: 'Falso' }] }));
    // As regras dos dois programas o admin grava direto (campos que não são de confiança).
    await assertSucceeds(updateDoc(doc(como(PRES), 'federations', FED), { ambassador_rules: { open: false }, club_seal: { open: false } }));
  });

  it('5. o pedido de filiação da organização não traz o selo de carona', async () => {
    const pedido = { federation_id: FED, kind: 'arena', org_id: 'ar1', status: 'pending', requested_by: GES, message: '' };
    const ref = (db) => doc(db, 'federation_affiliations', `${FED}_arena_ar1`);
    await assertFails(setDoc(ref(como(GES)), { ...pedido, seal: { name: 'Falso', valid_until: '2099-01-01' } }));
    await assertSucceeds(setDoc(ref(como(GES)), pedido));
  });
});
