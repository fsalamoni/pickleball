/**
 * As tarefas agendadas da gamificação, contra um Firestore falso em memória.
 * O que se prova aqui é o que o teste de função pura não alcança: ordem das
 * leituras, idempotência (rodar de novo não duplica prêmio nem aviso), respeito
 * às escolhas das pessoas e ao painel do admin.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createRichFakeDb } = require('../tests/fakes/fakeFirestoreRico.cjs');
const g = require('./gamification.js');

const ms = (iso) => new Date(iso).getTime();
const NOW = ms('2026-10-05T10:00:00Z'); // segunda 07:00 em Brasília
const logger = { info() {}, error() {}, warn() {}, debug() {} };

const LIGADA = { 'platform_settings/global': { feature_flags: { gamification_v2: true } } };

/** Um jogo de dia de jogo publicado (espelho em club_event_games). */
function jogo(id, a, b, winner, iso) {
  return [`club_event_games/${id}`, {
    status: 'finished', winner_side: winner, side_a_ids: a, side_b_ids: b,
    score_a: winner === 'a' ? 11 : 5, score_b: winner === 'b' ? 11 : 5,
    result_recorded_at: ms(iso), club_id: 'c', event_id: 'e', source: 'athlete_game_day',
  }];
}
const seed = (...itens) => Object.fromEntries(itens.flatMap((i) => (Array.isArray(i[0]) ? i : [i])));

describe('flag mestra e módulos', () => {
  it('com a flag desligada nada roda', async () => {
    const db = createRichFakeDb({});
    expect(await g.runWeeklyDuels(db, { now: NOW, logger })).toEqual({ skipped: 'flag_desligada' });
    expect(await g.runChallengeStandings(db, { now: NOW, logger })).toEqual({ skipped: 'flag_desligada' });
    expect(await g.runReputation(db, { logger })).toEqual({ skipped: 'flag_desligada' });
    expect(await g.runWeeklyDigest(db, { now: NOW, logger })).toEqual({ skipped: 'flag_desligada' });
  });

  it('módulo desligado pelo admin para a tarefa', async () => {
    const db = createRichFakeDb({ ...LIGADA, 'platform_settings/gamification': { modules: { duels: false, challenges: false, match_reviews: false } } });
    expect(await g.runWeeklyDuels(db, { now: NOW, logger })).toEqual({ skipped: 'modulo_desligado' });
    expect(await g.runChallengeStandings(db, { now: NOW, logger })).toEqual({ skipped: 'modulo_desligado' });
    expect(await g.runReputation(db, { logger })).toEqual({ skipped: 'modulo_desligado' });
  });

  it('a configuração é normalizada (fora da faixa volta ao limite)', () => {
    const c = g.normalizarConfig({ duels: { winnerXp: 999999 }, reviews: { minForPublicScore: 1 } });
    expect(c.duels.winnerXp).toBe(1000);
    expect(c.reviews.minForPublicScore).toBe(3);
  });
});

