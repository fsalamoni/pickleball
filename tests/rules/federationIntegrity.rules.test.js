/**
 * Regras do JOGO LIMPO (rodada 3, Bloco 1, `docs/50` §36):
 *
 *  1. ⭐ a lista de equipamentos é pública com o módulo ligado e a federação
 *     publicada — qualquer pessoa, até sem conta, consulta por `federation_id`
 *     (é assim que a estadual mostra a lista da confederação);
 *  2. módulo desligado ou federação oculta: só a equipe de competições e o
 *     admin;
 *  3. ⭐ ninguém grava pelo navegador, nem o admin (só o servidor);
 *  4. o curso de antidopagem (ADEL) é um tipo de curso aceito.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const PRES = 'pres1';
const COMP = 'comp1';
const TES = 'tes1';
const ZE = 'ze1';
const FED = 'fedA';
const OCULTA = 'fedB';
const SEM = 'fedC';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-integrity-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const anonimo = () => testEnv.unauthenticatedContext().firestore();
const lista = (db, fed) => getDocs(query(collection(db, 'federation_equipment'), where('federation_id', '==', fed)));

beforeEach(async () => {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { federations: true } });
    const base = { acronym: 'F', status: 'approved', created_by: PRES };
    await setDoc(doc(db, 'federations', FED), { ...base, name: 'Confederação', slug: 'cbp', published: true, modules: { equipment: true, courses: true } });
    await setDoc(doc(db, 'federations', OCULTA), { ...base, name: 'Oculta', slug: 'ocu', published: false, modules: { equipment: true } });
    await setDoc(doc(db, 'federations', SEM), { ...base, name: 'Sem módulo', slug: 'sem', published: true, modules: {} });
    for (const fed of [FED, OCULTA, SEM]) {
      await setDoc(doc(db, 'federation_staff', `${fed}_${PRES}`), { federation_id: fed, user_id: PRES, role: 'president' });
      await setDoc(doc(db, 'federation_staff', `${fed}_${COMP}`), { federation_id: fed, user_id: COMP, role: 'competitions' });
      await setDoc(doc(db, 'federation_staff', `${fed}_${TES}`), { federation_id: fed, user_id: TES, role: 'treasurer' });
      await setDoc(doc(db, 'federation_equipment', `e_${fed}`), { federation_id: fed, kind: 'paddle', brand: 'Selkirk', model: 'Vanguard', status: 'approved' });
    }
  });
});

describe('lista de equipamentos', () => {
  it('1. pública com o módulo ligado: qualquer pessoa, até sem conta, consulta', async () => {
    for (const db of [anonimo(), como(ZE), como(TES)]) {
      await assertSucceeds(lista(db, FED));
      await assertSucceeds(getDoc(doc(db, 'federation_equipment', `e_${FED}`)));
    }
  });

  it('2. módulo desligado ou federação oculta: só competições e admin', async () => {
    for (const fed of [OCULTA, SEM]) {
      await assertFails(lista(anonimo(), fed));
      await assertFails(lista(como(ZE), fed));
      await assertSucceeds(lista(como(COMP), fed));
      await assertSucceeds(lista(como(PRES), fed));
    }
    // A federação oculta: o financeiro é equipe e vê a cara pública; com o módulo desligado, não.
    await assertSucceeds(lista(como(TES), OCULTA));
    await assertFails(lista(como(TES), SEM));
  });
});

describe('escrita', () => {
  it('3. ninguém grava pelo navegador, nem o admin', async () => {
    await assertFails(updateDoc(doc(como(PRES), 'federation_equipment', `e_${FED}`), { status: 'decertified' }));
    await assertFails(setDoc(doc(como(COMP), 'federation_equipment', 'novo'), { federation_id: FED, brand: 'X', model: 'Y', status: 'approved' }));
  });
});

describe('curso de antidopagem', () => {
  it('4. o tipo ADEL é aceito no curso', async () => {
    await assertSucceeds(setDoc(doc(como(PRES), 'federation_courses', 'c1'), { federation_id: FED, name: 'ADEL dirigentes', kind: 'antidoping', status: 'draft', price_cents: 0 }));
    await assertFails(setDoc(doc(como(PRES), 'federation_courses', 'c2'), { federation_id: FED, name: 'Outro', kind: 'inventado', status: 'draft', price_cents: 0 }));
  });
});
