/**
 * Regras da GAMIFICAÇÃO V2 completa (Onda DA).
 *
 * O que estas asserções provam:
 *
 *  1. ⭐ Preferências são privadas e limitadas (o XP do roteiro não é forjável
 *     além do teto); o servidor as lê — o cliente nunca de outra pessoa.
 *  2. ⭐ XP concedido, reputação, métricas, hall e fotografia de integridade:
 *     NINGUÉM escreve pelo cliente (o admin inclusive) — a conta fecha na regra.
 *  3. ⭐ Avaliação pós-jogo: só o autor lê; imutável; 1–2★ exigem motivo; um
 *     documento por jogo e par; ninguém avalia por outra pessoa.
 *  4. ⭐ Carta ao companheiro: a anônima NÃO carrega o autor no documento que o
 *     destinatário lê, e só nasce com o registro do autor no mesmo lote.
 *  5. ⭐ Desafio: cada emissor cria o seu; ninguém troca de dono; só o servidor
 *     encerra; entrar é ato do próprio atleta (ou do admin do clube), nasce
 *     zerado e só em desafio ativo; ninguém edita placar.
 *  6. ⭐ Duelo: só os dois leem; só recusam; ninguém cria.
 *  7. ⭐ Recompensa: o emissor cria e aprova; a pessoa pede e cancela; o pedido
 *     aponta para o emissor REAL; ninguém aprova o próprio pedido.
 *  8. Metas do mês são do dono; sinais de integridade, do admin.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';

const ADMIN = 'admin_uid';
const ANA = 'ana_uid';
const BIA = 'bia_uid';
const CRIS = 'cris_uid';
const PROF = 'prof_uid';
const GESTOR = 'gestor_uid';
const ADM_CLUBE = 'adm_clube_uid';

const DIA = 86_400_000;
const AGORA = Date.now();

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-gamificacao-v2-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const desafio = (over = {}) => ({
  issuerType: 'platform', issuerId: 'platform', title: 'Mês do Iniciante', description: '', rules: '',
  emoji: '🏆', metric: 'games_played', subject: 'athlete', startsAt: AGORA - DIA, endsAt: AGORA + 10 * DIA,
  regionState: null, prizes: [{ place: 1, label: 'Troféu', xp: 500 }], status: 'active',
  createdBy: ADMIN, schemaVersion: 1, ...over,
});
const recompensa = (over = {}) => ({
  issuerType: 'arena', issuerId: 'arena_1', title: 'Aula experimental', description: '', kind: 'free_class',
  eligibility: { minTier: 'Aprendiz' }, quantity: 20, approvedCount: 0, validUntil: null, status: 'active',
  createdBy: GESTOR, schemaVersion: 1, ...over,
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ADMIN), { uid: ADMIN, role: 'platform_admin' });
    for (const uid of [ANA, BIA, CRIS, PROF, GESTOR, ADM_CLUBE]) await setDoc(doc(db, 'users', uid), { uid, role: 'user' });
    await setDoc(doc(db, 'coaches', PROF), { uid: PROF, name: 'Prof.' });
    await setDoc(doc(db, 'arena_managers', `arena_1_${GESTOR}`), { arena_id: 'arena_1', user_id: GESTOR });
    await setDoc(doc(db, 'club_members', `clube_1_${ADM_CLUBE}`), { club_id: 'clube_1', user_id: ADM_CLUBE, role: 'admin' });
    await setDoc(doc(db, 'club_members', `clube_1_${ANA}`), { club_id: 'clube_1', user_id: ANA, role: 'member' });
    await setDoc(doc(db, 'gamification_challenges', 'd1'), desafio());
    await setDoc(doc(db, 'gamification_challenges', 'd_clube'), desafio({ subject: 'club', title: 'Clube mais ativo' }));
    await setDoc(doc(db, 'gamification_challenges', 'd_arena'), desafio({ issuerType: 'arena', issuerId: 'arena_1', createdBy: GESTOR, prizes: [] }));
    await setDoc(doc(db, 'gamification_challenges', 'd_rascunho'), desafio({ status: 'draft' }));
    await setDoc(doc(db, 'gamification_challenges', 'd_fim'), desafio({ status: 'finished' }));
    await setDoc(doc(db, 'gamification_rewards', 'r1'), recompensa());
    await setDoc(doc(db, 'gamification_rewards', 'r_pausada'), recompensa({ status: 'paused' }));
    await setDoc(doc(db, 'duels', '2026-09-28_ana_uid_bia_uid'), { week: '2026-09-28', uidA: ANA, uidB: BIA, status: 'active' });
    await setDoc(doc(db, 'user_xp_grants', `${ANA}_season_2026-09`), { uid: ANA, kind: 'season', xp: 500 });
    await setDoc(doc(db, 'user_reputation', ANA), { uid: ANA, count: 6, average: 4.5 });
    await setDoc(doc(db, 'user_reputation_private', ANA), { uid: ANA, issues: { pontualidade: 1 } });
    await setDoc(doc(db, 'hall_of_fame', ANA), { uid: ANA, xp: 5000 });
    await setDoc(doc(db, 'gamification_flags', 'xp_unverified_x'), { type: 'xp_unverified', status: 'open', subjectUid: CRIS });
    await setDoc(doc(db, 'gamification_metrics', '2026-10-02'), { athletes: 3 });
    await setDoc(doc(db, 'match_reviews', `gd-g1__${ANA}__${BIA}`), { fromUid: ANA, toUid: BIA, matchKey: 'gd:g1', rating: 5, tags: [], issues: [], createdAt: AGORA });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const anonimo = () => testEnv.unauthenticatedContext().firestore();

describe('⭐ preferências: privadas e limitadas', () => {
  const prefs = (uid, over = {}) => ({
    uid, schemaVersion: 1, privacy: { showInHallOfFame: false }, social: {}, notifications: {}, display: {},
    onboarding: { dismissed: false, done: {} }, celebrated: {}, ...over,
  });

  it('o dono cria, edita, lê e apaga; ninguém lê as de outra pessoa', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'user_gamification_prefs', ANA), prefs(ANA)));
    await assertSucceeds(getDoc(doc(como(ANA), 'user_gamification_prefs', ANA)));
    await assertSucceeds(updateDoc(doc(como(ANA), 'user_gamification_prefs', ANA), { privacy: { showInHallOfFame: true } }));
    await assertFails(getDoc(doc(como(BIA), 'user_gamification_prefs', ANA)));
    await assertFails(setDoc(doc(como(BIA), 'user_gamification_prefs', ANA), prefs(ANA)));
    await assertSucceeds(deleteDoc(doc(como(ANA), 'user_gamification_prefs', ANA)));
  });

  it('o admin lê (suporte), mas visitante não', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'user_gamification_prefs', ANA), prefs(ANA)));
    await assertSucceeds(getDoc(doc(como(ADMIN), 'user_gamification_prefs', ANA)));
    await assertFails(getDoc(doc(anonimo(), 'user_gamification_prefs', ANA)));
  });

  it('não aceita campo estranho nem passa do teto do roteiro (XP não é forjável além do catálogo)', async () => {
    await assertFails(setDoc(doc(como(ANA), 'user_gamification_prefs', ANA), prefs(ANA, { role: 'platform_admin' })));
    const muitos = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`p${i}`, 1]));
    await assertFails(setDoc(doc(como(ANA), 'user_gamification_prefs', ANA), prefs(ANA, { onboarding: { dismissed: false, done: muitos } })));
    await assertFails(setDoc(doc(como(ANA), 'user_gamification_prefs', ANA), prefs(ANA, { schemaVersion: 2 })));
    await assertFails(setDoc(doc(como(ANA), 'user_gamification_prefs', ANA), prefs(BIA)));
  });
});

describe('⭐ só o servidor escreve: XP concedido, reputação, hall, métricas, integridade', () => {
  it('a pessoa lê o próprio XP concedido; outra não', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'user_xp_grants', `${ANA}_season_2026-09`)));
    await assertFails(getDoc(doc(como(BIA), 'user_xp_grants', `${ANA}_season_2026-09`)));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'user_xp_grants'), where('uid', '==', ANA))));
  });

  it('NINGUÉM escreve concessão de XP — nem a própria pessoa, nem o admin', async () => {
    for (const quem of [ANA, ADMIN]) {
      await assertFails(setDoc(doc(como(quem), 'user_xp_grants', `${ANA}_admin_x`), { uid: ANA, kind: 'admin', xp: 5000 }));
      await assertFails(updateDoc(doc(como(quem), 'user_xp_grants', `${ANA}_season_2026-09`), { xp: 5000 }));
      await assertFails(deleteDoc(doc(como(quem), 'user_xp_grants', `${ANA}_season_2026-09`)));
    }
  });

  it('reputação, hall e retrato: leitura conforme o caso, escrita nunca', async () => {
    await assertSucceeds(getDoc(doc(como(BIA), 'user_reputation', ANA)));
    await assertFails(setDoc(doc(como(ANA), 'user_reputation', ANA), { uid: ANA, average: 5 }));
    await assertFails(setDoc(doc(como(ADMIN), 'user_reputation', ANA), { uid: ANA, average: 5 }));
    await assertSucceeds(getDoc(doc(como(ANA), 'user_reputation_private', ANA)));
    await assertFails(getDoc(doc(como(BIA), 'user_reputation_private', ANA)));
    await assertSucceeds(getDoc(doc(como(BIA), 'hall_of_fame', ANA)));
    await assertFails(setDoc(doc(como(ADMIN), 'hall_of_fame', BIA), { uid: BIA, xp: 9 }));
    await assertSucceeds(getDoc(doc(como(ADMIN), 'gamification_metrics', '2026-10-02')));
    await assertFails(getDoc(doc(como(ANA), 'gamification_metrics', '2026-10-02')));
    await assertFails(setDoc(doc(como(ADMIN), 'gamification_metrics', 'x'), { a: 1 }));
    await assertFails(getDoc(doc(como(ADMIN), 'gamification_integrity', ANA)));
    await assertFails(setDoc(doc(como(ADMIN), 'gamification_integrity', ANA), { xp: 1 }));
  });

  it('o admin modera (exclui do placar); o atleta não se tira nem se põe', async () => {
    await assertSucceeds(setDoc(doc(como(ADMIN), 'gamification_moderation', CRIS), { excluded: true, reason: 'teste' }));
    await assertFails(setDoc(doc(como(CRIS), 'gamification_moderation', CRIS), { excluded: false }));
    await assertFails(getDoc(doc(como(CRIS), 'gamification_moderation', CRIS)));
  });

  it('sinais de integridade: só o admin lê e só muda o veredito', async () => {
    await assertFails(getDoc(doc(como(ANA), 'gamification_flags', 'xp_unverified_x')));
    await assertSucceeds(updateDoc(doc(como(ADMIN), 'gamification_flags', 'xp_unverified_x'), { status: 'dismissed', reviewNote: 'jogou muito', reviewedBy: ADMIN, reviewedAt: AGORA }));
    await assertFails(updateDoc(doc(como(ADMIN), 'gamification_flags', 'xp_unverified_x'), { subjectUid: BIA }));
    await assertFails(setDoc(doc(como(ADMIN), 'gamification_flags', 'novo'), { type: 'x', status: 'open' }));
    await assertFails(deleteDoc(doc(como(ADMIN), 'gamification_flags', 'xp_unverified_x')));
  });
});

describe('⭐ avaliação pós-jogo', () => {
  const rv = (over = {}) => ({ fromUid: ANA, toUid: CRIS, matchKey: 'gd:g1', rating: 5, tags: ['pontual'], issues: [], relation: 'opponent', createdAt: AGORA, ...over });
  const id = (de, para) => `gd-g1__${de}__${para}`;

  it('o autor cria a avaliação do par e do jogo; o id carrega os dois lados', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'match_reviews', id(ANA, CRIS)), rv()));
    await assertFails(setDoc(doc(como(ANA), 'match_reviews', 'gd-g1__outro__' + CRIS), rv())); // id não bate
    await assertFails(setDoc(doc(como(ANA), 'match_reviews', id(ANA, BIA)), rv())); // toUid não bate com o id
  });

  it('ninguém avalia por outra pessoa nem a si mesmo', async () => {
    await assertFails(setDoc(doc(como(BIA), 'match_reviews', id(ANA, CRIS)), rv()));
    await assertFails(setDoc(doc(como(ANA), 'match_reviews', id(ANA, ANA)), rv({ toUid: ANA })));
  });

  it('1–2 estrelas exigem motivo; nota fora da faixa e texto livre são recusados', async () => {
    await assertFails(setDoc(doc(como(ANA), 'match_reviews', id(ANA, CRIS)), rv({ rating: 1, tags: [], issues: [] })));
    await assertSucceeds(setDoc(doc(como(ANA), 'match_reviews', id(ANA, CRIS)), rv({ rating: 2, tags: [], issues: ['conduta'] })));
    await assertFails(setDoc(doc(como(ANA), 'match_reviews', id(ANA, BIA)), rv({ toUid: BIA, rating: 6 })));
    await assertFails(setDoc(doc(como(ANA), 'match_reviews', id(ANA, BIA)), rv({ toUid: BIA, comment: 'você é péssimo' })));
    await assertFails(setDoc(doc(como(ANA), 'match_reviews', id(ANA, BIA)), rv({ toUid: BIA, rating: 4.5 })));
  });

  it('só o autor e o admin leem; o avaliado NÃO lê; é imutável e o autor pode retirar', async () => {
    const ref = (u) => doc(como(u), 'match_reviews', id(ANA, BIA));
    await assertSucceeds(getDoc(ref(ANA)));
    await assertSucceeds(getDoc(ref(ADMIN)));
    await assertFails(getDoc(ref(BIA)));
    await assertFails(getDoc(ref(CRIS)));
    await assertFails(updateDoc(ref(ANA), { rating: 1 }));
    await assertFails(deleteDoc(ref(BIA)));
    await assertSucceeds(deleteDoc(ref(ANA)));
  });

  it('o autor lista as próprias avaliações (a consulta é provável pela regra)', async () => {
    await assertSucceeds(getDocs(query(collection(como(ANA), 'match_reviews'), where('fromUid', '==', ANA))));
    await assertFails(getDocs(query(collection(como(BIA), 'match_reviews'), where('fromUid', '==', ANA))));
  });
});

describe('⭐ carta ao companheiro: o anonimato é real', () => {
  const idCarta = (de, para) => `gd-g1__${de}__${para}`;
  const carta = (over = {}) => ({ toUid: BIA, fromUid: null, fromName: null, text: 'Obrigado pela parceria!', showName: false, matchKey: 'gd:g1', createdAt: AGORA, readAt: null, reported: false, ...over });
  const autor = (over = {}) => ({ fromUid: ANA, toUid: BIA, matchKey: 'gd:g1', createdAt: AGORA, ...over });

  async function enviar(db, { letter = carta(), author = autor(), id = idCarta(ANA, BIA) } = {}) {
    const b = writeBatch(db);
    b.set(doc(db, 'partner_letters', id), letter);
    b.set(doc(db, 'partner_letter_authors', id), author);
    return b.commit();
  }

  it('a carta anônima nasce sem rastro do autor, com o registro do autor no mesmo lote', async () => {
    await assertSucceeds(enviar(como(ANA)));
  });

  it('carta anônima que carrega o autor é recusada (seria anonimato só de fachada)', async () => {
    await assertFails(enviar(como(ANA), { letter: carta({ fromUid: ANA }) }));
    await assertFails(enviar(como(ANA), { letter: carta({ fromName: 'Ana' }) }));
  });

  it('assinada: só com o próprio uid', async () => {
    await assertSucceeds(enviar(como(ANA), { letter: carta({ showName: true, fromUid: ANA, fromName: 'Ana' }) }));
    await assertFails(enviar(como(ANA), { letter: carta({ showName: true, fromUid: BIA }) }));
  });

  it('sem o registro do autor a carta não passa; ninguém escreve em nome de outro', async () => {
    await assertFails(setDoc(doc(como(ANA), 'partner_letters', idCarta(ANA, BIA)), carta()));
    await assertFails(enviar(como(CRIS), { id: idCarta(ANA, BIA) }));
    await assertFails(enviar(como(ANA), { author: autor({ fromUid: CRIS }) }));
  });

  it('texto: mínimo, máximo e carta para si mesmo', async () => {
    await assertFails(enviar(como(ANA), { letter: carta({ text: 'a' }) }));
    await assertFails(enviar(como(ANA), { letter: carta({ text: 'x'.repeat(300) }) }));
    await assertFails(enviar(como(ANA), { letter: carta({ toUid: ANA }), author: autor({ toUid: ANA }), id: idCarta(ANA, ANA) }));
  });

  it('só o destinatário lê a carta; só o autor (e o admin) lê o registro do autor', async () => {
    await enviar(como(ANA));
    await assertSucceeds(getDoc(doc(como(BIA), 'partner_letters', idCarta(ANA, BIA))));
    await assertFails(getDoc(doc(como(CRIS), 'partner_letters', idCarta(ANA, BIA))));
    await assertFails(getDoc(doc(como(BIA), 'partner_letter_authors', idCarta(ANA, BIA)))); // o destinatário NÃO descobre quem foi
    await assertSucceeds(getDoc(doc(como(ANA), 'partner_letter_authors', idCarta(ANA, BIA))));
    await assertSucceeds(getDoc(doc(como(ADMIN), 'partner_letter_authors', idCarta(ANA, BIA)))); // moderação
  });

  it('o destinatário marca como lida e denuncia — não edita o texto', async () => {
    await enviar(como(ANA));
    const ref = doc(como(BIA), 'partner_letters', idCarta(ANA, BIA));
    await assertSucceeds(updateDoc(ref, { readAt: AGORA }));
    await assertSucceeds(updateDoc(ref, { reported: true }));
    await assertFails(updateDoc(ref, { text: 'outra coisa' }));
    await assertFails(updateDoc(doc(como(ANA), 'partner_letters', idCarta(ANA, BIA)), { readAt: AGORA }));
    await assertSucceeds(deleteDoc(ref));
  });
});

describe('⭐ desafios: cada emissor cria o seu', () => {
  it('a plataforma é só do admin; arena do gestor; clube do admin do clube; professor do próprio', async () => {
    await assertSucceeds(setDoc(doc(como(ADMIN), 'gamification_challenges', 'n1'), desafio()));
    await assertFails(setDoc(doc(como(ANA), 'gamification_challenges', 'n2'), desafio({ createdBy: ANA })));
    await assertSucceeds(setDoc(doc(como(GESTOR), 'gamification_challenges', 'n3'), desafio({ issuerType: 'arena', issuerId: 'arena_1', createdBy: GESTOR })));
    await assertFails(setDoc(doc(como(ANA), 'gamification_challenges', 'n4'), desafio({ issuerType: 'arena', issuerId: 'arena_1', createdBy: ANA })));
    await assertSucceeds(setDoc(doc(como(ADM_CLUBE), 'gamification_challenges', 'n5'), desafio({ issuerType: 'club', issuerId: 'clube_1', createdBy: ADM_CLUBE })));
    await assertFails(setDoc(doc(como(ANA), 'gamification_challenges', 'n6'), desafio({ issuerType: 'club', issuerId: 'clube_1', createdBy: ANA }))); // membro, não admin
    await assertSucceeds(setDoc(doc(como(PROF), 'gamification_challenges', 'n7'), desafio({ issuerType: 'coach', issuerId: PROF, createdBy: PROF })));
    await assertFails(setDoc(doc(como(BIA), 'gamification_challenges', 'n8'), desafio({ issuerType: 'coach', issuerId: BIA, createdBy: BIA }))); // sem perfil de professor
  });

  it('desafio ENTRE CLUBES é só da plataforma; duração máxima de 92 dias; nome mínimo', async () => {
    await assertFails(setDoc(doc(como(GESTOR), 'gamification_challenges', 'x'), desafio({ issuerType: 'arena', issuerId: 'arena_1', createdBy: GESTOR, subject: 'club' })));
    await assertFails(setDoc(doc(como(ADMIN), 'gamification_challenges', 'x'), desafio({ endsAt: AGORA + 200 * DIA })));
    await assertFails(setDoc(doc(como(ADMIN), 'gamification_challenges', 'x'), desafio({ title: 'ab' })));
    await assertFails(setDoc(doc(como(ADMIN), 'gamification_challenges', 'x'), desafio({ endsAt: AGORA - 5 * DIA })));
  });

  it('o emissor não nasce já encerrado e ninguém cria em nome de outro', async () => {
    await assertFails(setDoc(doc(como(ADMIN), 'gamification_challenges', 'x'), desafio({ status: 'finished' })));
    await assertFails(setDoc(doc(como(ADMIN), 'gamification_challenges', 'x'), desafio({ createdBy: BIA })));
  });

  it('o emissor edita e cancela o dele, mas não troca de dono nem encerra', async () => {
    await assertSucceeds(updateDoc(doc(como(GESTOR), 'gamification_challenges', 'd_arena'), { title: 'Semana das Duplas' }));
    await assertSucceeds(updateDoc(doc(como(GESTOR), 'gamification_challenges', 'd_arena'), { status: 'cancelled' }));
    await assertFails(updateDoc(doc(como(GESTOR), 'gamification_challenges', 'd_arena'), { issuerType: 'platform', issuerId: 'platform' }));
    await assertFails(updateDoc(doc(como(PROF), 'gamification_challenges', 'd_arena'), { title: 'Roubei' }));
    // 'finished' é do servidor: o emissor (que não é admin) não consegue
    await assertFails(updateDoc(doc(como(GESTOR), 'gamification_challenges', 'd1'), { status: 'finished' }));
    await assertFails(updateDoc(doc(como(GESTOR), 'gamification_challenges', 'd_arena'), { status: 'finished' }));
  });

  it('rascunho só o emissor vê; os demais são públicos para quem está logado', async () => {
    await assertFails(getDoc(doc(como(ANA), 'gamification_challenges', 'd_rascunho')));
    await assertSucceeds(getDoc(doc(como(ADMIN), 'gamification_challenges', 'd_rascunho')));
    await assertSucceeds(getDoc(doc(como(ANA), 'gamification_challenges', 'd1')));
    await assertFails(getDoc(doc(anonimo(), 'gamification_challenges', 'd1')));
  });

  it('apagar: só rascunho ou cancelado, pelo emissor', async () => {
    await assertFails(deleteDoc(doc(como(GESTOR), 'gamification_challenges', 'd_arena'))); // ativo
    await assertSucceeds(updateDoc(doc(como(GESTOR), 'gamification_challenges', 'd_arena'), { status: 'cancelled' }));
    await assertSucceeds(deleteDoc(doc(como(GESTOR), 'gamification_challenges', 'd_arena')));
  });
});

describe('⭐ entrar num desafio', () => {
  const entrada = (uid, over = {}) => ({ challengeId: 'd1', subjectType: 'athlete', subjectId: uid, uid, joinedAt: AGORA, value: 0, position: null, finalized: false, prizeXp: 0, ...over });

  it('o atleta entra a si mesmo, zerado, em desafio ativo', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'challenge_entries', `d1_${ANA}`), entrada(ANA)));
  });

  it('não entra por outra pessoa, nem com valor, posição ou prêmio', async () => {
    await assertFails(setDoc(doc(como(ANA), 'challenge_entries', `d1_${BIA}`), entrada(BIA, { uid: ANA })));
    await assertFails(setDoc(doc(como(ANA), 'challenge_entries', `d1_${ANA}`), entrada(ANA, { value: 99 })));
    await assertFails(setDoc(doc(como(ANA), 'challenge_entries', `d1_${ANA}`), entrada(ANA, { position: 1 })));
    await assertFails(setDoc(doc(como(ANA), 'challenge_entries', `d1_${ANA}`), entrada(ANA, { prizeXp: 500 })));
    await assertFails(setDoc(doc(como(ANA), 'challenge_entries', `d1_${ANA}`), entrada(ANA, { eligible: true })));
  });

  it('só em desafio ativo e dentro do prazo; o id carrega o desafio e a pessoa', async () => {
    await assertFails(setDoc(doc(como(ANA), 'challenge_entries', `d_fim_${ANA}`), entrada(ANA, { challengeId: 'd_fim' })));
    await assertFails(setDoc(doc(como(ANA), 'challenge_entries', `d_rascunho_${ANA}`), entrada(ANA, { challengeId: 'd_rascunho' })));
    await assertFails(setDoc(doc(como(ANA), 'challenge_entries', 'qualquer'), entrada(ANA)));
    await assertFails(setDoc(doc(como(ANA), 'challenge_entries', `inexistente_${ANA}`), entrada(ANA, { challengeId: 'inexistente' })));
    await testEnv.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'gamification_challenges', 'd_vencido'), desafio({ endsAt: AGORA - 1000, startsAt: AGORA - 5 * DIA })));
    await assertFails(setDoc(doc(como(ANA), 'challenge_entries', `d_vencido_${ANA}`), entrada(ANA, { challengeId: 'd_vencido' })));
  });

  it('desafio entre clubes: entra o admin do clube; atleta não entra em desafio de clubes (nem o contrário)', async () => {
    const porClube = (clube, over = {}) => ({ challengeId: 'd_clube', subjectType: 'club', subjectId: clube, uid: ADM_CLUBE, joinedAt: AGORA, value: 0, position: null, finalized: false, prizeXp: 0, ...over });
    await assertSucceeds(setDoc(doc(como(ADM_CLUBE), 'challenge_entries', 'd_clube_club_clube_1'), porClube('clube_1')));
    await assertFails(setDoc(doc(como(ANA), 'challenge_entries', 'd_clube_club_clube_1'), porClube('clube_1', { uid: ANA }))); // membro, não admin
    await assertFails(setDoc(doc(como(ANA), 'challenge_entries', `d_clube_${ANA}`), entrada(ANA, { challengeId: 'd_clube' })));
    await assertFails(setDoc(doc(como(ADM_CLUBE), 'challenge_entries', 'd1_club_clube_1'), porClube('clube_1', { challengeId: 'd1' })));
  });

  it('ninguém edita placar (nem o dono, nem o admin); sair vale até fechar', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'challenge_entries', `d1_${ANA}`), entrada(ANA, { value: 3, position: 2 }));
      await setDoc(doc(ctx.firestore(), 'challenge_entries', `d1_${BIA}`), entrada(BIA, { finalized: true }));
    });
    await assertFails(updateDoc(doc(como(ANA), 'challenge_entries', `d1_${ANA}`), { value: 99 }));
    await assertFails(updateDoc(doc(como(ADMIN), 'challenge_entries', `d1_${ANA}`), { value: 99 }));
    await assertFails(deleteDoc(doc(como(BIA), 'challenge_entries', `d1_${ANA}`)));
    await assertFails(deleteDoc(doc(como(BIA), 'challenge_entries', `d1_${BIA}`))); // já fechado
    await assertSucceeds(deleteDoc(doc(como(ANA), 'challenge_entries', `d1_${ANA}`)));
  });

  it('o placar é legível para quem está logado', async () => {
    await assertSucceeds(getDocs(query(collection(como(BIA), 'challenge_entries'), where('challengeId', '==', 'd1'))));
    await assertFails(getDocs(query(collection(anonimo(), 'challenge_entries'), where('challengeId', '==', 'd1'))));
  });
});

describe('⭐ duelo da semana', () => {
  const ref = (u) => doc(como(u), 'duels', '2026-09-28_ana_uid_bia_uid');

  it('só os dois leem', async () => {
    await assertSucceeds(getDoc(ref(ANA)));
    await assertSucceeds(getDoc(ref(BIA)));
    await assertSucceeds(getDoc(ref(ADMIN)));
    await assertFails(getDoc(ref(CRIS)));
  });

  it('nenhum cliente cria ou apaga duelo', async () => {
    await assertFails(setDoc(doc(como(ANA), 'duels', 'novo'), { week: 'x', uidA: ANA, uidB: CRIS, status: 'active' }));
    await assertFails(deleteDoc(ref(ANA)));
    await assertFails(deleteDoc(ref(ADMIN)));
  });

  it('um dos dois recusa — e só isso', async () => {
    await assertSucceeds(updateDoc(ref(ANA), { status: 'declined', declinedBy: ANA, declinedAt: AGORA }));
  });

  it('não dá para declarar vitória, trocar o adversário, recusar por outro ou mexer em duelo alheio', async () => {
    await assertFails(updateDoc(ref(ANA), { status: 'finished', winner: ANA }));
    await assertFails(updateDoc(ref(ANA), { uidB: CRIS }));
    await assertFails(updateDoc(ref(ANA), { status: 'declined', declinedBy: BIA }));
    await assertFails(updateDoc(ref(CRIS), { status: 'declined', declinedBy: CRIS }));
  });
});

describe('⭐ recompensas e pedidos', () => {
  const pedido = (uid, over = {}) => ({
    uid, rewardId: 'r1', issuerType: 'arena', issuerId: 'arena_1', status: 'requested', code: 'RWD-7K3QXM',
    snapshot: { tier: 'Aprendiz' }, createdAt: AGORA, ...over,
  });

  it('o emissor cria a dele (arena: o gestor); outra pessoa não', async () => {
    await assertSucceeds(setDoc(doc(como(GESTOR), 'gamification_rewards', 'nova'), recompensa()));
    await assertFails(setDoc(doc(como(ANA), 'gamification_rewards', 'nova'), recompensa({ createdBy: ANA })));
    await assertFails(setDoc(doc(como(GESTOR), 'gamification_rewards', 'nova'), recompensa({ approvedCount: 5 }))); // nasce zerada
    await assertSucceeds(setDoc(doc(como(ADMIN), 'gamification_rewards', 'plat'), recompensa({ issuerType: 'platform', issuerId: 'platform', createdBy: ADMIN })));
  });

  it('a recompensa é legível para quem está logado; só o emissor muda, e a contagem sobe de 1 em 1', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'gamification_rewards', 'r1')));
    await assertSucceeds(updateDoc(doc(como(GESTOR), 'gamification_rewards', 'r1'), { approvedCount: 1 }));
    await assertFails(updateDoc(doc(como(GESTOR), 'gamification_rewards', 'r1'), { approvedCount: 9 }));
    await assertFails(updateDoc(doc(como(GESTOR), 'gamification_rewards', 'r1'), { issuerId: 'arena_2' }));
    await assertFails(updateDoc(doc(como(ANA), 'gamification_rewards', 'r1'), { status: 'paused' }));
  });

  it('a pessoa pede (um por recompensa) com o emissor REAL', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'reward_claims', `r1_${ANA}`), pedido(ANA)));
    await assertFails(setDoc(doc(como(ANA), 'reward_claims', `r1_${BIA}`), pedido(BIA))); // por outra pessoa
    await assertFails(setDoc(doc(como(ANA), 'reward_claims', 'qualquer'), pedido(ANA)));
    // apontar o pedido para a fila de outro emissor
    await assertFails(setDoc(doc(como(ANA), 'reward_claims', `r1_${ANA}`), pedido(ANA, { issuerId: 'arena_2' })));
    // já nasce aprovado
    await assertFails(setDoc(doc(como(ANA), 'reward_claims', `r1_${ANA}`), pedido(ANA, { status: 'approved' })));
  });

  it('recompensa pausada não recebe pedido', async () => {
    await assertFails(setDoc(doc(como(ANA), 'reward_claims', `r_pausada_${ANA}`), pedido(ANA, { rewardId: 'r_pausada' })));
  });

  it('quem lê o pedido: a pessoa, o emissor e o admin — não outra pessoa', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'reward_claims', `r1_${ANA}`), pedido(ANA)));
    await assertSucceeds(getDoc(doc(como(ANA), 'reward_claims', `r1_${ANA}`)));
    await assertSucceeds(getDoc(doc(como(GESTOR), 'reward_claims', `r1_${ANA}`)));
    await assertSucceeds(getDoc(doc(como(ADMIN), 'reward_claims', `r1_${ANA}`)));
    await assertFails(getDoc(doc(como(BIA), 'reward_claims', `r1_${ANA}`)));
    // a fila do emissor é uma consulta provável pela regra? (issuerId + issuerType)
    await assertSucceeds(getDocs(query(collection(como(GESTOR), 'reward_claims'), where('issuerType', '==', 'arena'), where('issuerId', '==', 'arena_1'))));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'reward_claims'), where('uid', '==', ANA))));
  });

  it('o emissor aprova, recusa e marca como usada; a pessoa NÃO aprova o próprio pedido', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'reward_claims', `r1_${ANA}`), pedido(ANA)));
    const ref = (u) => doc(como(u), 'reward_claims', `r1_${ANA}`);
    await assertFails(updateDoc(ref(ANA), { status: 'approved' }));
    await assertFails(updateDoc(ref(BIA), { status: 'approved' }));
    await assertSucceeds(updateDoc(ref(GESTOR), { status: 'approved', decidedAt: AGORA }));
    await assertFails(updateDoc(ref(GESTOR), { status: 'requested' })); // não volta
    await assertFails(updateDoc(ref(GESTOR), { code: 'RWD-OUTRO1' })); // não troca o código
    await assertSucceeds(updateDoc(ref(GESTOR), { status: 'redeemed' }));
    await assertFails(updateDoc(ref(ANA), { status: 'cancelled' })); // já usada
  });

  it('a pessoa cancela o próprio pedido enquanto está aberto', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'reward_claims', `r1_${ANA}`), pedido(ANA)));
    await assertSucceeds(updateDoc(doc(como(ANA), 'reward_claims', `r1_${ANA}`), { status: 'cancelled' }));
  });
});

describe('metas do mês', () => {
  const metas = (tipo, dono, over = {}) => ({ ownerType: tipo, ownerId: dono, month: '2026-10', goals: [{ metric: 'lessons', target: 20 }], updatedAt: AGORA, ...over });

  it('cada dono lê e escreve as dele', async () => {
    await assertSucceeds(setDoc(doc(como(PROF), 'gamification_goals', `coach_${PROF}_2026-10`), metas('coach', PROF)));
    await assertSucceeds(setDoc(doc(como(GESTOR), 'gamification_goals', 'arena_arena_1_2026-10'), metas('arena', 'arena_1')));
    await assertSucceeds(setDoc(doc(como(ADM_CLUBE), 'gamification_goals', 'club_clube_1_2026-10'), metas('club', 'clube_1')));
    await assertSucceeds(getDoc(doc(como(PROF), 'gamification_goals', `coach_${PROF}_2026-10`)));
  });

  it('ninguém escreve nem lê as metas de outro', async () => {
    await assertFails(setDoc(doc(como(ANA), 'gamification_goals', `coach_${PROF}_2026-10`), metas('coach', PROF)));
    await assertFails(setDoc(doc(como(ANA), 'gamification_goals', 'club_clube_1_2026-10'), metas('club', 'clube_1'))); // membro, não admin
    await testEnv.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'gamification_goals', `coach_${PROF}_2026-10`), metas('coach', PROF)));
    await assertFails(getDoc(doc(como(ANA), 'gamification_goals', `coach_${PROF}_2026-10`)));
  });

  it('id e tamanho: o id carrega dono e mês; no máximo 6 metas', async () => {
    await assertFails(setDoc(doc(como(PROF), 'gamification_goals', 'qualquer'), metas('coach', PROF)));
    const muitas = Array.from({ length: 7 }, (_, i) => ({ metric: `m${i}`, target: 1 }));
    await assertFails(setDoc(doc(como(PROF), 'gamification_goals', `coach_${PROF}_2026-10`), metas('coach', PROF, { goals: muitas })));
  });
});

describe('notificação de gamificação', () => {
  it('o tipo `gamification` é conhecido pela regra de notificações', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'notifications', 'n1'), {
      user_id: BIA, title: 'Pedido de recompensa', message: 'x', type: 'gamification', link: '/gamification', read: false,
    }));
  });
});

describe('⭐ missões: um documento por período e XP com teto', () => {
  const missao = (uid, scope, date, over = {}) => ({
    uid, date, scope, missions: [], bonusClaimed: false, xpEarned: 0, completedAt: null, createdAt: 1, updatedAt: 1, ...over,
  });

  it('o id carrega o período: dia, semana (w) e mês (m)', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'user_missions', `${ANA}_2026-10-02`), missao(ANA, 'daily', '2026-10-02')));
    await assertSucceeds(setDoc(doc(como(ANA), 'user_missions', `${ANA}_w_2026-09-28`), missao(ANA, 'weekly', '2026-09-28')));
    await assertSucceeds(setDoc(doc(como(ANA), 'user_missions', `${ANA}_m_2026-10-01`), missao(ANA, 'monthly', '2026-10-01')));
  });

  it('não dá para fabricar documentos em série (id fora do padrão do período)', async () => {
    await assertFails(setDoc(doc(como(ANA), 'user_missions', `${ANA}_extra1`), missao(ANA, 'daily', '2026-10-02')));
    await assertFails(setDoc(doc(como(ANA), 'user_missions', `${ANA}_2026-10-02`), missao(ANA, 'weekly', '2026-10-02')));
    await assertFails(setDoc(doc(como(ANA), 'user_missions', `${ANA}_w_2026-09-28`), missao(ANA, 'weekly', '2026-09-21')));
    await assertFails(setDoc(doc(como(ANA), 'user_missions', `${ANA}_2026-10-02`), missao(ANA, 'daily', '2026-10-02 ')));
  });

  it('o XP de um documento tem teto por escopo', async () => {
    await assertFails(setDoc(doc(como(ANA), 'user_missions', `${ANA}_2026-10-02`), missao(ANA, 'daily', '2026-10-02', { xpEarned: 99999 })));
    await assertSucceeds(setDoc(doc(como(ANA), 'user_missions', `${ANA}_2026-10-02`), missao(ANA, 'daily', '2026-10-02', { xpEarned: 200 })));
    await assertFails(updateDoc(doc(como(ANA), 'user_missions', `${ANA}_2026-10-02`), { xpEarned: 700 }));
    await assertFails(setDoc(doc(como(ANA), 'user_missions', `${ANA}_w_2026-09-28`), missao(ANA, 'weekly', '2026-09-28', { xpEarned: 1600 })));
    await assertSucceeds(setDoc(doc(como(ANA), 'user_missions', `${ANA}_m_2026-10-01`), missao(ANA, 'monthly', '2026-10-01', { xpEarned: 4500 })));
  });

  it('privadas: ninguém lê as de outra pessoa; o dono lista as próprias', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'user_missions', `${ANA}_2026-10-02`), missao(ANA, 'daily', '2026-10-02')));
    await assertFails(getDoc(doc(como(BIA), 'user_missions', `${ANA}_2026-10-02`)));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'user_missions'), where('uid', '==', ANA))));
  });
});

describe('⭐ consultas que a tela faz (a regra tem de conseguir prová-las)', () => {
  it('desafios ativos: por status; sem filtro nenhum a regra recusa (rascunhos existem)', async () => {
    await assertSucceeds(getDocs(query(collection(como(ANA), 'gamification_challenges'), where('status', '==', 'active'))));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'gamification_challenges'), where('status', '==', 'finished'))));
    await assertFails(getDocs(collection(como(ANA), 'gamification_challenges')));
  });

  it('a lista do emissor (rascunhos inclusos): pelos campos do emissor', async () => {
    await assertSucceeds(getDocs(query(collection(como(GESTOR), 'gamification_challenges'),
      where('issuerType', '==', 'arena'), where('issuerId', '==', 'arena_1'))));
    await assertFails(getDocs(query(collection(como(ANA), 'gamification_challenges'),
      where('issuerType', '==', 'arena'), where('issuerId', '==', 'arena_1'))));
    await assertSucceeds(getDocs(query(collection(como(ADMIN), 'gamification_challenges'),
      where('issuerType', '==', 'platform'), where('issuerId', '==', 'platform'))));
  });

  it('duelos: um por lado; cartas recebidas; registro de autoria', async () => {
    await assertSucceeds(getDocs(query(collection(como(ANA), 'duels'), where('uidA', '==', ANA))));
    await assertSucceeds(getDocs(query(collection(como(BIA), 'duels'), where('uidB', '==', BIA))));
    await assertFails(getDocs(query(collection(como(CRIS), 'duels'), where('uidA', '==', ANA))));
    await assertSucceeds(getDocs(query(collection(como(BIA), 'partner_letters'), where('toUid', '==', BIA))));
    await assertFails(getDocs(query(collection(como(CRIS), 'partner_letters'), where('toUid', '==', BIA))));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'partner_letter_authors'), where('fromUid', '==', ANA))));
  });

  it('o Hall e a temporada pública: leitura por quem está logado', async () => {
    await assertSucceeds(getDocs(query(collection(como(BIA), 'hall_of_fame'), where('state', '==', 'PR'))));
    await assertSucceeds(getDocs(query(collection(como(BIA), 'season_rankings'), where('seasonId', '==', '2026-10'), where('public', '==', true))));
    await assertFails(getDocs(query(collection(anonimo(), 'hall_of_fame'), where('state', '==', 'PR'))));
  });
});

describe('⭐ privacidade do perfil público: a REGRA barra, não a tela', () => {
  const conquista = (uid, id = 'career_first_win') => ({
    uid, achievementId: id, family: 'career', rarity: 'common', progress: 1, unlockedAt: AGORA, notified: false, shareCount: 0, schemaVersion: 1,
  });
  const progressao = (uid) => ({
    uid, schemaVersion: 1, xpTotal: 100, level: 2, tier: 'Calouro', skillTrees: [], achievementsUnlocked: 1, achievementsTotal: 83,
    source: 'recomputed', updatedAt: AGORA, createdAt: AGORA,
  });

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'user_achievements_v2', `${BIA}_career_first_win`), conquista(BIA));
      await setDoc(doc(db, 'user_progression_v2', BIA), progressao(BIA));
    });
  });

  it('sem preferência gravada, o padrão é aparecer (nada muda para quem nunca abriu a tela)', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'user_progression_v2', BIA)));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'user_achievements_v2'), where('uid', '==', BIA))));
  });

  it('quem desligou "mostrar no perfil" some para os outros — documento e consulta', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'user_gamification_prefs', BIA), { uid: BIA, schemaVersion: 1, privacy: { showOnPublicProfile: false } });
    });
    await assertFails(getDoc(doc(como(ANA), 'user_progression_v2', BIA)));
    await assertFails(getDocs(query(collection(como(ANA), 'user_achievements_v2'), where('uid', '==', BIA))));
  });

  it('mas a própria pessoa e o admin continuam lendo', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'user_gamification_prefs', BIA), { uid: BIA, schemaVersion: 1, privacy: { showOnPublicProfile: false } });
    });
    await assertSucceeds(getDoc(doc(como(BIA), 'user_progression_v2', BIA)));
    await assertSucceeds(getDocs(query(collection(como(BIA), 'user_achievements_v2'), where('uid', '==', BIA))));
    await assertSucceeds(getDoc(doc(como(ADMIN), 'user_progression_v2', BIA)));
    await assertSucceeds(getDocs(query(collection(como(ADMIN), 'user_achievements_v2'), where('uid', '==', BIA))));
  });

  it('preferência com o campo ausente ou ligada continua mostrando', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'user_gamification_prefs', BIA), { uid: BIA, schemaVersion: 1, privacy: { showInHallOfFame: false } });
    });
    await assertSucceeds(getDoc(doc(como(ANA), 'user_progression_v2', BIA)));
  });

  it('documento que não existe continua devolvendo "não existe", não erro de permissão', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'user_progression_v2', CRIS)));
  });
});

describe('⭐ mentoria: ninguém entra sem aceitar', () => {
  const pk = `${ANA}_${BIA}`; // mentora Ana, aprendiz Bia
  const mentoria = (over = {}) => ({
    pairKey: pk, schemaVersion: 2, mentorUid: ANA, apprenticeUid: BIA, status: 'pending', proposedBy: ANA,
    lessonsCompleted: 0, startedAt: AGORA, endedAt: null, updatedAt: AGORA, ...over,
  });
  const ref = (ctx) => doc(ctx, 'mentorships', pk);

  it('o convite nasce pendente e assinado por quem convidou', async () => {
    await assertSucceeds(setDoc(ref(como(ANA)), mentoria()));
  });

  it('criar já ATIVA (vínculo unilateral) é recusado — só o admin faz isso', async () => {
    const { proposedBy: _p, ...semConvite } = mentoria({ status: 'active' });
    await assertFails(setDoc(ref(como(ANA)), semConvite));
    await assertFails(setDoc(ref(como(ANA)), mentoria({ status: 'active' })));
    await assertSucceeds(setDoc(ref(como(ADMIN)), semConvite));
  });

  it('ninguém convida em nome de outra pessoa nem de um par alheio', async () => {
    await assertFails(setDoc(ref(como(ANA)), mentoria({ proposedBy: BIA })));
    await assertFails(setDoc(ref(como(CRIS)), mentoria()));
  });

  describe('com um convite em aberto', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(ref(ctx.firestore()), mentoria()); });
    });

    it('quem foi convidado aceita; quem convidou NÃO aceita o próprio convite', async () => {
      await assertFails(updateDoc(ref(como(ANA)), { status: 'active' }));
      await assertSucceeds(updateDoc(ref(como(BIA)), { status: 'active' }));
    });

    it('qualquer lado encerra o convite (recusa ou retira)', async () => {
      await assertSucceeds(updateDoc(ref(como(BIA)), { status: 'cancelled' }));
    });

    it('um terceiro não mexe, e ninguém troca quem convidou', async () => {
      await assertFails(updateDoc(ref(como(CRIS)), { status: 'active' }));
      await assertFails(updateDoc(ref(como(BIA)), { proposedBy: BIA, status: 'active' }));
    });

    it('lê só quem é do par (e o admin)', async () => {
      await assertSucceeds(getDoc(ref(como(ANA))));
      await assertSucceeds(getDoc(ref(como(BIA))));
      await assertFails(getDoc(ref(como(CRIS))));
    });
  });

  it('mentoria já ativa segue como era: os dois lados registram aula e encerram', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(ref(ctx.firestore()), mentoria({ status: 'active' })); });
    await assertSucceeds(updateDoc(ref(como(ANA)), { lessonsCompleted: 1 }));
    await assertSucceeds(updateDoc(ref(como(BIA)), { status: 'completed', endedAt: AGORA }));
  });

  it('mentoria antiga (sem convite gravado) continua editável pelos dois', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const { proposedBy: _p, ...antiga } = mentoria({ status: 'active' });
      await setDoc(ref(ctx.firestore()), antiga);
    });
    await assertSucceeds(updateDoc(ref(como(BIA)), { lessonsCompleted: 2 }));
  });
});

describe('⭐ sequência: as férias gravam um campo opcional, sem regra nova', () => {
  const meta = (uid, over = {}) => ({
    uid, schemaVersion: 1, lastPlayAt: null, graceDaysRemaining: 3, freezesAvailable: 3,
    freezesUsed: 0, vacationMode: false, vacationStartedAt: null, comebackBonus: 0, updatedAt: AGORA, ...over,
  });
  const ferias = [{ from: AGORA - 40 * DIA, to: AGORA - 30 * DIA }, { from: AGORA - DIA, to: null }];

  it('a pessoa grava os períodos de férias no próprio documento (a regra de sempre os aceita)', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'user_streak_meta', ANA), meta(ANA, { vacationMode: true, vacationStartedAt: AGORA - DIA, vacations: ferias })));
    await assertSucceeds(updateDoc(doc(como(ANA), 'user_streak_meta', ANA), { vacationMode: false, vacationStartedAt: null, vacations: [{ ...ferias[0] }, { from: AGORA - DIA, to: AGORA }] }));
  });

  it('o documento antigo (sem `vacations`) continua válido', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'user_streak_meta', ANA), meta(ANA)));
  });

  it('é privado e é da própria pessoa: ninguém lê nem grava o de outra', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'user_streak_meta', ANA), meta(ANA, { vacations: ferias })); });
    await assertFails(getDoc(doc(como(BIA), 'user_streak_meta', ANA)));
    await assertFails(setDoc(doc(como(BIA), 'user_streak_meta', ANA), meta(ANA, { vacations: [] })));
    await assertFails(setDoc(doc(como(ANA), 'user_streak_meta', ANA), meta(BIA, { vacations: ferias })));
    await assertSucceeds(getDoc(doc(como(ANA), 'user_streak_meta', ANA)));
  });

  it('o retrato com o funil dos primeiros passos segue sendo só do admin (leitura) e do servidor (escrita)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'gamification_metrics', '2026-10-03'), { day: '2026-10-03', athletes: 3, onboarding: { dismissed: 1, steps: { level: 2 } } });
    });
    await assertSucceeds(getDoc(doc(como(ADMIN), 'gamification_metrics', '2026-10-03')));
    await assertFails(getDoc(doc(como(ANA), 'gamification_metrics', '2026-10-03')));
    await assertFails(updateDoc(doc(como(ADMIN), 'gamification_metrics', '2026-10-03'), { onboarding: { dismissed: 0, steps: {} } }));
    // o admin lista os mais novos (orderBy de um campo só) sem índice composto
    await assertSucceeds(getDocs(query(collection(como(ADMIN), 'gamification_metrics'))));
  });
});
