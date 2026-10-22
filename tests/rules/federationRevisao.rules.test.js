/**
 * Regras das FEDERAÇÕES — a revisão geral (2026-10-21). Cada teste aqui prende
 * um desencontro que a revisão achou entre o que a TELA oferece e o que a
 * REGRA aceitava (ou o contrário):
 *
 *  1. ⭐ o admin da plataforma tem toda permissão (a tela e o servidor já diziam;
 *     a regra recusava plano, curso, notícia, decisão de filiação…);
 *  2. ⭐ o financeiro grava o Pix (a aba Recebimento é dele) — e só o Pix;
 *  3. ⭐ a equipe de uma federação APROVADA é legível por conta logada — é como
 *     um clube, um organizador ou um filiado avisa a equipe de um pedido;
 *  4. ⭐ disciplina lê os filiados (escolhe quem sancionar);
 *  5. ⭐ editar a federação revalida nome, sigla e endereço (só o pedido validava);
 *  6. ⭐ a chancela APROVADA não é zerada nem reaberta pelo organizador;
 *  7. ⭐ "só filiados" vale para a DUPLA inteira; parceiro sem conta não entra;
 *  8. ⭐ com a flag desligada a equipe não decide chancela nem apaga resultado;
 *  9. ⭐ o `get` da PRÓPRIA filiação ainda inexistente é permitido (documento
 *     ausente ⇒ `od()` nulo ⇒ a leitura dava erro e a página escondia o
 *     "Filiar-se" de quem ainda não é filiado); a de outra pessoa, não.
 *
 * Contas que NÃO são admin da plataforma de propósito (lição de `listArenaGameDays`).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const ADMIN = 'admin1';
const PRES = 'pres1';
const TES = 'tes1';
const DISC = 'disc1';
const COMP = 'comp1';
const ORG = 'org1';
const ANA = 'ana1';
const BIA = 'bia1';
const CAIO = 'caio1';
const FED = 'fedA';
const TID = 'torneio1';

const federacao = (over = {}) => ({
  name: 'Federação Gaúcha de Pickleball', acronym: 'FGP', slug: 'fgp', level: 'state', state: 'RS',
  status: 'approved', published: true, verified: false, official: false, created_by: PRES, modules: { tournaments: true, courses: true, news: true, affiliations: true }, payment: {}, ...over,
});
const staff = (uid, role) => ({ federation_id: FED, user_id: uid, role, user_name: uid });
const plano = (over = {}) => ({ federation_id: FED, name: 'Federado', price_cents: 12000, billing: 'annual', tier: 'federated', person_type: 'athlete', active: true, ...over });
const chancela = (status, over = {}) => ({ status, federation_acronym: 'FGP', tier: 'regional', requires_membership: false, requested_by: ORG, ...over });
const inscricao = (uid, over = {}) => ({ tournament_id: TID, modality_id: 'm1', created_by: uid, user_id: uid, player_a_user_id: uid, player_b_user_id: null, player_b_name: '', status: 'confirmed', ...over });

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fedrev-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const anonimo = () => testEnv.unauthenticatedContext().firestore();
const desligarFlag = () => semRegras((db) => setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: {} }));

beforeEach(async () => {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'users', ADMIN), { uid: ADMIN, role: 'platform_admin' });
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { federations: true } });
    await setDoc(doc(db, 'federations', FED), federacao());
    await setDoc(doc(db, 'federations', 'pend'), federacao({ status: 'pending', slug: 'pend', created_by: BIA }));
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), staff(PRES, 'president'));
    await setDoc(doc(db, 'federation_staff', `${FED}_${TES}`), staff(TES, 'treasurer'));
    await setDoc(doc(db, 'federation_staff', `${FED}_${DISC}`), staff(DISC, 'discipline'));
    await setDoc(doc(db, 'federation_staff', `${FED}_${COMP}`), staff(COMP, 'competitions'));
    await setDoc(doc(db, 'federation_staff', `pend_${BIA}`), { federation_id: 'pend', user_id: BIA, role: 'president', user_name: BIA });
    await setDoc(doc(db, 'federation_plans', 'p1'), plano());
    await setDoc(doc(db, 'federation_members', `${FED}_${ANA}`), { federation_id: FED, user_id: ANA, status: 'active', tier: 'federated', valid_until: '2027-01-01' });
    await setDoc(doc(db, 'federation_members', `${FED}_${CAIO}`), { federation_id: FED, user_id: CAIO, status: 'active', tier: 'federated', valid_until: '2027-01-01' });
    await setDoc(doc(db, 'federation_news', 'n1'), { federation_id: FED, title: 'Olá', body: 'x', status: 'published', audience: 'public', created_by: PRES });
    await setDoc(doc(db, 'federation_affiliations', `${FED}_club_clube1`), { federation_id: FED, kind: 'club', org_id: 'clube1', org_name: 'Clube 1', status: 'pending', requested_by: CAIO, message: '', review: null });
    await setDoc(doc(db, 'tournaments', TID), { id: TID, creator_uid: ORG, archived: false, status: 'registrations_open', name: 'Aberto' });
    await setDoc(doc(db, 'tournament_admins', `${TID}_${ORG}`), { tournament_id: TID, user_id: ORG });
    await setDoc(doc(db, 'tournament_modalities', 'm1'), { tournament_id: TID, entry_fee_cents: 0, format: 'doubles' });
    await setDoc(doc(db, 'federation_results', `${FED}_${TID}_m1`), { federation_id: FED, tournament_id: TID, modality_id: 'm1', status: 'sent', sent_by: ORG, season: new Date().getFullYear(), tier: 'regional', rows: [], uids: [] });
  });
});

describe('⭐ o admin da plataforma tem toda permissão — na regra também, com o acesso justificado valendo', () => {
  it('cria plano, edita notícia, decide filiação de clube e configura o ranking', async () => {
    await assertFails(setDoc(doc(como(ADMIN), 'federation_plans', 'p2'), plano({ name: 'Simpatizante', price_cents: 0, tier: 'registered' })));
    await semRegras((db) => setDoc(doc(db, 'federation_admin_grants', `${FED}_${ADMIN}`), { federation_id: FED, admin_uid: ADMIN, expires_ms: Date.now() + 3600000 }));
    await assertSucceeds(setDoc(doc(como(ADMIN), 'federation_plans', 'p2'), plano({ name: 'Simpatizante', price_cents: 0, tier: 'registered' })));
    await assertSucceeds(updateDoc(doc(como(ADMIN), 'federation_news', 'n1'), { title: 'Novo título', updated_at: 1 }));
    await assertSucceeds(updateDoc(doc(como(ADMIN), 'federation_affiliations', `${FED}_club_clube1`), { status: 'approved', review: { by: ADMIN } }));
    await assertSucceeds(updateDoc(doc(como(ADMIN), 'federations', FED), { ranking_config: { best_n: 3 }, updated_at: 1 }));
    // Quem não é da equipe continua de fora.
    await assertFails(setDoc(doc(como(BIA), 'federation_plans', 'p3'), plano()));
    await assertFails(updateDoc(doc(como(BIA), 'federation_news', 'n1'), { title: 'x' }));
  });
});

describe('⭐ o financeiro grava o Pix — e só o Pix', () => {
  it('tesoureiro muda `payment`; não muda nome, módulos nem selos', async () => {
    await assertSucceeds(updateDoc(doc(como(TES), 'federations', FED), { payment: { pix_key: 'fgp@fgp.org', pix_key_type: 'email' }, updated_at: 1 }));
    await assertFails(updateDoc(doc(como(TES), 'federations', FED), { payment: { pix_key: 'x' }, name: 'Outra Federação Qualquer', updated_at: 1 }));
    await assertFails(updateDoc(doc(como(TES), 'federations', FED), { modules: { store: true } }));
    await assertFails(updateDoc(doc(como(TES), 'federations', FED), { verified: true }));
  });
});

describe('⭐ a equipe da federação aprovada é legível por conta logada', () => {
  it('um filiado, um organizador ou um clube consulta a equipe da aprovada; da pendente, não; anônimo, não', async () => {
    await assertSucceeds(getDocs(query(collection(como(CAIO), 'federation_staff'), where('federation_id', '==', FED))));
    await assertSucceeds(getDocs(query(collection(como(ORG), 'federation_staff'), where('federation_id', '==', FED))));
    await assertFails(getDocs(query(collection(como(CAIO), 'federation_staff'), where('federation_id', '==', 'pend'))));
    await assertSucceeds(getDocs(query(collection(como(BIA), 'federation_staff'), where('federation_id', '==', 'pend'))));
    await assertFails(getDocs(query(collection(anonimo(), 'federation_staff'), where('federation_id', '==', FED))));
    // Ler não é escrever: ninguém de fora se nomeia.
    await assertFails(setDoc(doc(como(CAIO), 'federation_staff', `${FED}_${CAIO}`), staff(CAIO, 'director')));
  });
});

describe('⭐ disciplina lê os filiados', () => {
  it('quem só tem `discipline` consulta a lista (para escolher quem sancionar); o estranho não', async () => {
    await assertSucceeds(getDocs(query(collection(como(DISC), 'federation_members'), where('federation_id', '==', FED))));
    await assertFails(getDocs(query(collection(como(BIA), 'federation_members'), where('federation_id', '==', FED))));
    await assertFails(getDocs(query(collection(como(COMP), 'federation_members'), where('federation_id', '==', FED))));
  });
});

describe('⭐ editar a federação revalida o perfil', () => {
  it('o presidente não grava endereço inválido nem nome curto; o resto da edição segue livre', async () => {
    await assertFails(updateDoc(doc(como(PRES), 'federations', FED), { slug: 'A B', updated_at: 1 }));
    await assertFails(updateDoc(doc(como(PRES), 'federations', FED), { name: 'Fed', updated_at: 1 }));
    await assertFails(updateDoc(doc(como(PRES), 'federations', FED), { acronym: 'F', updated_at: 1 }));
    await assertSucceeds(updateDoc(doc(como(PRES), 'federations', FED), { slug: 'fgp-rs', name: 'Federação Gaúcha', updated_at: 1 }));
    await assertSucceeds(updateDoc(doc(como(PRES), 'federations', FED), { about: 'Fundada em 2026.', updated_at: 1 }));
  });
});

describe('⭐ a chancela aprovada é decisão da federação', () => {
  it('pendente ou recusada, o organizador retira e pede de novo; aprovada, não zera nem reabre', async () => {
    const t = doc(como(ORG), 'tournaments', TID);
    await assertSucceeds(updateDoc(t, { federation_id: FED, federation_sanction: chancela('pending') }));
    await assertSucceeds(updateDoc(t, { federation_id: null, federation_sanction: null }));
    await semRegras((db) => updateDoc(doc(db, 'tournaments', TID), { federation_id: FED, federation_sanction: chancela('rejected') }));
    await assertSucceeds(updateDoc(t, { federation_id: FED, federation_sanction: chancela('pending') }));
    await semRegras((db) => updateDoc(doc(db, 'tournaments', TID), { federation_id: FED, federation_sanction: chancela('approved') }));
    await assertFails(updateDoc(t, { federation_id: null, federation_sanction: null }));
    await assertFails(updateDoc(t, { federation_id: FED, federation_sanction: chancela('pending') }));
    // O resto do torneio o organizador segue editando.
    await assertSucceeds(updateDoc(t, { name: 'Aberto de Verão' }));
    // E competições revoga.
    await assertSucceeds(updateDoc(doc(como(COMP), 'tournaments', TID), { federation_sanction: chancela('revoked', { reason: 'Regulamento não seguido' }), updated_at: 1 }));
  });
});

describe('⭐ "só filiados" vale para a dupla inteira', () => {
  beforeEach(() => semRegras((db) => updateDoc(doc(db, 'tournaments', TID), { federation_id: FED, federation_sanction: chancela('approved', { requires_membership: true }) })));
  it('filiada com parceiro filiado entra; com parceiro não filiado, não; parceiro sem conta, não; simples, sim', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'tournament_registrations', 'r1'), inscricao(ANA, { player_b_user_id: CAIO, player_b_name: 'Caio' })));
    await assertFails(setDoc(doc(como(ANA), 'tournament_registrations', 'r2'), inscricao(ANA, { player_b_user_id: BIA, player_b_name: 'Bia' })));
    await assertFails(setDoc(doc(como(ANA), 'tournament_registrations', 'r3'), inscricao(ANA, { player_b_user_id: null, player_b_name: 'Convidado Sem Conta' })));
    await assertSucceeds(setDoc(doc(como(ANA), 'tournament_registrations', 'r4'), inscricao(ANA)));
    await assertFails(setDoc(doc(como(BIA), 'tournament_registrations', 'r5'), inscricao(BIA, { player_b_user_id: ANA, player_b_name: 'Ana' })));
    // O organizador inscreve quem quiser.
    await assertSucceeds(setDoc(doc(como(ORG), 'tournament_registrations', 'r6'), inscricao(BIA, { created_by: ORG, player_b_name: 'Convidado' })));
  });
  it('sem a exigência, o parceiro não filiado entra', async () => {
    await semRegras((db) => updateDoc(doc(db, 'tournaments', TID), { federation_sanction: chancela('approved', { requires_membership: false }) }));
    await assertSucceeds(setDoc(doc(como(ANA), 'tournament_registrations', 'r7'), inscricao(ANA, { player_b_user_id: BIA, player_b_name: 'Bia' })));
  });
});

describe('⭐ a flag desligada fecha também a decisão e os apagamentos da equipe', () => {
  it('sem a flag, competições não decide chancela, e o admin da federação não apaga resultado', async () => {
    await semRegras((db) => updateDoc(doc(db, 'tournaments', TID), { federation_id: FED, federation_sanction: chancela('pending') }));
    await desligarFlag();
    await assertFails(updateDoc(doc(como(COMP), 'tournaments', TID), { federation_sanction: chancela('approved'), updated_at: 1 }));
    await assertFails(deleteDoc(doc(como(PRES), 'federation_results', `${FED}_${TID}_m1`)));
  });
});

describe('⭐ ler a própria filiação ainda inexistente (o "Filiar-se" de quem não é filiado)', () => {
  it('a pessoa lê o próprio documento ausente; o de outra pessoa, nem ausente nem existente; anônimo, nada', async () => {
    await assertSucceeds(getDoc(doc(como(BIA), 'federation_members', `${FED}_${BIA}`)));
    await assertFails(getDoc(doc(como(BIA), 'federation_members', `${FED}_${CAIO}`)));
    await assertFails(getDoc(doc(como(BIA), 'federation_members', `${FED}_${ANA}`)));
    await assertFails(getDoc(doc(anonimo(), 'federation_members', `${FED}_${BIA}`)));
    // Existindo, continua valendo o dono.
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_members', `${FED}_${ANA}`)));
  });
});