describe('duelo da semana', () => {
  const base = () => seed(
    LIGADA,
    // semana passada (21–27/09): ana ganha de bia (2 × 1 vitórias nos jogos que cada uma jogou)
    jogo('g1', ['ana', 'x1'], ['bia', 'x2'], 'a', '2026-09-29T15:00:00Z'),
  );

  it('emparelha por nível e respeita quem recusou duelos', async () => {
    const db = createRichFakeDb({
      ...LIGADA,
      ...seed(
        jogo('g1', ['ana', 'bia'], ['cris', 'dedé'], 'a', '2026-09-30T15:00:00Z'),
      ),
      'player_skill_ratings/ana': { doubles_rating: 4.0, state: 'PR', platform_name: 'Ana' },
      'player_skill_ratings/bia': { doubles_rating: 4.2, state: 'PR', platform_name: 'Bia' },
      'player_skill_ratings/cris': { doubles_rating: 6.0, state: 'SP', platform_name: 'Cris' },
      'player_skill_ratings/dedé': { doubles_rating: 6.3, state: 'SP', platform_name: 'Dedé' },
      'user_gamification_prefs/dedé': { social: { acceptDuels: false } },
    });
    const r = await g.runWeeklyDuels(db, { now: NOW, logger });
    expect(r.created).toBe(1); // dedé recusou, cris fica sem par
    const duelos = db.dump('duels');
    expect(Object.keys(duelos)).toEqual(['2026-10-05_ana_bia']);
    expect(duelos['2026-10-05_ana_bia']).toMatchObject({ status: 'active', nameA: 'Ana', nameB: 'Bia' });
    expect(Object.keys(db.dump('notifications')).sort()).toEqual(['duelnew_2026-10-05_ana_bia_ana', 'duelnew_2026-10-05_ana_bia_bia']);
  });

  it('rodar de novo na mesma semana não duplica duelo nem aviso', async () => {
    const db = createRichFakeDb({
      ...LIGADA,
      ...seed(jogo('g1', ['ana', 'bia'], ['cris', 'dedé'], 'a', '2026-09-30T15:00:00Z')),
      'player_skill_ratings/ana': { doubles_rating: 4.0 }, 'player_skill_ratings/bia': { doubles_rating: 4.2 },
    });
    await g.runWeeklyDuels(db, { now: NOW, logger });
    const antes = db.store.docs.size;
    const r = await g.runWeeklyDuels(db, { now: NOW + 3600_000, logger });
    expect(r.created).toBe(0);
    expect(db.store.docs.size).toBe(antes);
  });

  it('fecha o duelo da semana passada: vencedor ganha o prêmio, quem jogou ganha participação, e é idempotente', async () => {
    const db = createRichFakeDb({
      ...LIGADA,
      ...seed(
        jogo('g1', ['ana', 'x'], ['y', 'z'], 'a', '2026-09-29T15:00:00Z'),
        jogo('g2', ['ana', 'x'], ['y', 'z'], 'a', '2026-09-30T15:00:00Z'),
        jogo('g3', ['bia', 'x'], ['y', 'z'], 'a', '2026-10-01T15:00:00Z'),
      ),
      'duels/2026-09-28_ana_bia': { week: '2026-09-28', uidA: 'ana', uidB: 'bia', status: 'active' },
    });
    await g.runWeeklyDuels(db, { now: NOW, logger });
    expect(db.dump('duels')['2026-09-28_ana_bia']).toMatchObject({ status: 'finished', winner: 'ana', outcome: 'a' });
    const grants = db.dump('user_xp_grants');
    expect(grants['ana_duel_2026-09-28_2026-09-28_ana_bia']).toMatchObject({ kind: 'duel', xp: 200, uid: 'ana' });
    expect(grants['bia_duel_2026-09-28_2026-09-28_ana_bia']).toMatchObject({ xp: 50 });
    // segunda passada: o duelo já está fechado, nada novo
    const n = db.store.docs.size;
    await g.runWeeklyDuels(db, { now: NOW + 60_000, logger });
    expect(Object.keys(db.dump('user_xp_grants')).length).toBe(2);
    expect(db.store.docs.size).toBeGreaterThanOrEqual(n);
  });

  it('duelo em que ninguém jogou não gera XP', async () => {
    const db = createRichFakeDb({
      ...LIGADA,
      'duels/2026-09-28_ana_bia': { week: '2026-09-28', uidA: 'ana', uidB: 'bia', status: 'active' },
    });
    await g.runWeeklyDuels(db, { now: NOW, logger });
    expect(db.dump('duels')['2026-09-28_ana_bia'].outcome).toBe('void');
    expect(db.dump('user_xp_grants')).toEqual({});
  });
});

