/**
 * Regras das FEDERAÇÕES — PR 2: clubes e arenas filiados, chancela de torneios
 * e ranking oficial.
 *
 *  1. ⭐ a filiação de clube/arena quem PEDE é quem gere a organização, só a
 *     uma federação aprovada com o módulo ligado; a equipe decide; filiado é
 *     público, pendente não;
 *  2. ⭐ o organizador do torneio só PEDE a chancela (pendente) ou retira —
 *     nunca se aprova; competições aprova/recusa/revoga e só mexe nisso;
 *  3. ⭐ torneio que exige filiação: a inscrição própria só com filiação ativa
 *     na federação dele; o organizador inscreve quem quiser;
 *  4. ⭐ o resultado só o organizador envia, só com a chancela aprovada desta
 *     federação; competições só recusa/readmite; o ranking ninguém grava.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const ADMIN = 'admin1';
const PRES = 'pres1';
const SEC = 'sec1';
const COMP = 'comp1';
const TES = 'tes1';
const ORG = 'org1';
const CLUBADM = 'clubadm1';
const ARENAMAN = 'arenaman1';
const ANA = 'ana1';
const BIA = 'bia1';
const FED = 'fedA';
const FED2 = 'fedB';
const TID = 'torneio1';

const federacao = (over = {}) => ({
  name: 'Federação Gaúcha de Pickleball', acronym: 'FGP', slug: 'fgp', level: 'state', state: 'RS',
  status: 'approved', verified: false, official: false, created_by: PRES, modules: { affiliations: true, tournaments: true, ranking: true }, payment: {}, ...over,
});
const staff = (uid, role, fed = FED) => ({ federation_id: fed, user_id: uid, role, user_name: uid });
const pedidoFiliacao = (kind, orgId, over = {}) => ({
  federation_id: FED, kind, org_id: orgId, org_name: orgId, status: 'pending', requested_by: kind === 'club' ? CLUBADM : ARENAMAN, message: '', review: null, ...over,
});
const chancela = (status, over = {}) => ({ status, federation_acronym: 'FGP', tier: 'regional', requires_membership: false, requested_by: ORG, ...over });
const resultado = (over = {}) => ({
  federation_id: FED, tournament_id: TID, modality_id: 'm1', status: 'sent', sent_by: ORG, season: 2026, rows: [{ uid: ANA, name: 'Ana', position: 1, played: 3 }], uids: [ANA], ...over,
});

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed2-test',
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
    await setDoc(doc(db, 'federation_staff', `${FED}_${COMP}`), staff(COMP, 'competitions'));
    await setDoc(doc(db, 'federation_staff', `${FED}_${TES}`), staff(TES, 'treasurer'));
    await setDoc(doc(db, 'federation_members', `${FED}_${ANA}`), { federation_id: FED, user_id: ANA, status: 'active', tier: 'federated', valid_until: '2027-01-01' });
    await setDoc(doc(db, 'federation_members', `${FED}_${BIA}`), { federation_id: FED, user_id: BIA, status: 'expired', tier: 'federated', valid_until: '2026-01-01' });
    await setDoc(doc(db, 'clubs', 'clube1'), { name: 'Clube 1', created_by: CLUBADM });
    await setDoc(doc(db, 'club_members', `clube1_${CLUBADM}`), { club_id: 'clube1', user_id: CLUBADM, role: 'admin' });
    await setDoc(doc(db, 'club_members', `clube1_${ANA}`), { club_id: 'clube1', user_id: ANA, role: 'member' });
    await setDoc(doc(db, 'arenas', 'arena1'), { name: 'Arena 1' });
    await setDoc(doc(db, 'arena_managers', `arena1_${ARENAMAN}`), { arena_id: 'arena1', user_id: ARENAMAN });
    await setDoc(doc(db, 'federation_affiliations', `${FED}_club_clube1`), pedidoFiliacao('club', 'clube1', { status: 'approved' }));
    await setDoc(doc(db, 'federation_affiliations', `${FED}_arena_arena1`), pedidoFiliacao('arena', 'arena1'));
    await setDoc(doc(db, 'tournaments', TID), { id: TID, creator_uid: ORG, archived: false, status: 'registrations_open', name: 'Aberto' });
    await setDoc(doc(db, 'tournament_admins', `${TID}_${ORG}`), { tournament_id: TID, user_id: ORG });
    await setDoc(doc(db, 'tournament_modalities', 'm1'), { tournament_id: TID, entry_fee_cents: 0, format: 'doubles' });
  });
});

describe('⭐ clubes e arenas filiados', () => {
  it('quem gere a organização pede; o membro comum e o estranho não', async () => {
    await assertFails(setDoc(doc(como(CLUBADM), 'federation_affiliations', `${FED2}_club_clube1`), pedidoFiliacao('club', 'clube1', { federation_id: FED2 })));
    await semRegras((db) => deleteDoc(doc(db, 'federation_affiliations', `${FED}_club_clube1`)));
    await assertSucceeds(setDoc(doc(como(CLUBADM), 'federation_affiliations', `${FED}_club_clube1`), pedidoFiliacao('club', 'clube1')));
    await assertFails(setDoc(doc(como(ANA), 'federation_affiliations', `${FED}_club_clube1`), pedidoFiliacao('club', 'clube1', { requested_by: ANA })));
    await assertFails(setDoc(doc(como(ARENAMAN), 'federation_affiliations', `${FED}_arena_arena2`), pedidoFiliacao('arena', 'arena2')));
    // Nasce pendente, com o id certo, nunca aprovado.
    await assertFails(setDoc(doc(como(ARENAMAN), 'federation_affiliations', `${FED}_arena_x`), pedidoFiliacao('arena', 'arena1')));
    await semRegras((db) => deleteDoc(doc(db, 'federation_affiliations', `${FED}_arena_arena1`)));
    await assertFails(setDoc(doc(como(ARENAMAN), 'federation_affiliations', `${FED}_arena_arena1`), pedidoFiliacao('arena', 'arena1', { status: 'approved' })));
  });
  it('a equipe de filiados decide (só estado e motivo); o financeiro e a organização não', async () => {
    const ref = (uid) => doc(como(uid), 'federation_affiliations', `${FED}_arena_arena1`);
    await assertFails(updateDoc(ref(TES), { status: 'approved' }));
    await assertFails(updateDoc(ref(ARENAMAN), { status: 'approved' }));
    await assertFails(updateDoc(ref(SEC), { status: 'approved', org_name: 'Outro' }));
    await assertFails(updateDoc(ref(SEC), { status: 'pending' }));
    await assertSucceeds(updateDoc(ref(SEC), { status: 'approved', review: { by: SEC, reason: '' } }));
    await assertSucceeds(updateDoc(ref(PRES), { status: 'suspended', review: { by: PRES, reason: 'Inadimplente' } }));
  });
  it('filiado é público; pendente só quem pediu, quem gere, a equipe e o admin', async () => {
    await assertSucceeds(getDoc(doc(anonimo(), 'federation_affiliations', `${FED}_club_clube1`)));
    await assertFails(getDoc(doc(anonimo(), 'federation_affiliations', `${FED}_arena_arena1`)));
    await assertFails(getDoc(doc(como(ANA), 'federation_affiliations', `${FED}_arena_arena1`)));
    await assertSucceeds(getDoc(doc(como(ARENAMAN), 'federation_affiliations', `${FED}_arena_arena1`)));
    await assertSucceeds(getDoc(doc(como(SEC), 'federation_affiliations', `${FED}_arena_arena1`)));
    await assertFails(getDoc(doc(como(TES), 'federation_affiliations', `${FED}_arena_arena1`)));
    // As consultas das telas são prováveis: filiados da federação (público), as da organização, as da equipe.
    await assertSucceeds(getDocs(query(collection(anonimo(), 'federation_affiliations'), where('federation_id', '==', FED), where('status', '==', 'approved'))));
    await assertSucceeds(getDocs(query(collection(como(ARENAMAN), 'federation_affiliations'), where('kind', '==', 'arena'), where('org_id', '==', 'arena1'))));
    await assertSucceeds(getDocs(query(collection(como(SEC), 'federation_affiliations'), where('federation_id', '==', FED))));
    await assertFails(getDocs(query(collection(como(ANA), 'federation_affiliations'), where('federation_id', '==', FED))));
  });
  it('a organização retira o próprio pedido; o admin da federação também; um terceiro não', async () => {
    await assertFails(deleteDoc(doc(como(ANA), 'federation_affiliations', `${FED}_arena_arena1`)));
    await assertFails(deleteDoc(doc(como(SEC), 'federation_affiliations', `${FED}_arena_arena1`)));
    await assertSucceeds(deleteDoc(doc(como(ARENAMAN), 'federation_affiliations', `${FED}_arena_arena1`)));
    await assertSucceeds(deleteDoc(doc(como(PRES), 'federation_affiliations', `${FED}_club_clube1`)));
  });
  it('com a flag desligada ninguém pede nem decide', async () => {
    await semRegras((db) => setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: {} }));
    await assertFails(setDoc(doc(como(ARENAMAN), 'federation_affiliations', `${FED}_arena_arena9`), pedidoFiliacao('arena', 'arena1')));
    await assertFails(updateDoc(doc(como(SEC), 'federation_affiliations', `${FED}_arena_arena1`), { status: 'approved' }));
  });
});

describe('⭐ chancela de torneios', () => {
  it('o organizador PEDE (pendente) e retira; não se aprova; a federação precisa do módulo', async () => {
    const t = doc(como(ORG), 'tournaments', TID);
    await assertFails(updateDoc(t, { federation_id: FED, federation_sanction: chancela('approved') }));
    await assertFails(updateDoc(t, { federation_id: FED, federation_sanction: chancela('pending', { requested_by: ANA }) }));
    await assertFails(updateDoc(t, { federation_id: FED2, federation_sanction: chancela('pending') }));
    await assertSucceeds(updateDoc(t, { federation_id: FED, federation_sanction: chancela('pending') }));
    // Outros campos seguem livres para o organizador com a chancela gravada.
    await assertSucceeds(updateDoc(t, { name: 'Aberto 2026' }));
    await assertSucceeds(updateDoc(t, { federation_id: null, federation_sanction: null }));
    // Criar já pedindo a chancela: pendente passa, aprovada não.
    await assertSucceeds(setDoc(doc(como(ORG), 'tournaments', 't2'), { creator_uid: ORG, name: 'T2', federation_id: FED, federation_sanction: chancela('pending') }));
    await assertFails(setDoc(doc(como(ORG), 'tournaments', 't3'), { creator_uid: ORG, name: 'T3', federation_id: FED, federation_sanction: chancela('approved') }));
  });
  it('competições decide, e só mexe na chancela; a secretaria e o financeiro não', async () => {
    await semRegras((db) => updateDoc(doc(db, 'tournaments', TID), { federation_id: FED, federation_sanction: chancela('pending') }));
    await assertFails(updateDoc(doc(como(SEC), 'tournaments', TID), { federation_sanction: chancela('approved') }));
    await assertFails(updateDoc(doc(como(TES), 'tournaments', TID), { federation_sanction: chancela('approved') }));
    await assertFails(updateDoc(doc(como(COMP), 'tournaments', TID), { federation_sanction: chancela('approved'), name: 'Mudei' }));
    await assertFails(updateDoc(doc(como(COMP), 'tournaments', TID), { federation_sanction: chancela('pending') }));
    await assertSucceeds(updateDoc(doc(como(COMP), 'tournaments', TID), { federation_sanction: chancela('approved', { decided_by: COMP }) }));
    await assertSucceeds(updateDoc(doc(como(PRES), 'tournaments', TID), { federation_sanction: chancela('revoked', { reason: 'x' }) }));
    // Depois de aprovada, o organizador não "re-aprova" nem troca o peso por conta própria.
    await semRegras((db) => updateDoc(doc(db, 'tournaments', TID), { federation_sanction: chancela('approved') }));
    await assertFails(updateDoc(doc(como(ORG), 'tournaments', TID), { federation_sanction: chancela('approved', { tier: 'major' }) }));
    await assertSucceeds(updateDoc(doc(como(ORG), 'tournaments', TID), { name: 'Segue editando o resto' }));
  });
  it('a lista de torneios chancelados da federação é consultável', async () => {
    await assertSucceeds(getDocs(query(collection(anonimo(), 'tournaments'), where('federation_id', '==', FED), where('archived', '==', false))));
  });
});

describe('⭐ torneio que exige filiação', () => {
  const inscricao = (uid) => ({ tournament_id: TID, modality_id: 'm1', created_by: uid, user_id: uid, player_a_user_id: uid, status: 'confirmed' });
  it('sem a exigência qualquer um se inscreve; com ela, só o filiado em dia; o organizador inscreve quem quiser', async () => {
    await assertSucceeds(setDoc(doc(como(BIA), 'tournament_registrations', 'r0'), inscricao(BIA)));
    await semRegras((db) => updateDoc(doc(db, 'tournaments', TID), { federation_id: FED, federation_sanction: chancela('approved', { requires_membership: true }) }));
    await assertSucceeds(setDoc(doc(como(ANA), 'tournament_registrations', 'r1'), inscricao(ANA)));
    await assertFails(setDoc(doc(como(BIA), 'tournament_registrations', 'r2'), inscricao(BIA)));
    await assertFails(setDoc(doc(como(CLUBADM), 'tournament_registrations', 'r3'), inscricao(CLUBADM)));
    await assertSucceeds(setDoc(doc(como(ORG), 'tournament_registrations', 'r4'), { ...inscricao(BIA), created_by: ORG }));
    // Chancela só pedida (não aprovada) não exige nada.
    await semRegras((db) => updateDoc(doc(db, 'tournaments', TID), { federation_sanction: chancela('pending', { requires_membership: true }) }));
    await assertSucceeds(setDoc(doc(como(BIA), 'tournament_registrations', 'r5'), inscricao(BIA)));
  });
});

describe('⭐ resultados e ranking oficial', () => {
  it('o organizador envia só com a chancela aprovada DESTA federação; o resultado é público', async () => {
    await assertFails(setDoc(doc(como(ORG), 'federation_results', `${FED}_${TID}_m1`), resultado()));
    await semRegras((db) => updateDoc(doc(db, 'tournaments', TID), { federation_id: FED, federation_sanction: chancela('approved') }));
    await assertFails(setDoc(doc(como(ANA), 'federation_results', `${FED}_${TID}_m1`), resultado({ sent_by: ANA })));
    await assertFails(setDoc(doc(como(ORG), 'federation_results', `${FED2}_${TID}_m1`), resultado({ federation_id: FED2 })));
    await assertFails(setDoc(doc(como(ORG), 'federation_results', `errado`), resultado()));
    await assertFails(setDoc(doc(como(ORG), 'federation_results', `${FED}_${TID}_m1`), resultado({ status: 'rejected' })));
    await assertSucceeds(setDoc(doc(como(ORG), 'federation_results', `${FED}_${TID}_m1`), resultado()));
    await assertSucceeds(getDoc(doc(anonimo(), 'federation_results', `${FED}_${TID}_m1`)));
    // Reenvio pelo organizador: tudo de novo, mas sem mudar de torneio/federação.
    await assertSucceeds(setDoc(doc(como(ORG), 'federation_results', `${FED}_${TID}_m1`), resultado({ rows: [] })));
    await assertFails(setDoc(doc(como(ORG), 'federation_results', `${FED}_${TID}_m1`), resultado({ tournament_id: 'outro' })));
    // Revogada a chancela, o reenvio para.
    await semRegras((db) => updateDoc(doc(db, 'tournaments', TID), { federation_sanction: chancela('revoked') }));
    await assertFails(setDoc(doc(como(ORG), 'federation_results', `${FED}_${TID}_m1`), resultado()));
  });
  it('competições recusa e readmite, sem tocar nas linhas; o organizador apaga o próprio envio', async () => {
    await semRegras(async (db) => {
      await updateDoc(doc(db, 'tournaments', TID), { federation_id: FED, federation_sanction: chancela('approved') });
      await setDoc(doc(db, 'federation_results', `${FED}_${TID}_m1`), resultado());
    });
    const ref = (uid) => doc(como(uid), 'federation_results', `${FED}_${TID}_m1`);
    await assertFails(updateDoc(ref(SEC), { status: 'rejected' }));
    await assertFails(updateDoc(ref(COMP), { status: 'rejected', rows: [] }));
    await assertSucceeds(updateDoc(ref(COMP), { status: 'rejected', review: { by: COMP, reason: 'Resultado contestado' } }));
    await assertSucceeds(updateDoc(ref(COMP), { status: 'sent', review: null }));
    await assertFails(deleteDoc(ref(ANA)));
    await assertSucceeds(deleteDoc(ref(ORG)));
  });
  it('o ranking é público e ninguém grava pelo cliente', async () => {
    await semRegras((db) => setDoc(doc(db, 'federation_rankings', `${FED}_2026`), { federation_id: FED, season: 2026, general: [] }));
    await assertSucceeds(getDoc(doc(anonimo(), 'federation_rankings', `${FED}_2026`)));
    await assertFails(updateDoc(doc(como(PRES), 'federation_rankings', `${FED}_2026`), { general: [{ uid: PRES, points: 999 }] }));
    await assertFails(updateDoc(doc(como(ADMIN), 'federation_rankings', `${FED}_2026`), { general: [] }));
  });
  it('competições configura o ranking da federação, e só isso', async () => {
    await assertSucceeds(updateDoc(doc(como(COMP), 'federations', FED), { ranking_config: { best_n: 4 } }));
    await assertFails(updateDoc(doc(como(COMP), 'federations', FED), { ranking_config: { best_n: 4 }, name: 'Outro nome' }));
    await assertFails(updateDoc(doc(como(TES), 'federations', FED), { ranking_config: { best_n: 4 } }));
  });
});
