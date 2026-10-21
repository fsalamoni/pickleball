/**
 * Regras do CALENDÁRIO OFICIAL da federação (`federation_events`):
 *
 *  1. ⭐ evento PÚBLICO: qualquer um lê, até sem conta (a agenda abre fora do app);
 *  2. ⭐ "só filiados": filiado ATIVO e a equipe; filiação parada não lê;
 *  3. ⭐ "só a equipe": qualquer pessoa da equipe (qualquer cargo); filiado não;
 *  4. ⭐ a consulta por visibilidade é provável (é como a agenda lista);
 *  5. ⭐ ninguém grava pelo navegador — nem a presidência (o servidor exige
 *     motivo, guarda o histórico e avisa quem segue);
 *  6. ⭐ seguir vale com o calendário ligado mesmo sem o acervo.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';

const PRES = 'pres1';
const TES = 'tes1';
const ANA = 'ana1';
const BIA = 'bia1';
const ZE = 'ze1';
const FED = 'fedA';

const evento = (over = {}) => ({ federation_id: FED, kind: 'board', group: 'institutional', title: 'Reunião', date: '2026-11-20', status: 'scheduled', visibility: 'public', ...over });

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-events-test',
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
    await setDoc(doc(db, 'federations', FED), { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', published: true, created_by: PRES, modules: { calendar: true } });
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), { federation_id: FED, user_id: PRES, role: 'president' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${TES}`), { federation_id: FED, user_id: TES, role: 'treasurer' });
    await setDoc(doc(db, 'federation_members', `${FED}_${ANA}`), { federation_id: FED, user_id: ANA, status: 'active' });
    await setDoc(doc(db, 'federation_members', `${FED}_${BIA}`), { federation_id: FED, user_id: BIA, status: 'suspended' });
    await setDoc(doc(db, 'federation_events', 'pub'), evento());
    await setDoc(doc(db, 'federation_events', 'fil'), evento({ visibility: 'members' }));
    await setDoc(doc(db, 'federation_events', 'eqp'), evento({ visibility: 'staff' }));
  });
});

const lista = (db, visibility) => getDocs(query(collection(db, 'federation_events'), where('federation_id', '==', FED), where('visibility', '==', visibility)));

describe('calendário: leitura', () => {
  it('1. público: qualquer um, até sem conta', async () => {
    await assertSucceeds(getDoc(doc(anonimo(), 'federation_events', 'pub')));
    await assertSucceeds(lista(anonimo(), 'public'));
    await assertSucceeds(lista(como(ZE), 'public'));
  });

  it('2. só filiados: filiado ativo e equipe; parado, estranho e sem conta não', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_events', 'fil')));
    await assertSucceeds(lista(como(ANA), 'members'));
    await assertSucceeds(getDoc(doc(como(TES), 'federation_events', 'fil')));
    await assertFails(getDoc(doc(como(BIA), 'federation_events', 'fil')));
    await assertFails(getDoc(doc(como(ZE), 'federation_events', 'fil')));
    await assertFails(lista(anonimo(), 'members'));
  });

  it('3. só a equipe: qualquer cargo; filiado não', async () => {
    await assertSucceeds(getDoc(doc(como(TES), 'federation_events', 'eqp')));
    await assertSucceeds(lista(como(TES), 'staff'));
    await assertFails(getDoc(doc(como(ANA), 'federation_events', 'eqp')));
    await assertFails(lista(como(ANA), 'staff'));
  });

  it('4. a consulta sem a visibilidade não é provável para quem não é da equipe', async () => {
    await assertFails(getDocs(query(collection(como(ANA), 'federation_events'), where('federation_id', '==', FED))));
  });
});

describe('calendário: escrita', () => {
  it('5. ninguém grava pelo navegador, nem a presidência', async () => {
    await assertFails(setDoc(doc(como(PRES), 'federation_events', 'novo'), evento()));
    await assertFails(updateDoc(doc(como(PRES), 'federation_events', 'pub'), { status: 'cancelled' }));
    await assertFails(deleteDoc(doc(como(PRES), 'federation_events', 'eqp')));
  });

  it('6. seguir vale com o calendário ligado (sem o acervo) e não com os dois desligados', async () => {
    const seguir = (uid) => setDoc(doc(como(uid), 'federation_followers', `${FED}_${uid}`), { federation_id: FED, user_id: uid, created_at: serverTimestamp() });
    await assertSucceeds(seguir(ZE));
    await semRegras((db) => updateDoc(doc(db, 'federations', FED), { modules: { calendar: false } }));
    await assertFails(seguir(ANA));
  });
});
