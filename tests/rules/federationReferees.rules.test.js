/**
 * Regras da ARBITRAGEM da federação (`federation_referees`, `federation_assignments`):
 *
 *  1. ⭐ a equipe de arbitragem (`courses`) e o `admin` leem o quadro e as escalas,
 *     inclusive por consulta (é como a Central lista);
 *  2. ⭐ o árbitro lê só o próprio cadastro e as próprias escalas (consulta por
 *     `user_id`/`referee_uid` — é como a Minha área lista);
 *  3. ⭐ outro cargo, outra pessoa e quem não tem conta não leem (valores,
 *     notas e conflitos não são públicos);
 *  4. ⭐ as notas internas (`private/staff`) só a equipe lê — o árbitro não;
 *  5. ⭐ ninguém grava pelo navegador — nem a presidência;
 *  6. ⭐ `federations.referee_rules` está em `fedLocked()`: só o servidor muda.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const PRES = 'pres1';
const ARB = 'arb1';
const TES = 'tes1';
const ANA = 'ana1';
const ZE = 'ze1';
const FED = 'fedA';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-referees-test',
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
    await setDoc(doc(db, 'federations', FED), { name: 'Federação Gaúcha', acronym: 'FGP', status: 'approved', published: true, created_by: PRES, modules: { referees: true } });
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), { federation_id: FED, user_id: PRES, role: 'president' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${ARB}`), { federation_id: FED, user_id: ARB, role: 'referees' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${TES}`), { federation_id: FED, user_id: TES, role: 'treasurer' });
    await setDoc(doc(db, 'federation_referees', `${FED}_${ANA}`), { federation_id: FED, user_id: ANA, name: 'Ana', level: 'l1', status: 'active' });
    await setDoc(doc(db, 'federation_referees', `${FED}_${ANA}`, 'private', 'staff'), { notes: 'Nota interna' });
    await setDoc(doc(db, 'federation_assignments', 'a1'), { federation_id: FED, referee_uid: ANA, status: 'invited', fee_cents: 15000 });
  });
});

const quadro = (db) => getDocs(query(collection(db, 'federation_referees'), where('federation_id', '==', FED)));
const escalas = (db) => getDocs(query(collection(db, 'federation_assignments'), where('federation_id', '==', FED)));

describe('arbitragem: leitura', () => {
  it('1. a equipe de arbitragem e o admin leem, também por consulta', async () => {
    for (const uid of [ARB, PRES]) {
      await assertSucceeds(quadro(como(uid)));
      await assertSucceeds(escalas(como(uid)));
      await assertSucceeds(getDoc(doc(como(uid), 'federation_assignments', 'a1')));
    }
  });

  it('2. o árbitro lê o próprio cadastro e as próprias escalas', async () => {
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_referees'), where('user_id', '==', ANA))));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_assignments'), where('referee_uid', '==', ANA))));
    await assertFails(escalas(como(ANA)));
  });

  it('3. outro cargo, outra pessoa e sem conta não leem', async () => {
    for (const db of [como(TES), como(ZE), anonimo()]) {
      await assertFails(getDoc(doc(db, 'federation_referees', `${FED}_${ANA}`)));
      await assertFails(getDoc(doc(db, 'federation_assignments', 'a1')));
    }
    await assertFails(quadro(como(TES)));
  });

  it('4. as notas internas só a equipe lê', async () => {
    await assertSucceeds(getDoc(doc(como(ARB), 'federation_referees', `${FED}_${ANA}`, 'private', 'staff')));
    await assertFails(getDoc(doc(como(ANA), 'federation_referees', `${FED}_${ANA}`, 'private', 'staff')));
  });
});

describe('arbitragem: escrita', () => {
  it('5. ninguém grava pelo navegador', async () => {
    await assertFails(setDoc(doc(como(PRES), 'federation_referees', `${FED}_${ZE}`), { federation_id: FED, user_id: ZE }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_referees', `${FED}_${ANA}`), { public_listing: true }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_assignments', 'a1'), { status: 'confirmed' }));
    await assertFails(setDoc(doc(como(ARB), 'federation_assignments', 'a2'), { federation_id: FED, referee_uid: ANA }));
    await assertFails(setDoc(doc(como(ARB), 'federation_referees', `${FED}_${ANA}`, 'private', 'staff'), { notes: 'x' }));
  });

  it('6. as regras da arbitragem (`federations.referee_rules`) só pelo servidor', async () => {
    await assertSucceeds(updateDoc(doc(como(PRES), 'federations', FED), { description: 'Nova descrição' }));
    await assertFails(updateDoc(doc(como(PRES), 'federations', FED), { referee_rules: { respond_days: 5 } }));
  });
});