describe('desafios', () => {
  const desafio = (extra = {}) => ({
    status: 'active', issuerType: 'platform', issuerId: 'platform', title: 'Mês do Iniciante',
    metric: 'games_played', subject: 'athlete', startsAt: ms('2026-10-01T03:00:00Z'), endsAt: ms('2026-10-31T03:00:00Z'),
    prizes: [{ place: 1, label: 'Troféu', xp: 500 }, { place: 2, label: 'Medalha', xp: 200 }], ...extra,
  });
  const entrada = (uid, joinedAt = 1) => ({ challengeId: 'd1', subjectType: 'athlete', subjectId: uid, uid, joinedAt, value: 0, position: null });
  const jogos = seed(
    jogo('g1', ['ana', 'x'], ['bia', 'y'], 'a', '2026-10-02T15:00:00Z'),
    jogo('g2', ['ana', 'x'], ['bia', 'y'], 'a', '2026-10-03T15:00:00Z'),
    jogo('g3', ['ana', 'x'], ['cris', 'y'], 'a', '2026-10-04T15:00:00Z'),
  );

  it('atualiza o placar durante o desafio, sem premiar', async () => {
    const db = createRichFakeDb({
      ...LIGADA, ...jogos,
      'gamification_challenges/d1': desafio(),
      'challenge_entries/d1_ana': entrada('ana'), 'challenge_entries/d1_bia': entrada('bia'), 'challenge_entries/d1_cris': entrada('cris'),
      'athlete_profiles/ana': {}, 'athlete_profiles/bia': {}, 'athlete_profiles/cris': {},
    });
    await g.runChallengeStandings(db, { now: NOW, logger });
    const e = db.dump('challenge_entries');
    expect(e.d1_ana).toMatchObject({ value: 3, position: 1, finalized: false });
    expect(e.d1_bia).toMatchObject({ value: 2, position: 2 });
    expect(e.d1_cris).toMatchObject({ value: 1, position: 3 });
    expect(db.dump('user_xp_grants')).toEqual({});
    expect(db.dump('gamification_challenges').d1.status).toBe('active');
  });

  it('ao fim: premia o pódio com XP (só plataforma), avisa e não duplica se rodar de novo', async () => {
    const db = createRichFakeDb({
      ...LIGADA, ...jogos,
      'gamification_challenges/d1': desafio({ endsAt: ms('2026-10-05T03:00:00Z') }),
      'challenge_entries/d1_ana': entrada('ana'), 'challenge_entries/d1_bia': entrada('bia'), 'challenge_entries/d1_cris': entrada('cris'),
      'athlete_profiles/ana': {}, 'athlete_profiles/bia': {}, 'athlete_profiles/cris': {},
    });
    await g.runChallengeStandings(db, { now: NOW, logger });
    expect(db.dump('gamification_challenges').d1).toMatchObject({ status: 'finished', participants: 3 });
    const grants = db.dump('user_xp_grants');
    expect(grants.ana_challenge_d1).toMatchObject({ xp: 500, kind: 'challenge' });
    expect(grants.bia_challenge_d1).toMatchObject({ xp: 200 });
    expect(grants.cris_challenge_d1).toBeUndefined();
    expect(Object.keys(db.dump('notifications')).sort()).toEqual(['chres_d1_ana', 'chres_d1_bia', 'chres_d1_cris']);
    // já finalizado (status finished): a próxima passada nem o considera
    const n = db.store.docs.size;
    await g.runChallengeStandings(db, { now: NOW + 60_000, logger });
    expect(db.store.docs.size).toBe(n);
  });

  it('XP de prêmio de desafio de arena, clube ou professor NUNCA é concedido (só o da plataforma)', async () => {
    const db = createRichFakeDb({
      ...LIGADA, ...jogos,
      'gamification_challenges/d1': desafio({ issuerType: 'arena', issuerId: 'a1', endsAt: ms('2026-10-05T03:00:00Z'), prizes: [{ place: 1, label: 'Camiseta', xp: 2000 }] }),
      'challenge_entries/d1_ana': entrada('ana'), 'athlete_profiles/ana': {},
    });
    await g.runChallengeStandings(db, { now: NOW, logger });
    expect(db.dump('user_xp_grants')).toEqual({});
    expect(db.dump('challenge_entries').d1_ana.prizeXp).toBe(0);
    expect(db.dump('gamification_challenges').d1.status).toBe('finished'); // o resultado existe; o XP, não
  });

  it('quem recusou o aviso de resultado não recebe, mas continua no placar', async () => {
    const db = createRichFakeDb({
      ...LIGADA, ...jogos,
      'gamification_challenges/d1': desafio({ endsAt: ms('2026-10-05T03:00:00Z') }),
      'challenge_entries/d1_ana': entrada('ana'), 'challenge_entries/d1_bia': entrada('bia'),
      'athlete_profiles/ana': {}, 'athlete_profiles/bia': {},
      'user_gamification_prefs/bia': { notifications: { challengeResults: false } },
    });
    await g.runChallengeStandings(db, { now: NOW, logger });
    expect(Object.keys(db.dump('notifications'))).toEqual(['chres_d1_ana']);
  });

  it('desafio de CLUBE só conta membros; de professor, só alunos; de região, só do estado', async () => {
    const db = createRichFakeDb({
      ...LIGADA, ...jogos,
      'gamification_challenges/d1': desafio({ issuerType: 'club', issuerId: 'c1' }),
      'gamification_challenges/d2': desafio({ issuerType: 'coach', issuerId: 'prof' }),
      'gamification_challenges/d3': desafio({ regionState: 'SP' }),
      'challenge_entries/d1_ana': { ...entrada('ana'), challengeId: 'd1' }, 'challenge_entries/d1_bia': { ...entrada('bia'), challengeId: 'd1' },
      'challenge_entries/d2_ana': { ...entrada('ana'), challengeId: 'd2' }, 'challenge_entries/d2_bia': { ...entrada('bia'), challengeId: 'd2' },
      'challenge_entries/d3_ana': { ...entrada('ana'), challengeId: 'd3' }, 'challenge_entries/d3_bia': { ...entrada('bia'), challengeId: 'd3' },
      'athlete_profiles/ana': { state: 'PR' }, 'athlete_profiles/bia': { state: 'SP' },
      'club_members/m1': { club_id: 'c1', user_id: 'ana' },
      'coach_students/s1': { coach_id: 'prof', student_id: 'bia' },
    });
    await g.runChallengeStandings(db, { now: NOW, logger });
    const e = db.dump('challenge_entries');
    expect(e.d1_ana.eligible).toBe(true);
    expect(e.d1_bia.eligible).toBe(false);
    expect(e.d2_ana.eligible).toBe(false);
    expect(e.d2_bia.eligible).toBe(true);
    expect(e.d3_ana.eligible).toBe(false);
    expect(e.d3_bia.eligible).toBe(true);
    expect(e.d1_bia.position).toBeNull(); // inelegível não ocupa posição
  });

  it('desafio ENTRE CLUBES soma os jogos dos membros e não dá XP', async () => {
    const db = createRichFakeDb({
      ...LIGADA, ...jogos,
      'gamification_challenges/d1': desafio({ subject: 'club', prizes: [{ place: 1, label: 'Clínica', xp: 0 }] }),
      'challenge_entries/d1_club_c1': { challengeId: 'd1', subjectType: 'club', subjectId: 'c1', uid: 'adm1', joinedAt: 1, value: 0 },
      'challenge_entries/d1_club_c2': { challengeId: 'd1', subjectType: 'club', subjectId: 'c2', uid: 'adm2', joinedAt: 2, value: 0 },
      'club_members/m1': { club_id: 'c1', user_id: 'ana' }, 'club_members/m2': { club_id: 'c2', user_id: 'bia' },
    });
    await g.runChallengeStandings(db, { now: NOW, logger });
    const e = db.dump('challenge_entries');
    expect(e.d1_club_c1).toMatchObject({ value: 3, position: 1 });
    expect(e.d1_club_c2).toMatchObject({ value: 2, position: 2 });
    expect(db.dump('user_xp_grants')).toEqual({});
  });
});

