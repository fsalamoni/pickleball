/**
 * Exclusão de cadastro — a GAMIFICAÇÃO, com as especificações reais, contra o
 * Firestore falso (PR 0b da carreira: lacunas que existiam).
 *
 * O que estes testes protegem:
 *  1. o que é só da pessoa some: concessões de XP, preferências, reputação
 *     (pública e privada), linha do Hall da Fama, fotografia da integridade,
 *     decisão de moderação (a auditoria guarda o histórico), sinais de
 *     integridade SOBRE ela, avaliações SOBRE ela, entradas em desafio como
 *     atleta e as metas de professor (nunca as de uma casa de mesmo id);
 *     o sinal em que ela é só a outra metade do par é sobre quem fica e fica;
 *  2. ⭐ a carta ao companheiro é das duas pessoas: a que recebeu E a que
 *     escreveu somem — inclusive a ANÔNIMA, achada pelo registro de autoria;
 *  3. o duelo fica para o adversário, sem o nome; a avaliação que ESCREVEU,
 *     o pedido de recompensa e o desafio/recompensa que criou ficam (só uid);
 *  4. ⭐ NENHUM documento de outra pessoa some — a lista é conferida inteira.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { analyzeAccount, executeAccountDeletion, REMOVED_ATHLETE } = require('../functions/accountDeletion.js');
const { createFakeDb, createFakeAuth, createFakeBucket, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const HOJE = '2026-11-04';
const ADMIN = { uid: 'admin', name: 'Dono', email: 'dono@x.com' };

function cenario() {
  const db = createFakeDb({
    'users/ana': { uid: 'ana', full_name: 'Ana Souza' },
    'users/bia': { uid: 'bia', full_name: 'Bia Lima' },
    // concessões e preferências
    'user_xp_grants/ana_season_2026-10': { uid: 'ana', kind: 'season', xp: 500 },
    'user_xp_grants/bia_season_2026-10': { uid: 'bia', kind: 'season', xp: 50 },
    'user_gamification_prefs/ana': { uid: 'ana', privacy: {} },
    'user_gamification_prefs/bia': { uid: 'bia', privacy: {} },
    // reputação e avaliações
    'user_reputation/ana': { uid: 'ana', count: 6 },
    'user_reputation_private/ana': { uid: 'ana', issues: { late: 1 } },
    'user_reputation/bia': { uid: 'bia', count: 2 },
    'match_reviews/g1__bia__ana': { fromUid: 'bia', toUid: 'ana', matchKey: 'g1', rating: 5 },
    'match_reviews/g1__ana__bia': { fromUid: 'ana', toUid: 'bia', matchKey: 'g1', rating: 4 },
    // cartas
    'partner_letters/g1__bia__ana': { toUid: 'ana', fromUid: 'bia', fromName: 'Bia Lima', showName: true, text: 'Boa!' },
    'partner_letter_authors/g1__bia__ana': { fromUid: 'bia', toUid: 'ana', matchKey: 'g1' },
    'partner_letters/g1__ana__bia': { toUid: 'bia', fromUid: 'ana', fromName: 'Ana Souza', showName: true, text: 'Valeu' },
    'partner_letter_authors/g1__ana__bia': { fromUid: 'ana', toUid: 'bia', matchKey: 'g1' },
    'partner_letters/g2__ana__bia': { toUid: 'bia', fromUid: null, fromName: null, showName: false, text: 'Anônima' },
    'partner_letter_authors/g2__ana__bia': { fromUid: 'ana', toUid: 'bia', matchKey: 'g2' },
    'partner_letters/g3__cris__bia': { toUid: 'bia', fromUid: null, fromName: null, showName: false, text: 'De outra' },
    'partner_letter_authors/g3__cris__bia': { fromUid: 'cris', toUid: 'bia', matchKey: 'g3' },
    // hall, integridade, moderação, sinais
    'hall_of_fame/ana': { uid: 'ana', name: 'Ana Souza', xp: 9000 },
    'hall_of_fame/bia': { uid: 'bia', name: 'Bia Lima', xp: 100 },
    'gamification_integrity/ana': { xp: 9000, at: 1 },
    'gamification_moderation/ana': { excluded: false, hiddenFromPublic: true, reason: 'x', by: 'admin' },
    'gamification_flags/xp_unverified_ana': { type: 'xp_unverified', subjectUid: 'ana', status: 'open' },
    'gamification_flags/kudos_ring_bia_cris_w': { type: 'kudos_ring', subjectUid: 'bia', otherUid: 'ana', status: 'open' },
    'gamification_flags/xp_unverified_bia': { type: 'xp_unverified', subjectUid: 'bia', status: 'open' },
    'gamification_metrics/2026-11-01': { day: '2026-11-01', athletes: 10 },
    // desafios, duelos e recompensas
    'gamification_challenges/c1': { createdBy: 'ana', issuerType: 'coach', issuerId: 'ana', title: 'Desafio' },
    'challenge_entries/c1_ana': { challengeId: 'c1', subjectType: 'athlete', subjectId: 'ana', uid: 'ana' },
    'challenge_entries/c1_club_k1': { challengeId: 'c1', subjectType: 'club', subjectId: 'k1', uid: 'ana' },
    'challenge_entries/c1_bia': { challengeId: 'c1', subjectType: 'athlete', subjectId: 'bia', uid: 'bia' },
    'duels/2026-W44_d1': { uidA: 'ana', uidB: 'bia', nameA: 'Ana Souza', nameB: 'Bia Lima', status: 'finished' },
    'gamification_rewards/r1': { createdBy: 'ana', issuerType: 'coach', issuerId: 'ana', title: 'Aula grátis' },
    'reward_claims/r1_bia': { uid: 'bia', rewardId: 'r1', issuerType: 'coach', issuerId: 'ana', status: 'approved' },
    'reward_claims/r9_ana': { uid: 'ana', rewardId: 'r9', issuerType: 'arena', issuerId: 'a1', status: 'redeemed' },
    'gamification_goals/coach_ana_2026-11': { ownerType: 'coach', ownerId: 'ana', month: '2026-11', goals: [] },
    'gamification_goals/arena_a1_2026-11': { ownerType: 'arena', ownerId: 'a1', month: '2026-11', goals: [] },
    // id de casa que coincide com o uid: a meta da arena nunca sai junto
    'gamification_goals/arena_ana_2026-11': { ownerType: 'arena', ownerId: 'ana', month: '2026-11', goals: [] },
  });
  const auth = createFakeAuth(['ana', 'bia'], { log: db.store.log });
  const bucket = createFakeBucket([]);
  return { db, ctx: { db, auth, bucket } };
}

const linha = (xs, label) => (xs.find((x) => x.label === label) || { count: 0 }).count;

describe('a exclusão cobre a gamificação', () => {
  it('⭐ apaga EXATAMENTE o que é da pessoa — nenhum documento de outra pessoa some', async () => {
    const { db, ctx } = cenario();
    const antes = new Set(db.store.docs.keys());
    const r = await executeAccountDeletion(ctx, 'ana', {
      actor: ADMIN, reason: 'pedido da titular', hojeISO: HOJE, FieldValue: FakeFieldValue,
    });
    expect(r.status).toBe('deleted');
    const sumiram = [...antes].filter((p) => !db.store.docs.has(p)).sort();
    expect(sumiram).toEqual([
      'challenge_entries/c1_ana',
      'gamification_flags/xp_unverified_ana',
      'gamification_goals/coach_ana_2026-11',
      'gamification_integrity/ana',
      'gamification_moderation/ana',
      'hall_of_fame/ana',
      'match_reviews/g1__bia__ana',
      'partner_letter_authors/g1__ana__bia',
      'partner_letter_authors/g1__bia__ana',
      'partner_letter_authors/g2__ana__bia',
      'partner_letters/g1__ana__bia',
      'partner_letters/g1__bia__ana',
      'partner_letters/g2__ana__bia',
      'user_gamification_prefs/ana',
      'user_reputation/ana',
      'user_reputation_private/ana',
      'user_xp_grants/ana_season_2026-10',
      'users/ana',
    ]);
  });

  it('o duelo fica para o adversário, sem o nome de quem saiu', async () => {
    const { db, ctx } = cenario();
    await executeAccountDeletion(ctx, 'ana', { actor: ADMIN, reason: 'pedido da titular', hojeISO: HOJE, FieldValue: FakeFieldValue });
    const d = db.store.docs.get('duels/2026-W44_d1');
    expect(d.nameA).toBe(REMOVED_ATHLETE);
    expect(d.nameB).toBe('Bia Lima');
  });

  it('a prévia conta o que some e o que fica, sem gravar nada', async () => {
    const { db, ctx } = cenario();
    const antes = new Map(db.store.docs);
    const { report } = await analyzeAccount(ctx, 'ana', { actorUid: 'admin', hojeISO: HOJE });
    expect(linha(report.deletes, 'Cartas ao companheiro que escreveu (somem também para quem recebeu)')).toBe(4);
    expect(linha(report.deletes, 'XP concedido pelo servidor (gamificação)')).toBe(1);
    expect(linha(report.retained, 'Avaliações pós-jogo que fez (só estrelas e o uid)')).toBe(1);
    expect(linha(report.retained, 'Desafios que criou (como emissor)')).toBe(1);
    expect(linha(report.retained, 'Recompensas que criou (como emissor)')).toBe(1);
    expect(linha(report.retained, 'Pedidos de recompensa que fez')).toBe(1);
    // o anel em que a ana é só a outra metade é sobre a bia: fica para o admin
    expect(linha(report.retained, 'Sinais de integridade sobre outra conta (ficam para o admin)')).toBe(1);
    // a inscrição do clube fica, e a prévia diz
    expect(linha(report.retained, 'Inscrições de clube em desafios (ficam com o clube)')).toBe(1);
    expect(linha(report.pseudonyms, 'Duelos da semana')).toBe(1);
    expect(db.store.log).toEqual([]);
    expect(db.store.docs).toEqual(antes);
  });
});
