/**
 * Regras dos COMENTÁRIOS da federação (`federation_comments` e
 * `federation_comment_reports`):
 *
 *  1. ⭐ o comentário só a própria pessoa lê direto (é como a exportação dos
 *     dados encontra os dela); a página lista pelo SERVIDOR, que confere quem
 *     pode ler o documento ou evento e não entrega uid de ninguém;
 *  2. ⭐ ninguém grava pelo navegador — nem a presidência (limites, denúncias
 *     e ocultação são do servidor);
 *  3. ⭐ a denúncia ninguém lê nem grava pelo navegador — nem quem denunciou.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const PRES = 'pres1';
const ANA = 'ana1';
const ZE = 'ze1';
const FED = 'fedA';

const comentario = (over = {}) => ({ federation_id: FED, target_kind: 'doc', target_id: 'reg', target_key: 'doc_reg', user_id: ANA, user_name: 'Ana', text: 'Olá', status: 'visible', official: false, reports_count: 0, created_at_ms: 1, ...over });

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-comments-test',
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
    await setDoc(doc(db, 'federations', FED), { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', created_by: PRES, modules: { official_docs: true } });
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), { federation_id: FED, user_id: PRES, role: 'president' });
    await setDoc(doc(db, 'federation_comments', 'c1'), comentario());
    await setDoc(doc(db, 'federation_comment_reports', `c1_${ZE}`), { federation_id: FED, comment_id: 'c1', reporter_id: ZE, reason: 'spam', created_at_ms: 2 });
  });
});

describe('comentários: leitura', () => {
  it('1. só quem escreveu lê direto; a consulta pelos próprios é provável', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_comments', 'c1')));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_comments'), where('user_id', '==', ANA))));
    await assertFails(getDoc(doc(como(ZE), 'federation_comments', 'c1')));
    await assertFails(getDoc(doc(como(PRES), 'federation_comments', 'c1')));
    await assertFails(getDoc(doc(anonimo(), 'federation_comments', 'c1')));
    await assertFails(getDocs(query(collection(como(ZE), 'federation_comments'), where('target_key', '==', 'doc_reg'))));
  });
});

describe('comentários: escrita', () => {
  it('2. ninguém grava pelo navegador', async () => {
    await assertFails(setDoc(doc(como(ANA), 'federation_comments', 'novo'), comentario()));
    await assertFails(updateDoc(doc(como(ANA), 'federation_comments', 'c1'), { text: 'Editado' }));
    await assertFails(updateDoc(doc(como(PRES), 'federation_comments', 'c1'), { status: 'hidden' }));
    await assertFails(deleteDoc(doc(como(ANA), 'federation_comments', 'c1')));
  });

  it('3. a denúncia ninguém lê nem grava', async () => {
    await assertFails(getDoc(doc(como(ZE), 'federation_comment_reports', `c1_${ZE}`)));
    await assertFails(getDoc(doc(como(PRES), 'federation_comment_reports', `c1_${ZE}`)));
    await assertFails(setDoc(doc(como(ANA), 'federation_comment_reports', `c1_${ANA}`), { federation_id: FED, comment_id: 'c1', reporter_id: ANA, reason: 'spam' }));
    await assertFails(deleteDoc(doc(como(ZE), 'federation_comment_reports', `c1_${ZE}`)));
  });
});
