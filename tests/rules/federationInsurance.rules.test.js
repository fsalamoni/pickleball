/**
 * Regras do SEGURO (rodada 3, Bloco 5, `docs/50` §42):
 *
 *  1. o certificado de seguro do evento lê quem gere a organização e a equipe
 *     de filiados/admin — nunca outro usuário nem o financeiro;
 *  2. as consultas por organização e por federação são aceitas para quem pode;
 *  3. ⭐ ninguém grava certificado pelo navegador, nem o admin (só o servidor);
 *  4. ⭐ o aceite do termo (`insurance_term`) o filiado não grava sozinho.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const PRES = 'pres1';
const SEC = 'sec1';
const TES = 'tes1';
const GESTOR = 'gestor1';
const ZE = 'ze1';
const ANA = 'ana1';
const FED = 'fedA';
const CERT = 'cert1';
const COL = 'federation_insurance_certificates';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-insurance-test',
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
    await setDoc(doc(db, 'federations', FED), { name: 'Federação', acronym: 'F', slug: 'f', status: 'approved', created_by: PRES, published: true, modules: { insurance: true } });
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), { federation_id: FED, user_id: PRES, role: 'president' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${SEC}`), { federation_id: FED, user_id: SEC, role: 'secretary' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${TES}`), { federation_id: FED, user_id: TES, role: 'treasurer' });
    await setDoc(doc(db, 'club_members', `c1_${GESTOR}`), { club_id: 'c1', user_id: GESTOR, role: 'admin' });
    await setDoc(doc(db, COL, CERT), { federation_id: FED, kind: 'club', org_id: 'c1', status: 'requested', event: { event_name: 'Festival' } });
    await setDoc(doc(db, 'federation_members', `${FED}_${ANA}`), { federation_id: FED, user_id: ANA, status: 'active', tier: 'federated' });
  });
});

describe('leitura', () => {
  it('1. quem gere o clube e a equipe de filiados leem; outro e o financeiro, não', async () => {
    await assertSucceeds(getDoc(doc(como(GESTOR), COL, CERT)));
    await assertSucceeds(getDoc(doc(como(SEC), COL, CERT)));
    await assertSucceeds(getDoc(doc(como(PRES), COL, CERT)));
    await assertFails(getDoc(doc(como(ZE), COL, CERT)));
    await assertFails(getDoc(doc(como(TES), COL, CERT)));
  });

  it('2. as listas: do clube para quem o gere; da federação para a equipe', async () => {
    const doClube = (db) => getDocs(query(collection(db, COL), where('kind', '==', 'club'), where('org_id', '==', 'c1')));
    const daFed = (db) => getDocs(query(collection(db, COL), where('federation_id', '==', FED)));
    await assertSucceeds(doClube(como(GESTOR)));
    await assertFails(doClube(como(ZE)));
    await assertSucceeds(daFed(como(SEC)));
    await assertFails(daFed(como(TES)));
    await assertFails(daFed(como(ZE)));
  });
});

describe('escrita', () => {
  it('3. ninguém grava o certificado pelo navegador, nem o admin', async () => {
    await assertFails(updateDoc(doc(como(PRES), COL, CERT), { status: 'issued' }));
    await assertFails(updateDoc(doc(como(GESTOR), COL, CERT), { status: 'withdrawn' }));
    await assertFails(setDoc(doc(como(GESTOR), COL, 'novo'), { federation_id: FED, kind: 'club', org_id: 'c1', status: 'requested' }));
  });

  it('4. o filiado não grava o próprio aceite do termo', async () => {
    await assertFails(updateDoc(doc(como(ANA), 'federation_members', `${FED}_${ANA}`), { insurance_term: { version: 'x', accepted_at_ms: 1, by: ANA } }));
  });
});
