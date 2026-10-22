/**
 * Regras da SELEÇÃO E EDITAIS (Bloco 3, `docs/50` §32):
 *
 *  1. a convocação publicada (aberta, fechada, cancelada) é pública na
 *     federação pública; o RASCUNHO só a equipe de competições, o financeiro e
 *     o admin leem — a consulta pública por `status in […]` é provável;
 *  2. o convite da convocação lê o convocado e competições/admin — o
 *     financeiro NÃO (é dado da pessoa: documentos, uniforme, anotação);
 *  3. o edital publicado é público; o rascunho, só a equipe;
 *  4. a inscrição no edital lê a pessoa, competições, financeiro e admin —
 *     outro atleta não;
 *  5. ⭐ ninguém grava nada disso pelo navegador (só o servidor).
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

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-selection-test',
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
    await setDoc(doc(db, 'federations', FED), { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', published: true, created_by: PRES, modules: { selection: true, grants: true } });
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), { federation_id: FED, user_id: PRES, role: 'president' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${COMP}`), { federation_id: FED, user_id: COMP, role: 'competitions' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${TES}`), { federation_id: FED, user_id: TES, role: 'treasurer' });
    await setDoc(doc(db, 'federation_callups', 'aberta'), { federation_id: FED, status: 'open', title: 'Seleção', roster: [] });
    await setDoc(doc(db, 'federation_callups', 'rascunho'), { federation_id: FED, status: 'draft', title: 'Rascunho' });
    await setDoc(doc(db, 'federation_callup_members', 'aberta_manual_ana1'), { federation_id: FED, callup_id: 'aberta', user_id: ANA, status: 'invited', expires_at_ms: 9e15 });
    await setDoc(doc(db, 'federation_grants', 'edital'), { federation_id: FED, status: 'open', title: 'Auxílio' });
    await setDoc(doc(db, 'federation_grants', 'ed-rascunho'), { federation_id: FED, status: 'draft', title: 'Rascunho' });
    await setDoc(doc(db, 'federation_grant_applications', 'insc1'), { federation_id: FED, grant_id: 'edital', user_id: ANA, status: 'submitted', text: 'Justificativa.' });
  });
});

describe('convocações', () => {
  it('1. publicada é pública; rascunho só a equipe', async () => {
    await assertSucceeds(getDoc(doc(como(ZE), 'federation_callups', 'aberta')));
    await assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'federation_callups', 'aberta')));
    await assertFails(getDoc(doc(como(ZE), 'federation_callups', 'rascunho')));
    await assertSucceeds(getDoc(doc(como(COMP), 'federation_callups', 'rascunho')));
    await assertSucceeds(getDoc(doc(como(TES), 'federation_callups', 'rascunho')));
    await assertSucceeds(getDocs(query(collection(como(ZE), 'federation_callups'), where('federation_id', '==', FED), where('status', 'in', ['open', 'closed', 'cancelled']))));
    await assertFails(getDocs(query(collection(como(ZE), 'federation_callups'), where('federation_id', '==', FED))));
    await assertSucceeds(getDocs(query(collection(como(COMP), 'federation_callups'), where('federation_id', '==', FED))));
  });

  it('1b. federação oculta: nem a convocação aberta é pública', async () => {
    await semRegras((db) => updateDoc(doc(db, 'federations', FED), { published: false }));
    await assertFails(getDoc(doc(como(ZE), 'federation_callups', 'aberta')));
    await assertSucceeds(getDoc(doc(como(COMP), 'federation_callups', 'aberta')));
  });

  it('2. o convite: o convocado e competições; o financeiro e os outros não', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_callup_members', 'aberta_manual_ana1')));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_callup_members'), where('user_id', '==', ANA))));
    await assertSucceeds(getDocs(query(collection(como(COMP), 'federation_callup_members'), where('federation_id', '==', FED), where('callup_id', '==', 'aberta'))));
    await assertSucceeds(getDoc(doc(como(PRES), 'federation_callup_members', 'aberta_manual_ana1')));
    await assertFails(getDoc(doc(como(TES), 'federation_callup_members', 'aberta_manual_ana1')));
    await assertFails(getDoc(doc(como(ZE), 'federation_callup_members', 'aberta_manual_ana1')));
  });
});

describe('editais', () => {
  it('3. publicado é público; rascunho só a equipe', async () => {
    await assertSucceeds(getDoc(doc(como(ZE), 'federation_grants', 'edital')));
    await assertFails(getDoc(doc(como(ZE), 'federation_grants', 'ed-rascunho')));
    await assertSucceeds(getDoc(doc(como(TES), 'federation_grants', 'ed-rascunho')));
    await assertSucceeds(getDocs(query(collection(como(ZE), 'federation_grants'), where('federation_id', '==', FED), where('status', 'in', ['open', 'review', 'result', 'final', 'cancelled']))));
  });

  it('4. a inscrição: a pessoa, competições e financeiro; outro atleta não', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_grant_applications', 'insc1')));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_grant_applications'), where('user_id', '==', ANA))));
    await assertSucceeds(getDocs(query(collection(como(COMP), 'federation_grant_applications'), where('federation_id', '==', FED), where('grant_id', '==', 'edital'))));
    await assertSucceeds(getDoc(doc(como(TES), 'federation_grant_applications', 'insc1')));
    await assertFails(getDoc(doc(como(ZE), 'federation_grant_applications', 'insc1')));
  });
});

describe('5. ⭐ só o servidor grava', () => {
  it('nem a equipe nem a pessoa escrevem convocação, convite, edital ou inscrição', async () => {
    await assertFails(setDoc(doc(como(COMP), 'federation_callups', 'nova'), { federation_id: FED, status: 'draft' }));
    await assertFails(updateDoc(doc(como(COMP), 'federation_callups', 'aberta'), { status: 'closed' }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_callup_members', 'aberta_manual_ana1'), { status: 'accepted' }));
    await assertFails(setDoc(doc(como(COMP), 'federation_grants', 'novo'), { federation_id: FED, status: 'draft' }));
    await assertFails(setDoc(doc(como(ANA), 'federation_grant_applications', 'minha'), { federation_id: FED, grant_id: 'edital', user_id: ANA, status: 'submitted' }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_grant_applications', 'insc1'), { status: 'approved' }));
    await assertFails(updateDoc(doc(como(TES), 'federation_grant_applications', 'insc1'), { payment: { amount_cents: 1 } }));
  });
});
