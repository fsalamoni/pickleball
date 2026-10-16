/**
 * Regras da LISTA DE ESPERA do professor (`coach_waitlist`, 2026-10-16).
 *
 *  1. ⭐ o aluno entra só com o PRÓPRIO uid, no id `{coachId}_{uid}`, e só na
 *     lista de um professor que existe;
 *  2. ⭐ o aluno não grava o que é do servidor (`notified_at`, `notify_count`)
 *     nem troca de dono ou de professor ao editar;
 *  3. o professor lê a lista dele por consulta e tira alguém dela, mas não
 *     edita a entrada do aluno;
 *  4. quem não é parte não lê nem escreve;
 *  5. ⭐ os horários ocupados (`coach_busy_slots`) todo mundo lê e só o
 *     servidor escreve — nem o professor.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where,
} from 'firebase/firestore';

const PROF = 'prof_uid';
const ANA = 'ana_uid';
const ESTRANHO = 'estranho_uid';

const entrada = (over = {}) => ({
  coach_id: PROF, user_id: ANA, student_name: 'Ana', format: 'private',
  periods: ['noite'], weekdays: [1, 3], note: 'Iniciante', created_at_ms: 1, ...over,
});

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-coach-waitlist-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const uid of [PROF, ANA, ESTRANHO]) await setDoc(doc(db, 'users', uid), { uid, role: 'user' });
    await setDoc(doc(db, 'coaches', PROF), { uid: PROF, display_name: 'Prof. Bia' });
    await setDoc(doc(db, 'coach_waitlist', `${PROF}_${ESTRANHO}`), entrada({ user_id: ESTRANHO, student_name: 'Outro' }));
    await setDoc(doc(db, 'coach_busy_slots', PROF), { coach_id: PROF, slots: [{ date: '2026-10-20', start: '08:00', end: '09:00' }] });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();

describe('coach_waitlist', () => {
  it('⭐ o aluno entra na lista com o próprio uid e o id certo', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'coach_waitlist', `${PROF}_${ANA}`), entrada()));
  });

  it('⭐ não entra por outra pessoa, com id trocado, em professor que não existe ou na própria lista', async () => {
    await assertFails(setDoc(doc(como(ANA), 'coach_waitlist', `${PROF}_${ESTRANHO}`), entrada({ user_id: ESTRANHO })));
    await assertFails(setDoc(doc(como(ANA), 'coach_waitlist', `x_${ANA}`), entrada()));
    await assertFails(setDoc(doc(como(ANA), 'coach_waitlist', `ninguem_${ANA}`), entrada({ coach_id: 'ninguem' })));
    await assertFails(setDoc(doc(como(PROF), 'coach_waitlist', `${PROF}_${PROF}`), entrada({ user_id: PROF })));
  });

  it('⭐ o aluno não grava os campos do servidor', async () => {
    await assertFails(setDoc(doc(como(ANA), 'coach_waitlist', `${PROF}_${ANA}`), entrada({ notified_at: 1 })));
    await assertFails(setDoc(doc(como(ANA), 'coach_waitlist', `${PROF}_${ANA}`), entrada({ notify_count: 3 })));
    await assertFails(setDoc(doc(como(ANA), 'coach_waitlist', `${PROF}_${ANA}`), entrada({ note: 'x'.repeat(501) })));
  });

  it('o aluno edita só as preferências da própria entrada', async () => {
    await setDoc(doc(como(ANA), 'coach_waitlist', `${PROF}_${ANA}`), entrada());
    const ref = doc(como(ANA), 'coach_waitlist', `${PROF}_${ANA}`);
    await assertSucceeds(updateDoc(ref, { note: 'Prefiro de manhã', periods: ['manha'] }));
    await assertFails(updateDoc(ref, { notified_at: 5 }));
    await assertFails(updateDoc(ref, { coach_id: 'outro' }));
    await assertFails(updateDoc(doc(como(ANA), 'coach_waitlist', `${PROF}_${ESTRANHO}`), { note: 'oi' }));
  });

  it('o professor lê a lista dele por consulta e tira alguém, mas não edita', async () => {
    await assertSucceeds(getDocs(query(collection(como(PROF), 'coach_waitlist'), where('coach_id', '==', PROF))));
    await assertFails(updateDoc(doc(como(PROF), 'coach_waitlist', `${PROF}_${ESTRANHO}`), { note: 'mudei' }));
    await assertSucceeds(deleteDoc(doc(como(PROF), 'coach_waitlist', `${PROF}_${ESTRANHO}`)));
  });

  it('o aluno lê as próprias listas e sai; estranho não lê nem apaga a lista alheia', async () => {
    await setDoc(doc(como(ANA), 'coach_waitlist', `${PROF}_${ANA}`), entrada());
    await assertSucceeds(getDocs(query(collection(como(ANA), 'coach_waitlist'), where('user_id', '==', ANA))));
    await assertFails(getDocs(query(collection(como(ANA), 'coach_waitlist'), where('coach_id', '==', PROF))));
    await assertFails(deleteDoc(doc(como(ANA), 'coach_waitlist', `${PROF}_${ESTRANHO}`)));
    await assertSucceeds(deleteDoc(doc(como(ANA), 'coach_waitlist', `${PROF}_${ANA}`)));
  });

  it('⭐ horários ocupados: qualquer conta (e visitante) lê; ninguém escreve pelo app', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'coach_busy_slots', PROF)));
    await assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'coach_busy_slots', PROF)));
    await assertFails(setDoc(doc(como(PROF), 'coach_busy_slots', PROF), { slots: [] }));
    await assertFails(setDoc(doc(como(ANA), 'coach_busy_slots', PROF), { slots: [] }));
  });
});