describe('reputação', () => {
  const rv = (id, from, to, rating, matchKey, extra = {}) => [`match_reviews/${id}`, { fromUid: from, toUid: to, matchKey, rating, tags: ['pontual'], issues: [], createdAt: 1, ...extra }];

  it('só vale avaliação de quem jogou; a nota pública exige amostra; problemas ficam no privado', async () => {
    const jogos = seed(
      jogo('g1', ['a1', 'a2'], ['b1', 'b2'], 'a', '2026-10-01T15:00:00Z'),
    );
    const avals = seed(
      rv('r1', 'a2', 'a1', 5, 'gd:g1'),
      rv('r2', 'b1', 'a1', 5, 'gd:g1'),
      rv('r3', 'b2', 'a1', 4, 'gd:g1', { issues: ['pontualidade'] }),
      rv('r4', 'intruso', 'a1', 1, 'gd:g1'), // não jogou
      rv('r5', 'a2', 'a1', 5, 'gd:inexistente'), // jogo que não existe
    );
    const db = createRichFakeDb({ ...LIGADA, ...jogos, ...avals });
    const r = await g.runReputation(db, { logger });
    expect(r).toMatchObject({ reviews: 5, valid: 3, people: 1 });
    const rep = db.dump('user_reputation').a1;
    expect(rep).toMatchObject({ count: 3, average: null, publicScore: false, fiveStarCount: 2 });
    expect(rep.issues).toBeUndefined(); // categorias de problema não são públicas
    expect(db.dump('user_reputation_private').a1.issues).toEqual({ pontualidade: 1 });
  });

  it('quem não aceita avaliações não ganha documento', async () => {
    const db = createRichFakeDb({
      ...LIGADA, ...seed(jogo('g1', ['a1', 'a2'], ['b1', 'b2'], 'a', '2026-10-01T15:00:00Z'), rv('r1', 'a2', 'a1', 5, 'gd:g1')),
      'user_gamification_prefs/a1': { social: { acceptReviews: false } },
    });
    await g.runReputation(db, { logger });
    expect(db.dump('user_reputation')).toEqual({});
  });
});

