/**
 * Regras do PICKLEBALL ADAPTADO (rodada 3, Bloco 4b, `docs/50` §41):
 *
 *  1. ⭐ a classificação (com o caminho do laudo) só o próprio atleta e a
 *     equipe de competições/admin leem — nunca outro filiado, nem o financeiro;
 *  2. a consulta da equipe por `federation_id` é aceita; a de outra pessoa, não;
 *  3. ⭐ ninguém grava pelo navegador, nem o admin (só o servidor);
 *  4. as categorias (`federations.adapted_classes`) só o servidor grava.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const PRES = 'pres1';
const COMP = 'comp1';
const TES = 'tes1';
const ANA = 'ana1';
const ZE = 'ze1';
const FED = 'fedA';
const CLS = `${FED}_${ANA}`;

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-adapted-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const daFed = (db) => getDocs(query(collection(db, 'federation_adapted_classifications'), where('federation_id', '==', FED)));

beforeEach(async () => {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { federations: true } });
    await setDoc(doc(db, 'federations', FED), { name: 'Federação', acronym: 'F', slug: 'f', status: 'approved', created_by: PRES, published: true, modules: { adapted: true } });
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), { federation_id: FED, user_id: PRES, role: 'president' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${COMP}`), { federation_id: FED, user_id: COMP, role: 'competitions' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${TES}`), { federation_id: FED, user_id: TES, role: 'treasurer' });
    await setDoc(doc(db, 'federation_adapted_classifications', CLS), { federation_id: FED, user_id: ANA, status: 'classified', class_id: 'wheelchair', report: { path: `federacao-laudos/${ANA}/x.pdf` } });
  });
});

describe('leitura', () => {
  it('1. o próprio atleta e competições/admin leem; outro filiado e o financeiro, não', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_adapted_classifications', CLS)));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_adapted_classifications'), where('user_id', '==', ANA))));
    await assertSucceeds(getDoc(doc(como(COMP), 'federation_adapted_classifications', CLS)));
    await assertSucceeds(getDoc(doc(como(PRES), 'federation_adapted_classifications', CLS)));
    await assertFails(getDoc(doc(como(ZE), 'federation_adapted_classifications', CLS)));
    await assertFails(getDoc(doc(como(TES), 'federation_adapted_classifications', CLS)));
  });

  it('2. a lista da federação: competições e admin consultam; outros, não', async () => {
    await assertSucceeds(daFed(como(COMP)));
    await assertSucceeds(daFed(como(PRES)));
    await assertFails(daFed(como(ZE)));
    await assertFails(daFed(como(TES)));
  });
});

describe('escrita', () => {
  it('3. ninguém grava a classificação pelo navegador, nem o admin', async () => {
    await assertFails(updateDoc(doc(como(PRES), 'federation_adapted_classifications', CLS), { status: 'revoked' }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_adapted_classifications', CLS), { class_id: 'standing' }));
    await assertFails(setDoc(doc(como(ZE), 'federation_adapted_classifications', `${FED}_${ZE}`), { federation_id: FED, user_id: ZE, status: 'classified', class_id: 'wheelchair' }));
  });

  it('4. as categorias da federação só o servidor grava', async () => {
    await assertSucceeds(updateDoc(doc(como(PRES), 'federations', FED), { about: 'Olá' }));
    await assertFails(updateDoc(doc(como(PRES), 'federations', FED), { adapted_classes: [{ id: 'x', label: 'X' }] }));
  });
});
