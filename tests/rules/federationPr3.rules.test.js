/**
 * Regras das FEDERAÇÕES — PR 3: dados privados do filiado, dependente menor,
 * documentos, transferências, importação, cursos, credenciais, disciplina e
 * ouvidoria.
 *
 *  1. ⭐ o subdocumento privado (CPF, responsável) lê o próprio/responsável, a
 *     secretaria e o admin; grava só o próprio/responsável; o financeiro não lê;
 *  2. ⭐ o dependente (`user_id` nulo, `guardian_uid`) é lido e preferido pelo
 *     responsável, como se fosse dele;
 *  3. ⭐ documento: quem envia cria pendente na PRÓPRIA pasta do Storage; a
 *     secretaria aceita/recusa; a lista é consultável pela secretaria;
 *  4. ⭐ transferência, importação, inscrição em curso e sanção: ninguém grava
 *     pelo cliente; sanção só a pessoa e a disciplina leem (D11);
 *  5. ⭐ curso: público fora de rascunho; só cursos/admin cria com o módulo ligado;
 *  6. ⭐ credencial pública só com `public`; a pessoa muda só isso;
 *  7. ⭐ ouvidoria: anônima NÃO leva `reporter_uid`; o protocolo (get) acompanha;
 *     só a disciplina lista e trata;
 *  8. ⭐ suspensão disciplinar em vigor barra a inscrição em torneio "só filiados".
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const ADMIN = 'admin1';
const PRES = 'pres1';
const SEC = 'sec1';
const TES = 'tes1';
const REF = 'ref1';
const DISC = 'disc1';
const ORG = 'org1';
const ANA = 'ana1';
const BIA = 'bia1';
const CAIO = 'caio1';
const FED = 'fedA';
const FED2 = 'fedB';
const TID = 'torneio1';
const DEP = `${FED}_dep_x1`;

const federacao = (over = {}) => ({
  name: 'Federação Gaúcha de Pickleball', acronym: 'FGP', slug: 'fgp', level: 'state', state: 'RS',
  status: 'approved', verified: false, official: false, created_by: PRES, modules: { courses: true, discipline: true }, payment: {}, rules: { ask_cpf: true }, ...over,
});
const staff = (uid, role, fed = FED) => ({ federation_id: fed, user_id: uid, role, user_name: uid });
const membro = (uid, over = {}) => ({ federation_id: FED, user_id: uid, status: 'active', tier: 'federated', valid_until: '2027-01-01', public_badge: true, ...over });
const documento = (uid, over = {}) => ({ federation_id: FED, member_id: `${FED}_${uid}`, user_id: uid, kind: 'identidade', storage_path: `federacao/${uid}/abc123.pdf`, status: 'pending', ...over });
const curso = (over = {}) => ({ federation_id: FED, name: 'Curso de arbitragem', kind: 'referee', status: 'open', price_cents: 0, enrolled_count: 0, ...over });
const manifestacao = (over = {}) => ({ federation_id: FED, kind: 'referee', body: 'O árbitro da quadra 2 não aplicou a regra do saque na final.', anonymous: false, reporter_uid: ANA, status: 'open', ...over });

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed3-test',
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
    await setDoc(doc(db, 'users', ADMIN), { uid: ADMIN, role: 'platform_admin' });
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { federations: true } });
    await setDoc(doc(db, 'federations', FED), federacao());
    await setDoc(doc(db, 'federations', FED2), federacao({ slug: 'fed-b', acronym: 'FB', modules: {} }));
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), staff(PRES, 'president'));
    await setDoc(doc(db, 'federation_staff', `${FED}_${SEC}`), staff(SEC, 'secretary'));
    await setDoc(doc(db, 'federation_staff', `${FED}_${TES}`), staff(TES, 'treasurer'));
    await setDoc(doc(db, 'federation_staff', `${FED}_${REF}`), staff(REF, 'referees'));
    await setDoc(doc(db, 'federation_staff', `${FED}_${DISC}`), staff(DISC, 'discipline'));
    await setDoc(doc(db, 'federation_members', `${FED}_${ANA}`), membro(ANA));
    await setDoc(doc(db, 'federation_members', `${FED}_${BIA}`), membro(BIA, { discipline_until_ms: Date.now() + 86400000 }));
    await setDoc(doc(db, 'federation_members', DEP), membro(null, { user_id: null, guardian_uid: ANA, user_name: 'Dependente', is_minor: true }));
    await setDoc(doc(db, 'federation_members', `${FED}_${ANA}`, 'private', 'data'), { cpf: '52998224725' });
    await setDoc(doc(db, 'federation_documents_submitted', 'd1'), documento(ANA));
    await setDoc(doc(db, 'federation_transfers', 'tr1'), { federation_id: FED, member_id: `${FED}_${ANA}`, user_id: ANA, kind: 'federation', to_federation_id: FED2, status: 'pending' });
    await setDoc(doc(db, 'federation_imports', 'i1'), { federation_id: FED, pending: [{ email: 'x@y.z' }] });
    await setDoc(doc(db, 'federation_courses', 'c1'), curso());
    await setDoc(doc(db, 'federation_courses', 'c0'), curso({ status: 'draft' }));
    await setDoc(doc(db, 'federation_course_enrollments', `c1_${ANA}`), { federation_id: FED, course_id: 'c1', user_id: ANA, status: 'confirmed' });
    await setDoc(doc(db, 'federation_credentials', 'cr1'), { federation_id: FED, user_id: ANA, kind: 'referee', status: 'active', public: false });
    await setDoc(doc(db, 'federation_credentials', 'cr2'), { federation_id: FED, user_id: BIA, kind: 'referee', status: 'active', public: true });
    await setDoc(doc(db, 'federation_sanctions', 's1'), { federation_id: FED, user_id: BIA, kind: 'suspension', status: 'active', reason: 'x' });
    await setDoc(doc(db, 'federation_reports', 'rep1'), manifestacao());
    await setDoc(doc(db, 'federation_reports', 'repAnon'), manifestacao({ anonymous: true, reporter_uid: null }));
    await setDoc(doc(db, 'tournaments', TID), { id: TID, creator_uid: ORG, archived: false, status: 'registrations_open', name: 'Aberto', federation_id: FED, federation_sanction: { status: 'approved', requires_membership: true, requested_by: ORG } });
    await setDoc(doc(db, 'tournament_admins', `${TID}_${ORG}`), { tournament_id: TID, user_id: ORG });
    await setDoc(doc(db, 'tournament_modalities', 'm1'), { tournament_id: TID, entry_fee_cents: 0, format: 'doubles' });
  });
});

describe('⭐ dados privados e dependente', () => {
  const priv = (uid, memberId = `${FED}_${ANA}`) => doc(como(uid), 'federation_members', memberId, 'private', 'data');
  it('o CPF: lê o próprio, a secretaria, o presidente e o admin; o financeiro, o colega e o anônimo não', async () => {
    await assertSucceeds(getDoc(priv(ANA)));
    await assertSucceeds(getDoc(priv(SEC)));
    await assertSucceeds(getDoc(priv(PRES)));
    await assertSucceeds(getDoc(priv(ADMIN)));
    await assertFails(getDoc(priv(TES)));
    await assertFails(getDoc(priv(BIA)));
    await assertFails(getDoc(doc(anonimo(), 'federation_members', `${FED}_${ANA}`, 'private', 'data')));
  });
  it('ninguém grava pelo navegador — nem o próprio: o CPF e o nascimento entram pelo servidor (o nascimento decide o desconto de idade)', async () => {
    await assertFails(setDoc(priv(ANA), { cpf: '52998224725', guardian: null }));
    await assertFails(setDoc(priv(ANA), { birth_date: '2020-01-01' }));
    await assertFails(setDoc(priv(SEC), { cpf: '52998224725' }));
    await assertFails(setDoc(priv(BIA), { cpf: '52998224725' }));
    await assertFails(setDoc(priv(ADMIN), { cpf: '52998224725' }));
  });
  it('o dependente é do responsável: lê e muda preferências; o privado dele também é só do servidor', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_members', DEP)));
    await assertFails(getDoc(doc(como(BIA), 'federation_members', DEP)));
    await assertSucceeds(updateDoc(doc(como(ANA), 'federation_members', DEP), { minor_photo_consent: true }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_members', DEP), { status: 'active', valid_until: '2099-01-01' }));
    await assertFails(setDoc(priv(ANA, DEP), { cpf: '', guardian: { name: 'Ana', contact: '51 9999' } }));
    await assertFails(setDoc(priv(BIA, DEP), { cpf: '' }));
    // A lista dos dependentes do responsável é consultável.
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_members'), where('guardian_uid', '==', ANA))));
  });
});

describe('⭐ documentos', () => {
  it('quem envia cria pendente, na própria pasta e para a própria filiação (ou do dependente)', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'federation_documents_submitted', 'd2'), documento(ANA, { kind: 'atestado', storage_path: `federacao/${ANA}/x_1.jpg` })));
    await assertSucceeds(setDoc(doc(como(ANA), 'federation_documents_submitted', 'd3'), documento(ANA, { member_id: DEP, kind: 'autorizacao_responsavel' })));
    await assertFails(setDoc(doc(como(ANA), 'federation_documents_submitted', 'd4'), documento(ANA, { status: 'approved' })));
    await assertFails(setDoc(doc(como(ANA), 'federation_documents_submitted', 'd5'), documento(ANA, { storage_path: `federacao/${BIA}/abc.pdf` })));
    // Nem para a secretaria de OUTRA federação: o documento é da federação da filiação.
    await assertFails(setDoc(doc(como(ANA), 'federation_documents_submitted', 'd6'), documento(ANA, { federation_id: 'outraFed' })));
    await assertFails(setDoc(doc(como(ANA), 'federation_documents_submitted', 'd6'), documento(ANA, { member_id: `${FED}_${BIA}` })));
    await assertFails(setDoc(doc(como(BIA), 'federation_documents_submitted', 'd7'), documento(ANA)));
    await assertFails(setDoc(doc(como(ANA), 'federation_documents_submitted', 'd8'), documento(ANA, { kind: 'rg' })));
  });
  it('a secretaria aceita ou recusa (só estado e motivo); o financeiro não; quem enviou apaga o pendente', async () => {
    await assertFails(updateDoc(doc(como(TES), 'federation_documents_submitted', 'd1'), { status: 'approved' }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_documents_submitted', 'd1'), { status: 'approved' }));
    await assertFails(updateDoc(doc(como(SEC), 'federation_documents_submitted', 'd1'), { status: 'approved', storage_path: 'x' }));
    await assertSucceeds(updateDoc(doc(como(SEC), 'federation_documents_submitted', 'd1'), { status: 'rejected', review: { by: SEC, reason: 'Ilegível' } }));
    await assertFails(deleteDoc(doc(como(ANA), 'federation_documents_submitted', 'd1')));
    await semRegras((db) => updateDoc(doc(db, 'federation_documents_submitted', 'd1'), { status: 'pending' }));
    await assertFails(deleteDoc(doc(como(BIA), 'federation_documents_submitted', 'd1')));
    await assertSucceeds(deleteDoc(doc(como(ANA), 'federation_documents_submitted', 'd1')));
  });
  it('as consultas: os meus; os da federação pela secretaria; o colega não vê', async () => {
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_documents_submitted'), where('user_id', '==', ANA))));
    await assertSucceeds(getDocs(query(collection(como(SEC), 'federation_documents_submitted'), where('federation_id', '==', FED))));
    await assertFails(getDocs(query(collection(como(TES), 'federation_documents_submitted'), where('federation_id', '==', FED))));
    await assertFails(getDoc(doc(como(BIA), 'federation_documents_submitted', 'd1')));
  });
});

describe('⭐ só o servidor grava: transferência, importação, inscrição em curso, sanção', () => {
  it('ninguém cria nem muda pelo cliente', async () => {
    await assertFails(setDoc(doc(como(ANA), 'federation_transfers', 'tr2'), { federation_id: FED, user_id: ANA, kind: 'club', status: 'pending' }));
    await assertFails(updateDoc(doc(como(SEC), 'federation_transfers', 'tr1'), { status: 'approved' }));
    await assertFails(updateDoc(doc(como(PRES), 'federation_transfers', 'tr1'), { status: 'approved' }));
    await assertFails(setDoc(doc(como(SEC), 'federation_imports', 'i2'), { federation_id: FED }));
    await assertFails(setDoc(doc(como(ANA), 'federation_course_enrollments', `c1_${BIA}`), { federation_id: FED, course_id: 'c1', user_id: BIA, status: 'confirmed' }));
    await assertFails(updateDoc(doc(como(REF), 'federation_course_enrollments', `c1_${ANA}`), { status: 'passed' }));
    await assertFails(setDoc(doc(como(DISC), 'federation_sanctions', 's2'), { federation_id: FED, user_id: ANA, kind: 'warning', status: 'active' }));
    await assertFails(updateDoc(doc(como(BIA), 'federation_sanctions', 's1'), { appeal: 'injusto' }));
    await assertFails(setDoc(doc(como(REF), 'federation_credentials', 'cr3'), { federation_id: FED, user_id: ANA, kind: 'referee', status: 'active' }));
  });
  it('a transferência: lê a pessoa, a secretaria da atual e a da federação de destino', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_transfers', 'tr1')));
    await assertSucceeds(getDoc(doc(como(SEC), 'federation_transfers', 'tr1')));
    await assertFails(getDoc(doc(como(BIA), 'federation_transfers', 'tr1')));
    await assertFails(getDoc(doc(como(TES), 'federation_transfers', 'tr1')));
    await semRegras((db) => setDoc(doc(db, 'federation_staff', `${FED2}_${CAIO}`), staff(CAIO, 'secretary', FED2)));
    await assertSucceeds(getDoc(doc(como(CAIO), 'federation_transfers', 'tr1')));
    await assertSucceeds(getDocs(query(collection(como(CAIO), 'federation_transfers'), where('to_federation_id', '==', FED2))));
    await assertSucceeds(getDocs(query(collection(como(SEC), 'federation_transfers'), where('federation_id', '==', FED))));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_transfers'), where('user_id', '==', ANA))));
  });
  it('a importação só a secretaria lê; a inscrição em curso lê o próprio, cursos e financeiro', async () => {
    await assertSucceeds(getDoc(doc(como(SEC), 'federation_imports', 'i1')));
    await assertFails(getDoc(doc(como(TES), 'federation_imports', 'i1')));
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_course_enrollments', `c1_${ANA}`)));
    await assertSucceeds(getDoc(doc(como(REF), 'federation_course_enrollments', `c1_${ANA}`)));
    await assertSucceeds(getDoc(doc(como(TES), 'federation_course_enrollments', `c1_${ANA}`)));
    await assertFails(getDoc(doc(como(BIA), 'federation_course_enrollments', `c1_${ANA}`)));
    await assertSucceeds(getDocs(query(collection(como(REF), 'federation_course_enrollments'), where('course_id', '==', 'c1'), where('federation_id', '==', FED))));
  });
  it('⭐ a sanção só a pessoa, a disciplina, o presidente e o admin da plataforma leem (D11)', async () => {
    await assertSucceeds(getDoc(doc(como(BIA), 'federation_sanctions', 's1')));
    await assertSucceeds(getDoc(doc(como(DISC), 'federation_sanctions', 's1')));
    await assertSucceeds(getDoc(doc(como(PRES), 'federation_sanctions', 's1')));
    await assertSucceeds(getDoc(doc(como(ADMIN), 'federation_sanctions', 's1')));
    await assertFails(getDoc(doc(como(ANA), 'federation_sanctions', 's1')));
    await assertFails(getDoc(doc(como(SEC), 'federation_sanctions', 's1')));
    await assertFails(getDoc(doc(como(ORG), 'federation_sanctions', 's1')));
    await assertFails(getDoc(doc(anonimo(), 'federation_sanctions', 's1')));
    await assertSucceeds(getDocs(query(collection(como(BIA), 'federation_sanctions'), where('user_id', '==', BIA))));
    await assertSucceeds(getDocs(query(collection(como(DISC), 'federation_sanctions'), where('federation_id', '==', FED))));
  });
});

describe('⭐ cursos e credenciais', () => {
  it('o curso é público fora de rascunho; só cursos/admin cria e com o módulo ligado', async () => {
    await assertSucceeds(getDoc(doc(anonimo(), 'federation_courses', 'c1')));
    await assertFails(getDoc(doc(anonimo(), 'federation_courses', 'c0')));
    await assertFails(getDoc(doc(como(ANA), 'federation_courses', 'c0')));
    await assertSucceeds(getDoc(doc(como(REF), 'federation_courses', 'c0')));
    await assertSucceeds(getDocs(query(collection(anonimo(), 'federation_courses'), where('federation_id', '==', FED), where('status', '!=', 'draft'))));
    await assertSucceeds(setDoc(doc(como(REF), 'federation_courses', 'c2'), curso({ status: 'draft' })));
    await assertFails(setDoc(doc(como(SEC), 'federation_courses', 'c3'), curso()));
    await assertFails(setDoc(doc(como(REF), 'federation_courses', 'c4'), curso({ enrolled_count: 5 })));
    await assertFails(setDoc(doc(como(REF), 'federation_courses', 'c5'), curso({ name: 'ab' })));
    await semRegras((db) => setDoc(doc(db, 'federation_staff', `${FED2}_${REF}`), staff(REF, 'referees', FED2)));
    await assertFails(setDoc(doc(como(REF), 'federation_courses', 'c6'), curso({ federation_id: FED2 })));
  });
  it('edita sem tocar na federação nem na contagem; apaga só o admin da federação e sem inscritos', async () => {
    await assertSucceeds(updateDoc(doc(como(REF), 'federation_courses', 'c1'), { name: 'Curso de arbitragem nível 1', status: 'closed' }));
    await assertFails(updateDoc(doc(como(REF), 'federation_courses', 'c1'), { enrolled_count: 3 }));
    await assertFails(updateDoc(doc(como(REF), 'federation_courses', 'c1'), { federation_id: FED2 }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_courses', 'c1'), { name: 'x' }));
    await assertFails(deleteDoc(doc(como(REF), 'federation_courses', 'c1')));
    await semRegras((db) => updateDoc(doc(db, 'federation_courses', 'c1'), { enrolled_count: 2 }));
    await assertFails(deleteDoc(doc(como(PRES), 'federation_courses', 'c1')));
    await assertSucceeds(deleteDoc(doc(como(PRES), 'federation_courses', 'c0')));
  });
  it('a credencial pública só com `public`; a pessoa muda só isso; cursos revoga', async () => {
    await assertFails(getDoc(doc(anonimo(), 'federation_credentials', 'cr1')));
    await assertSucceeds(getDoc(doc(anonimo(), 'federation_credentials', 'cr2')));
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_credentials', 'cr1')));
    await assertFails(getDoc(doc(como(BIA), 'federation_credentials', 'cr1')));
    await assertSucceeds(getDocs(query(collection(anonimo(), 'federation_credentials'), where('federation_id', '==', FED), where('public', '==', true), where('status', '==', 'active'))));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_credentials'), where('user_id', '==', ANA))));
    await assertSucceeds(updateDoc(doc(como(ANA), 'federation_credentials', 'cr1'), { public: true }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_credentials', 'cr1'), { status: 'active', level: 'Nível 3' }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_credentials', 'cr2'), { public: false }));
    await assertSucceeds(updateDoc(doc(como(REF), 'federation_credentials', 'cr1'), { status: 'revoked', review: { by: REF, reason: 'x' } }));
    await assertFails(updateDoc(doc(como(SEC), 'federation_credentials', 'cr1'), { status: 'revoked' }));
  });
});

describe('⭐ ouvidoria', () => {
  it('qualquer conta abre; anônima sem `reporter_uid`; a federação precisa do módulo', async () => {
    await assertSucceeds(setDoc(doc(como(CAIO), 'federation_reports', 'r2'), manifestacao({ reporter_uid: CAIO })));
    await assertSucceeds(setDoc(doc(como(CAIO), 'federation_reports', 'r3'), manifestacao({ anonymous: true, reporter_uid: null })));
    await assertFails(setDoc(doc(como(CAIO), 'federation_reports', 'r4'), manifestacao({ anonymous: true, reporter_uid: CAIO })));
    await assertFails(setDoc(doc(como(CAIO), 'federation_reports', 'r5'), manifestacao({ reporter_uid: ANA })));
    await assertFails(setDoc(doc(como(CAIO), 'federation_reports', 'r6'), manifestacao({ reporter_uid: CAIO, status: 'closed' })));
    await assertFails(setDoc(doc(como(CAIO), 'federation_reports', 'r7'), manifestacao({ reporter_uid: CAIO, body: 'curto' })));
    await assertFails(setDoc(doc(como(CAIO), 'federation_reports', 'r8'), manifestacao({ reporter_uid: CAIO, federation_id: FED2 })));
    await assertFails(setDoc(doc(anonimo(), 'federation_reports', 'r9'), manifestacao({ anonymous: true, reporter_uid: null })));
  });
  it('quem tem o protocolo acompanha a anônima; a identificada só quem abriu; a lista é da disciplina', async () => {
    await assertSucceeds(getDoc(doc(como(CAIO), 'federation_reports', 'repAnon')));
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_reports', 'rep1')));
    await assertFails(getDoc(doc(como(CAIO), 'federation_reports', 'rep1')));
    await assertSucceeds(getDoc(doc(como(DISC), 'federation_reports', 'rep1')));
    await assertFails(getDoc(doc(como(SEC), 'federation_reports', 'rep1')));
    await assertSucceeds(getDocs(query(collection(como(DISC), 'federation_reports'), where('federation_id', '==', FED))));
    await assertFails(getDocs(query(collection(como(CAIO), 'federation_reports'), where('federation_id', '==', FED))));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_reports'), where('reporter_uid', '==', ANA))));
  });
  it('a disciplina trata (estado e notas); quem abriu não edita', async () => {
    await assertSucceeds(updateDoc(doc(como(DISC), 'federation_reports', 'rep1'), { status: 'in_review', notes: 'Ouvindo o árbitro', handled_by: DISC }));
    await assertFails(updateDoc(doc(como(DISC), 'federation_reports', 'rep1'), { body: 'mudei' }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_reports', 'rep1'), { status: 'closed' }));
    await assertFails(deleteDoc(doc(como(DISC), 'federation_reports', 'rep1')));
  });
});

describe('⭐ suspensão disciplinar barra a inscrição em torneio "só filiados"', () => {
  const inscricao = (uid) => ({ tournament_id: TID, modality_id: 'm1', created_by: uid, user_id: uid, player_a_user_id: uid, status: 'confirmed' });
  it('a filiada em dia entra; a suspensa (filiação ativa) não; depois do prazo entra', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'tournament_registrations', 'r1'), inscricao(ANA)));
    await assertFails(setDoc(doc(como(BIA), 'tournament_registrations', 'r2'), inscricao(BIA)));
    await semRegras((db) => updateDoc(doc(db, 'federation_members', `${FED}_${BIA}`), { discipline_until_ms: Date.now() - 1000 }));
    await assertSucceeds(setDoc(doc(como(BIA), 'tournament_registrations', 'r3'), inscricao(BIA)));
  });
});