describe('integridade', () => {
  it('sinaliza XP sem lastro e o salto; não sinaliza o legítimo; não reabre o que o admin dispensou', async () => {
    const db = createRichFakeDb({
      ...LIGADA,
      'user_progression_v2/trapaceiro': { uid: 'trapaceiro', xpTotal: 90000, grantsXp: 0, updatedAt: 1 },
      'user_progression_v2/legitimo': { uid: 'legitimo', xpTotal: 300, grantsXp: 0, updatedAt: 1 },
    });
    const r = await g.runIntegrity(db, { now: NOW, logger });
    expect(r.flags).toBe(1);
    const flags = db.dump('gamification_flags');
    expect(Object.keys(flags)).toEqual(['xp_unverified_trapaceiro']);
    expect(flags.xp_unverified_trapaceiro).toMatchObject({ status: 'open', severity: 'high', subjectUid: 'trapaceiro' });
    // o admin dispensa; a próxima passada não reabre
    await db.collection('gamification_flags').doc('xp_unverified_trapaceiro').update({ status: 'dismissed' });
    const r2 = await g.runIntegrity(db, { now: NOW + 86_400_000, logger });
    expect(r2.flags).toBe(0);
    expect(db.dump('gamification_flags').xp_unverified_trapaceiro.status).toBe('dismissed');
  });

  it('anel de kudos e vingança nas avaliações', async () => {
    const kudos = {};
    for (let i = 0; i < 6; i += 1) {
      kudos[`user_kudos/ab${i}`] = { fromUid: 'a', toUid: 'b', createdAt: NOW - 1000 };
      kudos[`user_kudos/ba${i}`] = { fromUid: 'b', toUid: 'a', createdAt: NOW - 1000 };
    }
    const db = createRichFakeDb({
      ...LIGADA, ...kudos,
      'match_reviews/r1': { fromUid: 'c', toUid: 'd', matchKey: 'gd:x', rating: 1, createdAt: NOW - 1000 },
      'match_reviews/r2': { fromUid: 'd', toUid: 'c', matchKey: 'gd:x', rating: 5, createdAt: NOW - 1000 },
    });
    await g.runIntegrity(db, { now: NOW, logger });
    const tipos = Object.values(db.dump('gamification_flags')).map((f) => f.type).sort();
    expect(tipos).toEqual(['kudos_ring', 'review_retaliation']);
  });
});

