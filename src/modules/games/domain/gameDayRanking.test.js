import { describe, it, expect } from 'vitest';
import {
  resolveMatchClubId, buildGameDayMatch, buildGameDayRankingMatches,
  gameDayRankingId, GAME_DAY_RANKING_SOURCE,
} from './gameDayRanking.js';

const gameDay = { id: 'gd1', title: 'Sábado' };

// participantes: p.id (doc id) → user_id
const participants = [
  { id: 'p1', name: 'Ana', user_id: 'u1' },
  { id: 'p2', name: 'Bia', user_id: 'u2' },
  { id: 'p3', name: 'Caio', user_id: 'u3' },
  { id: 'p4', name: 'Duda', user_id: 'u4' },
  { id: 'pg', name: 'Convidado' }, // guest sem user_id
];

function doublesGame(id, scoreA, scoreB) {
  return {
    id,
    side_a: [{ id: 'p1' }, { id: 'p2' }],
    side_b: [{ id: 'p3' }, { id: 'p4' }],
    score_a: scoreA,
    score_b: scoreB,
  };
}

describe('resolveMatchClubId', () => {
  it('retorna o clube comum a todos', () => {
    const clubs = { u1: ['cX'], u2: ['cX', 'cY'], u3: ['cX'], u4: ['cX'] };
    expect(resolveMatchClubId(['u1', 'u2'], ['u3', 'u4'], clubs)).toBe('cX');
  });

  it('retorna null se algum atleta não tem clube', () => {
    const clubs = { u1: ['cX'], u2: ['cX'], u3: ['cX'], u4: [] };
    expect(resolveMatchClubId(['u1', 'u2'], ['u3', 'u4'], clubs)).toBeNull();
  });

  it('retorna null se não há interseção', () => {
    const clubs = { u1: ['cX'], u2: ['cX'], u3: ['cY'], u4: ['cY'] };
    expect(resolveMatchClubId(['u1', 'u2'], ['u3', 'u4'], clubs)).toBeNull();
  });

  it('escolhe determinística (alfabética) quando há mais de um clube comum', () => {
    const clubs = { u1: ['cB', 'cA'], u2: ['cA', 'cB'] };
    expect(resolveMatchClubId(['u1'], ['u2'], clubs)).toBe('cA');
  });

  it('aceita Map', () => {
    const map = new Map([['u1', ['c1']], ['u2', ['c1']]]);
    expect(resolveMatchClubId(['u1'], ['u2'], map)).toBe('c1');
  });
});

describe('buildGameDayMatch', () => {
  it('pula jogo sem placar decidido', () => {
    expect(buildGameDayMatch({ gameDay, gameId: 'g1', game: doublesGame('g1', null, null), participants, clubIdsByUid: {} })).toBeNull();
    expect(buildGameDayMatch({ gameDay, gameId: 'g1', game: doublesGame('g1', 5, 5), participants, clubIdsByUid: {} })).toBeNull();
  });

  it('pula jogo com convidado avulso (sem user_id)', () => {
    const g = { id: 'g1', side_a: [{ id: 'p1' }, { id: 'pg' }], side_b: [{ id: 'p3' }, { id: 'p4' }], score_a: 11, score_b: 5 };
    expect(buildGameDayMatch({ gameDay, gameId: 'g1', game: g, participants, clubIdsByUid: {} })).toBeNull();
  });

  it('constrói payload de duplas decidido com club_id resolvido', () => {
    const clubs = { u1: ['cX'], u2: ['cX'], u3: ['cX'], u4: ['cX'] };
    const res = buildGameDayMatch({ gameDay, gameId: 'g1', game: doublesGame('g1', 11, 7), participants, clubIdsByUid: clubs, publishedBy: 'owner' });
    expect(res.id).toBe(gameDayRankingId('gd1', 'g1'));
    expect(res.payload.source).toBe(GAME_DAY_RANKING_SOURCE);
    expect(res.payload.event_id).toBe('gd1');
    expect(res.payload.club_id).toBe('cX');
    expect(res.payload.kind).toBe('doubles');
    expect(res.payload.side_a_ids).toEqual(['u1', 'u2']);
    expect(res.payload.side_b_ids).toEqual(['u3', 'u4']);
    expect(res.payload.winner_side).toBe('a');
    expect(res.payload.status).toBe('finished');
    // chaves exigidas pelas firestore.rules
    ['event_id', 'date_id', 'club_id', 'side_a_ids', 'side_b_ids', 'score_a', 'score_b', 'winner_side', 'status']
      .forEach((k) => expect(res.payload).toHaveProperty(k));
  });

  it('club_id null quando atletas de clubes diferentes', () => {
    const clubs = { u1: ['cX'], u2: ['cX'], u3: ['cY'], u4: ['cY'] };
    const res = buildGameDayMatch({ gameDay, gameId: 'g1', game: doublesGame('g1', 11, 7), participants, clubIdsByUid: clubs });
    expect(res.payload.club_id).toBeNull();
  });

  it('espelha partida AVULSA (round null) com user_id embutido mesmo sem lookup de participante', () => {
    // Regressão Wave C.6: partidas avulsas do dia de jogo do atleta carregam o
    // user_id no próprio lado, então o espelhamento funciona mesmo que a lista
    // de participantes esteja vazia na hora de sincronizar.
    const g = {
      id: 'gAvulsa',
      round: null,
      side_a: [{ id: 'p1', name: 'Ana', user_id: 'u1' }, { id: 'p2', name: 'Bia', user_id: 'u2' }],
      side_b: [{ id: 'p3', name: 'Caio', user_id: 'u3' }, { id: 'p4', name: 'Duda', user_id: 'u4' }],
      score_a: 11, score_b: 4,
    };
    const res = buildGameDayMatch({ gameDay, gameId: 'gAvulsa', game: g, participants: [], clubIdsByUid: {}, publishedBy: 'owner' });
    expect(res).not.toBeNull();
    expect(res.payload.side_a_ids).toEqual(['u1', 'u2']);
    expect(res.payload.side_b_ids).toEqual(['u3', 'u4']);
    expect(res.payload.winner_side).toBe('a');
  });
});

describe('buildGameDayRankingMatches', () => {
  it('agrega decididos, pula não decididos e é idempotente', () => {
    const games = [doublesGame('g1', 11, 5), doublesGame('g2', 5, 5), doublesGame('g3', 8, 11)];
    const first = buildGameDayRankingMatches({ gameDay, participants, games, clubIdsByUid: {}, publishedIds: [] });
    expect(first.summary.published).toBe(2);
    expect(first.summary.skipped).toBe(1);
    expect(first.toWrite).toHaveLength(2);

    const publishedIds = first.toWrite.map((w) => w.id);
    const second = buildGameDayRankingMatches({ gameDay, participants, games, clubIdsByUid: {}, publishedIds });
    expect(second.summary.published).toBe(0);
    expect(second.summary.already_published).toBe(2);
    expect(second.toWrite).toHaveLength(0);
  });

  it('remove fantasmas (jogo publicado que sumiu)', () => {
    const games = [doublesGame('g1', 11, 5)];
    const publishedIds = [gameDayRankingId('gd1', 'g1'), gameDayRankingId('gd1', 'gDeleted')];
    const res = buildGameDayRankingMatches({ gameDay, participants, games, clubIdsByUid: {}, publishedIds });
    expect(res.toRemove).toEqual([gameDayRankingId('gd1', 'gDeleted')]);
    expect(res.summary.removed).toBe(1);
  });
});
