/**
 * Regras das FEDERAÇÕES — Etapa 2 (2026-10-22): tipos de filiação do catálogo
 * da plataforma e clube/arena filiados por plano.
 *
 *  1. ⭐ o plano grava qualquer tipo com código válido (atleta…arena, ou um
 *     tipo do admin) e entidade conhecida; código inválido é recusado;
 *  2. ⭐ a filiação da entidade (`user_id` nulo) é lida por QUEM GERE a
 *     entidade — e a lista por `org_kind` + `org_id` também; quem só é membro
 *     do clube, não;
 *  3. ⭐ documento da entidade: o gestor envia (com o `org_kind`/`org_id` da
 *     filiação) e todos os gestores listam; documento de pessoa não vira de
 *     entidade nem o contrário;
 *  4. ⭐ o espelho em `federation_affiliations` com `member_id` não se decide
 *     nem se apaga pelo navegador; o pedido sem plano segue como antes;
 *  5. ⭐ o catálogo de tipos (`platform_settings/federations`): todos leem,
 *     só o admin da plataforma grava.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const ADMIN = 'admin1';
const PRES = 'pres1';
const SEC = 'sec1';
const LEO = 'leo1'; // admin do clube
const MIA = 'mia1'; // admin do clube
const ZED = 'zed1'; // só membro
const GES = 'ges1'; // gestor da arena
const FED = 'fedA';
const CLUBE = 'c1';
const ARENA = 'a1';
const MID = `${FED}_club_${CLUBE}`;

const federacao = () => ({ name: 'Federação Gaúcha de Pickleball', acronym: 'FGP', slug: 'fgp', status: 'approved', published: true, created_by: PRES, modules: {}, payment: {}, rules: {} });
const plano = (over = {}) => ({ federation_id: FED, name: 'Clube filiado', price_cents: 50000, billing: 'annual', tier: 'federated', person_type: 'club', entity: 'club', person_category: 'club', active: true, ...over });
const filiacaoOrg = (over = {}) => ({ federation_id: FED, user_id: null, guardian_uid: null, user_name: 'Clube Pinheiros', org_kind: 'club', org_id: CLUBE, org_name: 'Clube Pinheiros', representative_uid: LEO, status: 'active', ...over });
const documento = (uid, over = {}) => ({ federation_id: FED, member_id: MID, user_id: uid, kind: 'outro', doc_key: 'o_1', label: 'Estatuto social', org_kind: 'club', org_id: CLUBE, storage_path: `federacao/${uid}/est123.pdf`, status: 'pending', ...over });

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fedorg-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();

beforeEach(async () => {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'users', ADMIN), { uid: ADMIN, role: 'platform_admin' });
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { federations: true } });
    await setDoc(doc(db, 'platform_settings', 'federations'), { member_types: [] });
    await setDoc(doc(db, 'federations', FED), federacao());
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), { federation_id: FED, user_id: PRES, role: 'president' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${SEC}`), { federation_id: FED, user_id: SEC, role: 'secretary' });
    await setDoc(doc(db, 'club_members', `${CLUBE}_${LEO}`), { club_id: CLUBE, user_id: LEO, role: 'admin' });
    await setDoc(doc(db, 'club_members', `${CLUBE}_${MIA}`), { club_id: CLUBE, user_id: MIA, role: 'admin' });
    await setDoc(doc(db, 'club_members', `${CLUBE}_${ZED}`), { club_id: CLUBE, user_id: ZED, role: 'member' });
    await setDoc(doc(db, 'arena_managers', `${ARENA}_${GES}`), { arena_id: ARENA, user_id: GES });
    await setDoc(doc(db, 'federation_members', MID), filiacaoOrg());
    await setDoc(doc(db, 'federation_documents_submitted', 'd1'), documento(LEO));
    await setDoc(doc(db, 'federation_affiliations', MID), { federation_id: FED, kind: 'club', org_id: CLUBE, status: 'approved', member_id: MID, requested_by: LEO });
    await setDoc(doc(db, 'federation_affiliations', `${FED}_arena_${ARENA}`), { federation_id: FED, kind: 'arena', org_id: ARENA, status: 'pending', requested_by: GES });
  });
});

describe('Etapa 2 — tipos e entidades filiadas', () => {
  it('1. o plano aceita os tipos do catálogo pelo formato do código', async () => {
    const db = como(PRES);
    await assertSucceeds(setDoc(doc(db, 'federation_plans', 'p1'), plano()));
    await assertSucceeds(setDoc(doc(db, 'federation_plans', 'p2'), plano({ person_type: 'juiz_linha', entity: 'person', person_category: 'referee' })));
    await assertFails(setDoc(doc(db, 'federation_plans', 'p3'), plano({ person_type: 'Juiz Linha' })));
    await assertFails(setDoc(doc(db, 'federation_plans', 'p4'), plano({ entity: 'empresa' })));
  });

  it('2. quem gere a entidade lê a filiação dela e a lista; o membro comum, não', async () => {
    await assertSucceeds(getDoc(doc(como(LEO), 'federation_members', MID)));
    await assertSucceeds(getDoc(doc(como(MIA), 'federation_members', MID)));
    await assertFails(getDoc(doc(como(ZED), 'federation_members', MID)));
    const lista = (uid) => getDocs(query(collection(como(uid), 'federation_members'), where('org_kind', '==', 'club'), where('org_id', '==', CLUBE)));
    await assertSucceeds(lista(MIA));
    await assertFails(lista(ZED));
    await assertFails(lista(GES));
  });

  it('3. documento da entidade: o gestor envia com os dados da filiação e todos os gestores listam', async () => {
    await assertSucceeds(setDoc(doc(como(MIA), 'federation_documents_submitted', 'd2'), documento(MIA, { doc_key: 'o_2', label: 'Ata', storage_path: `federacao/${MIA}/ata1.pdf` })));
    // Sem os campos da entidade (ou com outra entidade), não.
    await assertFails(setDoc(doc(como(MIA), 'federation_documents_submitted', 'd3'), documento(MIA, { org_kind: '', org_id: '', storage_path: `federacao/${MIA}/x1.pdf` })));
    await assertFails(setDoc(doc(como(MIA), 'federation_documents_submitted', 'd4'), documento(MIA, { org_id: 'outro', storage_path: `federacao/${MIA}/x2.pdf` })));
    await assertFails(setDoc(doc(como(ZED), 'federation_documents_submitted', 'd5'), documento(ZED, { storage_path: `federacao/${ZED}/x3.pdf` })));
    const lista = (uid) => getDocs(query(collection(como(uid), 'federation_documents_submitted'), where('org_kind', '==', 'club'), where('org_id', '==', CLUBE)));
    await assertSucceeds(lista(MIA));
    await assertFails(lista(ZED));
    await assertSucceeds(getDoc(doc(como(MIA), 'federation_documents_submitted', 'd1')));
  });

  it('4. o espelho por plano não se decide nem se apaga pelo navegador; o pedido sem plano, sim', async () => {
    await assertFails(updateDoc(doc(como(SEC), 'federation_affiliations', MID), { status: 'suspended', review: { by: SEC } }));
    await assertFails(deleteDoc(doc(como(LEO), 'federation_affiliations', MID)));
    await assertFails(deleteDoc(doc(como(PRES), 'federation_affiliations', MID)));
    await assertSucceeds(updateDoc(doc(como(SEC), 'federation_affiliations', `${FED}_arena_${ARENA}`), { status: 'approved', review: { by: SEC } }));
    await assertSucceeds(deleteDoc(doc(como(GES), 'federation_affiliations', `${FED}_arena_${ARENA}`)));
  });

  it('5. o catálogo de tipos: todos leem, só o admin da plataforma grava', async () => {
    await assertSucceeds(getDoc(doc(como(ZED), 'platform_settings', 'federations')));
    await assertFails(setDoc(doc(como(PRES), 'platform_settings', 'federations'), { member_types: [{ id: 'x1', label: 'X' }] }));
    await assertSucceeds(setDoc(doc(como(ADMIN), 'platform_settings', 'federations'), { member_types: [{ id: 'juiz_linha', label: 'Juiz de linha', entity: 'person', category: 'referee' }] }));
  });
});