describe('resumo da semana', () => {
  it('avisa quem jogou na semana passada, uma vez, e respeita a escolha', async () => {
    const db = createRichFakeDb({
      ...LIGADA,
      ...seed(
        jogo('g1', ['ana', 'x'], ['bia', 'y'], 'a', '2026-09-29T15:00:00Z'),
        jogo('g2', ['ana', 'x'], ['bia', 'y'], 'b', '2026-09-30T15:00:00Z'),
      ),
      'user_gamification_prefs/bia': { notifications: { weeklyReview: false } },
    });
    const r = await g.runWeeklyDigest(db, { now: NOW, logger });
    expect(r.sent).toBe(3); // ana, x e y — bia recusou
    expect(db.dump('notifications')['weekly_ana_2026-09-28']).toMatchObject({ title: 'Sua semana em revisão', link: '/gamification/revisao' });
    expect(db.dump('notifications')['weekly_bia_2026-09-28']).toBeUndefined();
    expect((await g.runWeeklyDigest(db, { now: NOW + 3600_000, logger })).sent).toBe(0);
  });

  it('desligado pelo admin, não envia', async () => {
    const db = createRichFakeDb({ ...LIGADA, 'platform_settings/gamification': { notifications: { weeklyReview: false } } });
    expect(await g.runWeeklyDigest(db, { now: NOW, logger })).toEqual({ skipped: 'desligado' });
  });
});

describe('métricas', () => {
  it('grava o retrato do dia', async () => {
    const db = createRichFakeDb({
      ...LIGADA,
      'user_progression_v2/a': { updatedAt: NOW - 1000 }, 'user_progression_v2/b': { updatedAt: NOW - 20 * 86_400_000 },
      'gamification_challenges/d': { status: 'active' }, 'duels/x': { status: 'active' }, 'gamification_flags/f': { status: 'open' },
    });
    const r = await g.runMetricsSnapshot(db, { now: NOW, logger });
    expect(r).toMatchObject({ athletes: 2, active7: 1, active30: 2, challengesActive: 1, duelsActive: 1, flagsOpen: 1 });
    expect(db.dump('gamification_metrics')['2026-10-05']).toMatchObject({ athletes: 2 });
  });

  it('⭐ o funil dos primeiros passos: quantas pessoas concluíram cada etapa e quantas dispensaram', async () => {
    const db = createRichFakeDb({
      ...LIGADA,
      'user_gamification_prefs/a': { onboarding: { done: { level: NOW - 1000, photo: NOW - 900, share: NOW - 10 } } },
      'user_gamification_prefs/b': { onboarding: { done: { level: NOW - 5000 }, dismissed: true } },
      'user_gamification_prefs/c': { privacy: { showInHallOfFame: false } }, // sem roteiro nenhum
    });
    const r = await g.runMetricsSnapshot(db, { now: NOW, logger });
    expect(r.prefsDocs).toBe(3);
    expect(r.onboarding.dismissed).toBe(1);
    expect(r.onboarding.steps).toMatchObject({ level: 2, photo: 1, share: 1, profile: 0, tournament: 0 });
    expect(Object.keys(r.onboarding.steps)).toEqual(g.ONBOARDING_STEP_IDS);
    expect(db.dump('gamification_metrics')['2026-10-05'].onboarding.steps.level).toBe(2);
  });

  it('se a contagem do funil falhar, o retrato do dia sai mesmo assim (sem o funil)', async () => {
    const db = createRichFakeDb({ ...LIGADA, 'user_progression_v2/a': { updatedAt: NOW - 1000 } });
    const original = db.collection.bind(db);
    db.collection = (nome) => {
      const col = original(nome);
      if (nome !== 'user_gamification_prefs') return col;
      return new Proxy(col, { get: (alvo, k) => (k === 'where' ? () => { throw new Error('índice ausente'); } : alvo[k]) });
    };
    const r = await g.runMetricsSnapshot(db, { now: NOW, logger });
    expect(r.athletes).toBe(1);
    expect(r.onboarding).toBeUndefined();
  });
});
