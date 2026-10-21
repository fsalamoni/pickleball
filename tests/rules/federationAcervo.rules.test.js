/**
 * Regras do ACERVO OFICIAL da federação (`federation_docs` + pasta de
 * rascunho no Storage):
 *
 *  1. ⭐ publicado e PÚBLICO: qualquer um lê, até sem conta (a página do
 *     acervo abre fora do app);
 *  2. ⭐ "só filiados": filiado ATIVO e a equipe; filiação parada não lê;
 *  3. ⭐ "só a equipe": qualquer pessoa da equipe (qualquer cargo);
 *  4. ⭐ rascunho e retirado do ar: só quem tem `docs` ou `admin`;
 *  5. ⭐ ninguém grava pelo navegador — nem a presidência (o servidor numera,
 *     copia e calcula o SHA-256);
 *  6. ⭐ `doc_numbers` (o contador) é campo de confiança da federação;
 *  7. ⭐ Storage: o rascunho sobe só para a própria pasta, com tipo e teto
 *     conferidos, sem sobrescrever; ninguém lê a pasta de outra pessoa.
 *  8. ⭐ seguir o acervo (`federation_followers`): só a si mesma, e o `get`
 *     do documento ainda inexistente responde (é como o botão sabe);
 *  9. ⭐ seguir não leva campo a mais e exige o acervo ligado.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';

const PRES = 'pres1';
const SEC = 'sec1';
const TES = 'tes1';
const ANA = 'ana1';
const BIA = 'bia1';
const ZE = 'ze1';
const FED = 'fedA';

const docOficial = (over = {}) => ({ federation_id: FED, type: 'resolution', category: 'acts', title: 'Calendário', status: 'published', visibility: 'public', ...over });

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-acervo-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore(), ctx.storage()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const anonimo = () => testEnv.unauthenticatedContext().firestore();
const st = (uid) => testEnv.authenticatedContext(uid).storage();
const pdf = (n = 10) => new Uint8Array(n);

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await semRegras(async (db, storage) => {
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { federations: true } });
    await setDoc(doc(db, 'federations', FED), { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', created_by: PRES, modules: { official_docs: true } });
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), { federation_id: FED, user_id: PRES, role: 'president' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${SEC}`), { federation_id: FED, user_id: SEC, role: 'secretary' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${TES}`), { federation_id: FED, user_id: TES, role: 'treasurer' });
    await setDoc(doc(db, 'federation_members', `${FED}_${ANA}`), { federation_id: FED, user_id: ANA, status: 'active' });
    await setDoc(doc(db, 'federation_members', `${FED}_${BIA}`), { federation_id: FED, user_id: BIA, status: 'suspended' });
    await setDoc(doc(db, 'federation_docs', 'pub'), docOficial());
    await setDoc(doc(db, 'federation_docs', 'fil'), docOficial({ visibility: 'members' }));
    await setDoc(doc(db, 'federation_docs', 'eqp'), docOficial({ visibility: 'staff' }));
    await setDoc(doc(db, 'federation_docs', 'ras'), docOficial({ status: 'draft' }));
    await setDoc(doc(db, 'federation_docs', 'ret'), docOficial({ status: 'withdrawn' }));
    await uploadBytes(ref(storage, `federacao-acervo/${SEC}/abc.pdf`), pdf(), { contentType: 'application/pdf' });
  });
});

const lista = (db, visibility) => getDocs(query(collection(db, 'federation_docs'), where('federation_id', '==', FED), where('status', '==', 'published'), where('visibility', '==', visibility)));

describe('acervo: leitura', () => {
  it('1. publicado e público: qualquer um, até sem conta', async () => {
    await assertSucceeds(getDoc(doc(anonimo(), 'federation_docs', 'pub')));
    await assertSucceeds(lista(anonimo(), 'public'));
    await assertSucceeds(lista(como(ZE), 'public'));
  });

  it('2. só filiados: filiado ativo e equipe; parado e estranho não', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_docs', 'fil')));
    await assertSucceeds(lista(como(ANA), 'members'));
    await assertSucceeds(getDoc(doc(como(TES), 'federation_docs', 'fil')));
    await assertFails(getDoc(doc(como(BIA), 'federation_docs', 'fil')));
    await assertFails(getDoc(doc(como(ZE), 'federation_docs', 'fil')));
    await assertFails(lista(anonimo(), 'members'));
  });

  it('3. só a equipe: qualquer cargo; filiado não', async () => {
    await assertSucceeds(getDoc(doc(como(TES), 'federation_docs', 'eqp')));
    await assertSucceeds(lista(como(TES), 'staff'));
    await assertFails(getDoc(doc(como(ANA), 'federation_docs', 'eqp')));
    await assertFails(lista(como(ANA), 'staff'));
  });

  it('4. rascunho e retirado: só docs/admin', async () => {
    await assertSucceeds(getDoc(doc(como(SEC), 'federation_docs', 'ras')));
    await assertSucceeds(getDoc(doc(como(PRES), 'federation_docs', 'ret')));
    await assertFails(getDoc(doc(como(TES), 'federation_docs', 'ras')));
    await assertFails(getDoc(doc(como(ANA), 'federation_docs', 'ret')));
    await assertSucceeds(getDocs(query(collection(como(SEC), 'federation_docs'), where('federation_id', '==', FED))));
    await assertFails(getDocs(query(collection(como(TES), 'federation_docs'), where('federation_id', '==', FED))));
  });
});

describe('acervo: escrita', () => {
  it('5. ninguém grava pelo navegador, nem a presidência', async () => {
    await assertFails(setDoc(doc(como(PRES), 'federation_docs', 'novo'), docOficial({ status: 'draft' })));
    await assertFails(updateDoc(doc(como(SEC), 'federation_docs', 'ras'), { status: 'published' }));
  });

  it('6. o contador da numeração é do servidor', async () => {
    await assertFails(updateDoc(doc(como(PRES), 'federations', FED), { doc_numbers: { resolution_2026: 7 } }));
  });
});

describe('acervo: seguir', () => {
  const seguir = (uid, over = {}) => setDoc(doc(como(uid), 'federation_followers', `${FED}_${uid}`), { federation_id: FED, user_id: uid, created_at: serverTimestamp(), ...over });

  it('8. a pessoa segue, lê e deixa de seguir só a si mesma; sem conta não segue', async () => {
    await assertSucceeds(getDoc(doc(como(ZE), 'federation_followers', `${FED}_${ZE}`)));
    await assertSucceeds(seguir(ZE));
    await assertSucceeds(getDoc(doc(como(ZE), 'federation_followers', `${FED}_${ZE}`)));
    await assertSucceeds(getDocs(query(collection(como(ZE), 'federation_followers'), where('user_id', '==', ZE))));
    await assertFails(getDoc(doc(como(ANA), 'federation_followers', `${FED}_${ZE}`)));
    await assertFails(getDoc(doc(como(ANA), 'federation_followers', `${FED}_${ZE}x`)));
    await assertFails(setDoc(doc(como(ANA), 'federation_followers', `${FED}_${ZE}`), { federation_id: FED, user_id: ZE, created_at: serverTimestamp() }));
    await assertFails(setDoc(doc(anonimo(), 'federation_followers', `${FED}_x`), { federation_id: FED, user_id: 'x', created_at: serverTimestamp() }));
    await assertFails(deleteDoc(doc(como(ANA), 'federation_followers', `${FED}_${ZE}`)));
    await assertSucceeds(deleteDoc(doc(como(ZE), 'federation_followers', `${FED}_${ZE}`)));
  });

  it('9. campo a mais ou acervo desligado: recusado', async () => {
    await assertFails(seguir(ANA, { role: 'admin' }));
    await semRegras((db) => updateDoc(doc(db, 'federations', FED), { modules: { official_docs: false } }));
    await assertFails(seguir(ANA));
  });
});

describe('acervo: Storage do rascunho', () => {
  it('7. só a própria pasta, com tipo e teto; sem sobrescrever; ninguém lê a de outra pessoa', async () => {
    await assertSucceeds(uploadBytes(ref(st(SEC), `federacao-acervo/${SEC}/novo.pdf`), pdf(), { contentType: 'application/pdf' }));
    await assertSucceeds(uploadBytes(ref(st(SEC), `federacao-acervo/${SEC}/v.mp4`), pdf(), { contentType: 'video/mp4' }));
    await assertFails(uploadBytes(ref(st(SEC), `federacao-acervo/${PRES}/x.pdf`), pdf(), { contentType: 'application/pdf' }));
    await assertFails(uploadBytes(ref(st(SEC), `federacao-acervo/${SEC}/x.zip`), pdf(), { contentType: 'application/zip' }));
    await assertFails(uploadBytes(ref(st(SEC), `federacao-acervo/${SEC}/grande.png`), pdf(10 * 1024 * 1024 + 1), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(st(SEC), `federacao-acervo/${SEC}/abc.pdf`), pdf(), { contentType: 'application/pdf' }));
    await assertSucceeds(getBytes(ref(st(SEC), `federacao-acervo/${SEC}/abc.pdf`)));
    await assertFails(getBytes(ref(st(PRES), `federacao-acervo/${SEC}/abc.pdf`)));
    await assertFails(getBytes(ref(testEnv.unauthenticatedContext().storage(), `federacao-acervo/${SEC}/abc.pdf`)));
  });

  it('a pasta oficial é fechada à regra (só o servidor e o link com token)', async () => {
    await assertFails(uploadBytes(ref(st(PRES), `federacao-acervo-oficial/${FED}/d/v1/1.pdf`), pdf(), { contentType: 'application/pdf' }));
    await assertFails(getBytes(ref(st(PRES), `federacao-acervo-oficial/${FED}/d/v1/1.pdf`)));
  });
});
