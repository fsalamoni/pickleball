/**
 * Regras do COFRE DE CERTIDÕES e dos PROJETOS DA LEI DE INCENTIVO (rodada 3,
 * Bloco 2, `docs/50` §37):
 *
 *  1. lê o financeiro, o admin e o conselho fiscal — competições e qualquer
 *     outra pessoa não; a consulta por `federation_id` é provável;
 *  2. ⭐ ninguém grava pelo navegador, nem o admin (só o servidor).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const PRES = 'pres1';
const COMP = 'comp1';
const TES = 'tes1';
const FIS = 'fis1';
const ZE = 'ze1';
const FED = 'fedA';
const COLS = { federation_certificates: 'c1', federation_incentive_projects: 'p1' };

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-institutional-test',
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
    await setDoc(doc(db, 'federations', FED), { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', published: true, created_by: PRES, modules: { certificates: true, incentive_projects: true } });
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), { federation_id: FED, user_id: PRES, role: 'president' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${COMP}`), { federation_id: FED, user_id: COMP, role: 'competitions' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${TES}`), { federation_id: FED, user_id: TES, role: 'treasurer' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${FIS}`), { federation_id: FED, user_id: FIS, role: 'custom', perms: ['fiscal'] });
    await setDoc(doc(db, 'federation_certificates', 'c1'), { federation_id: FED, kind: 'fgts', valid_until: '2027-01-01' });
    await setDoc(doc(db, 'federation_incentive_projects', 'p1'), { federation_id: FED, status: 'capturing', title: 'Escolas', receipts: [] });
  });
});

describe('leitura', () => {
  it('1. financeiro, admin e conselho fiscal leem; competições, outros e anônimo não', async () => {
    for (const [col, id] of Object.entries(COLS)) {
      for (const uid of [PRES, TES, FIS]) {
        await assertSucceeds(getDoc(doc(como(uid), col, id)));
        await assertSucceeds(getDocs(query(collection(como(uid), col), where('federation_id', '==', FED))));
      }
      await assertFails(getDoc(doc(como(COMP), col, id)));
      await assertFails(getDocs(query(collection(como(COMP), col), where('federation_id', '==', FED))));
      await assertFails(getDoc(doc(como(ZE), col, id)));
      await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), col, id)));
    }
  });
});

describe('escrita', () => {
  it('2. ninguém grava pelo navegador, nem o admin', async () => {
    for (const [col, id] of Object.entries(COLS)) {
      await assertFails(updateDoc(doc(como(PRES), col, id), { title: 'Outro', valid_until: '2030-01-01' }));
      await assertFails(setDoc(doc(como(TES), col, `${id}x`), { federation_id: FED, title: 'X' }));
      await assertFails(deleteDoc(doc(como(PRES), col, id)));
    }
  });
});
