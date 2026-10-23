/**
 * Regras dos CONTRATOS DE PATROCÍNIO e do PATRIMÔNIO (Bloco 5, `docs/50` §34):
 *
 *  1. o contrato lê o financeiro, o admin e o conselho fiscal — competições
 *     e qualquer outra pessoa não; a consulta por `federation_id` é provável;
 *  2. o bem lê também as competições (o material vai aos eventos);
 *  3. ⭐ ninguém grava nada disso pelo navegador (só o servidor).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const PRES = 'pres1';
const COMP = 'comp1';
const TES = 'tes1';
const FIS = 'fis1';
const ZE = 'ze1';
const FED = 'fedA';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-management-test',
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
    await setDoc(doc(db, 'federations', FED), { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', published: true, created_by: PRES, modules: { sponsors: true, assets: true } });
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), { federation_id: FED, user_id: PRES, role: 'president' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${COMP}`), { federation_id: FED, user_id: COMP, role: 'competitions' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${TES}`), { federation_id: FED, user_id: TES, role: 'treasurer' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${FIS}`), { federation_id: FED, user_id: FIS, role: 'custom', perms: ['fiscal'] });
    await setDoc(doc(db, 'federation_sponsor_contracts', 'k1'), { federation_id: FED, status: 'active', sponsor_name: 'Raquetes Sul', total_cents: 100000 });
    await setDoc(doc(db, 'federation_assets', 'a1'), { federation_id: FED, status: 'active', name: 'Rede', quantity: 4, loans: [] });
  });
});

describe('contratos de patrocínio', () => {
  it('1. financeiro, admin e conselho fiscal leem; competições e outros não', async () => {
    for (const uid of [PRES, TES, FIS]) {
      await assertSucceeds(getDoc(doc(como(uid), 'federation_sponsor_contracts', 'k1')));
      await assertSucceeds(getDocs(query(collection(como(uid), 'federation_sponsor_contracts'), where('federation_id', '==', FED))));
    }
    await assertFails(getDoc(doc(como(COMP), 'federation_sponsor_contracts', 'k1')));
    await assertFails(getDoc(doc(como(ZE), 'federation_sponsor_contracts', 'k1')));
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'federation_sponsor_contracts', 'k1')));
  });
});

describe('patrimônio', () => {
  it('2. as competições também leem; outros não', async () => {
    for (const uid of [PRES, TES, FIS, COMP]) {
      await assertSucceeds(getDocs(query(collection(como(uid), 'federation_assets'), where('federation_id', '==', FED))));
    }
    await assertFails(getDoc(doc(como(ZE), 'federation_assets', 'a1')));
  });
});

describe('escrita', () => {
  it('3. ninguém grava pelo navegador, nem o admin', async () => {
    await assertFails(updateDoc(doc(como(PRES), 'federation_sponsor_contracts', 'k1'), { total_cents: 1 }));
    await assertFails(setDoc(doc(como(TES), 'federation_sponsor_contracts', 'k2'), { federation_id: FED, sponsor_name: 'X' }));
    await assertFails(updateDoc(doc(como(COMP), 'federation_assets', 'a1'), { quantity: 9 }));
    await assertFails(setDoc(doc(como(PRES), 'federation_assets', 'a2'), { federation_id: FED, name: 'Placar' }));
  });
});
