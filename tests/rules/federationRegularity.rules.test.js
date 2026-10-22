/**
 * Regras da REGULARIDADE do filiado (Bloco 1, 2026-10-22):
 *
 *  1. ⭐ documento vencido com a trava da federação (`docs_block`, só o
 *     servidor grava) barra a inscrição em torneio "só filiados"; regularizado,
 *     entra;
 *  2. ⭐ a secretaria grava a VALIDADE (`valid_until`, texto) ao aceitar — e
 *     nada além de estado, motivo e validade;
 *  3. ⭐ ocorrência do seguro (`federation_incidents`): lê o atleta, o
 *     responsável, quem registrou e a equipe de filiados/competições/admin;
 *     o financeiro e os outros, não; ninguém grava pelo navegador;
 *  4. a filiação não aceita nível oficial, consentimentos nem `docs_block`
 *     gravados pela própria pessoa.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const PRES = 'pres1';
const SEC = 'sec1';
const TES = 'tes1';
const ORG = 'org1';
const ANA = 'ana1';
const BIA = 'bia1';
const MAE = 'mae1';
const ZE = 'ze1';
const FED = 'fedA';
const TID = 'torneio1';
const DEP = `${FED}_dep_x1`;

const staff = (uid, role) => ({ federation_id: FED, user_id: uid, role, user_name: uid });
const membro = (uid, over = {}) => ({ federation_id: FED, user_id: uid, status: 'active', tier: 'federated', valid_until: '2027-01-01', public_badge: true, ...over });
const ocorrencia = (over = {}) => ({ federation_id: FED, member_id: `${FED}_${ANA}`, user_id: ANA, guardian_uid: null, reported_by: ANA, status: 'open', kind: 'injury', date: '2026-10-20', description: 'Torceu o tornozelo', ...over });

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-regularity-test',
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
    await setDoc(doc(db, 'federations', FED), { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', published: true, created_by: PRES, modules: { insurance: true }, rules: { block_expired_docs: true } });
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), staff(PRES, 'president'));
    await setDoc(doc(db, 'federation_staff', `${FED}_${SEC}`), staff(SEC, 'secretary'));
    await setDoc(doc(db, 'federation_staff', `${FED}_${TES}`), staff(TES, 'treasurer'));
    await setDoc(doc(db, 'federation_members', `${FED}_${ANA}`), membro(ANA));
    await setDoc(doc(db, 'federation_members', `${FED}_${BIA}`), membro(BIA, { docs_block: true, docs_state: { state: 'expired' } }));
    await setDoc(doc(db, 'federation_members', DEP), membro(null, { user_id: null, guardian_uid: MAE, is_minor: true }));
    await setDoc(doc(db, 'federation_documents_submitted', 'd1'), { federation_id: FED, member_id: `${FED}_${ANA}`, user_id: ANA, kind: 'atestado', storage_path: `federacao/${ANA}/a.pdf`, status: 'pending' });
    await setDoc(doc(db, 'federation_incidents', 'i1'), ocorrencia());
    await setDoc(doc(db, 'federation_incidents', 'i2'), ocorrencia({ member_id: DEP, user_id: null, guardian_uid: MAE, reported_by: SEC }));
    await setDoc(doc(db, 'tournaments', TID), { id: TID, creator_uid: ORG, archived: false, status: 'registrations_open', name: 'Aberto', federation_id: FED, federation_sanction: { status: 'approved', requires_membership: true, requested_by: ORG } });
    await setDoc(doc(db, 'tournament_admins', `${TID}_${ORG}`), { tournament_id: TID, user_id: ORG });
    await setDoc(doc(db, 'tournament_modalities', 'm1'), { tournament_id: TID, entry_fee_cents: 0, format: 'doubles' });
  });
});

describe('⭐ documento vencido com trava barra a inscrição "só filiados"', () => {
  const inscricao = (uid) => ({ tournament_id: TID, modality_id: 'm1', created_by: uid, user_id: uid, player_a_user_id: uid, status: 'confirmed' });
  it('1. em dia entra; com a trava não; regularizado entra', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'tournament_registrations', 'r1'), inscricao(ANA)));
    await assertFails(setDoc(doc(como(BIA), 'tournament_registrations', 'r2'), inscricao(BIA)));
    await semRegras((db) => updateDoc(doc(db, 'federation_members', `${FED}_${BIA}`), { docs_block: false }));
    await assertSucceeds(setDoc(doc(como(BIA), 'tournament_registrations', 'r3'), inscricao(BIA)));
  });
});

describe('⭐ validade do documento', () => {
  it('2. a secretaria aceita com a validade; não grava outro campo; o financeiro não', async () => {
    await assertSucceeds(updateDoc(doc(como(SEC), 'federation_documents_submitted', 'd1'), { status: 'approved', review: { by: SEC }, valid_until: '2027-10-22' }));
    await assertFails(updateDoc(doc(como(SEC), 'federation_documents_submitted', 'd1'), { valid_until: 20271022 }));
    await assertFails(updateDoc(doc(como(SEC), 'federation_documents_submitted', 'd1'), { valid_until: '2028-01-01', expiry_notified: [30] }));
    await assertFails(updateDoc(doc(como(TES), 'federation_documents_submitted', 'd1'), { valid_until: '2028-01-01' }));
  });
});

describe('⭐ ocorrências do seguro', () => {
  it('3. leitura: atleta, responsável, quem registrou e a equipe; o financeiro e os outros, não', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_incidents', 'i1')));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_incidents'), where('user_id', '==', ANA))));
    await assertSucceeds(getDoc(doc(como(MAE), 'federation_incidents', 'i2')));
    await assertSucceeds(getDocs(query(collection(como(MAE), 'federation_incidents'), where('guardian_uid', '==', MAE))));
    await assertSucceeds(getDoc(doc(como(SEC), 'federation_incidents', 'i2')));
    await assertSucceeds(getDocs(query(collection(como(PRES), 'federation_incidents'), where('federation_id', '==', FED))));
    await assertFails(getDoc(doc(como(TES), 'federation_incidents', 'i1')));
    await assertFails(getDoc(doc(como(ZE), 'federation_incidents', 'i1')));
    await assertFails(getDocs(query(collection(como(ZE), 'federation_incidents'), where('federation_id', '==', FED))));
  });
  it('3b. ninguém grava pelo navegador', async () => {
    await assertFails(setDoc(doc(como(ANA), 'federation_incidents', 'i3'), ocorrencia()));
    await assertFails(setDoc(doc(como(PRES), 'federation_incidents', 'i3'), ocorrencia({ reported_by: PRES })));
    await assertFails(updateDoc(doc(como(SEC), 'federation_incidents', 'i1'), { status: 'closed' }));
    await assertFails(deleteDoc(doc(como(ANA), 'federation_incidents', 'i1')));
  });
});

describe('a filiação: campos do servidor', () => {
  it('4. a pessoa não grava nível oficial, consentimentos nem a trava', async () => {
    const m = doc(como(BIA), 'federation_members', `${FED}_${BIA}`);
    await assertFails(updateDoc(m, { docs_block: false }));
    await assertFails(updateDoc(m, { official_level: { label: '5.0' } }));
    await assertFails(updateDoc(m, { consents: { image: { granted: true, at_ms: 1 } } }));
  });
});
