/**
 * Testes do domínio `clubRankingSources` (Wave C.2).
 * Sem I/O — só lógica de agregação de fontes para o ranking do clube.
 */

import { describe, it, expect } from 'vitest';
import {
  flattenSideToUids,
  normalizeMatch,
  normalizeAllSources,
  filterMatchesForClub,
  summarizeSources,
} from './clubRankingSources.js';

describe('flattenSideToUids', () => {
  it('extrai user_id de objetos com { user_id }', () => {
    expect(flattenSideToUids([
      { id: 'p1', user_id: 'u1' },
      { id: 'p2', user_id: 'u2' },
    ])).toEqual(['u1', 'u2']);
  });
  it('cai para id quando user_id ausente', () => {
    expect(flattenSideToUids([
      { id: 'p1' },
      { id: 'p2', user_id: 'u2' },
    ])).toEqual(['p1', 'u2']);
  });
  it('mantém strings e ignora null', () => {
    expect(flattenSideToUids(['u1', null, 'u3'])).toEqual(['u1', 'u3']);
    expect(flattenSideToUids(null)).toEqual([]);
  });
});

describe('normalizeMatch', () => {
  it('normaliza formato side_a_ids/side_b_ids (tournament_matches)', () => {
    const m = normalizeMatch({
      id: 'tm1',
      side_a_ids: ['u1', 'u2'],
      side_b_ids: ['u3', 'u4'],
      winner_side: 'a',
      score_a: 11, score_b: 9,
    });
    expect(m).toEqual({
      id: 'tm1',
      source: 'tournament_match',
      side_a: ['u1', 'u2'],
      side_b: ['u3', 'u4'],
      winner: 'a',
      points_a: 11,
      points_b: 9,
      at: null,
    });
  });
  it('normaliza formato side_a/side_b com objetos (gameDayOrganizer)', () => {
    const m = normalizeMatch({
      id: 'g1',
      side_a: [{ id: 'pa1', user_id: 'u1', name: 'Ana' }, { id: 'pa2', user_id: 'u2', name: 'Beto' }],
      side_b: [{ id: 'pa3', user_id: 'u3', name: 'Caio' }, { id: 'pa4', user_id: 'u4', name: 'Duda' }],
      score_a: 11, score_b: 7,
    });
    expect(m.source).toBe('club_event_game');
    expect(m.side_a).toEqual(['u1', 'u2']);
    expect(m.side_b).toEqual(['u3', 'u4']);
    expect(m.winner).toBe('a');
    expect(m.points_a).toBe(11);
  });
  it('retorna null para jogo vazio/inválido', () => {
    expect(normalizeMatch(null)).toBeNull();
    expect(normalizeMatch({})).toBeNull();
  });
});

describe('normalizeAllSources', () => {
  it('combina múltiplas fontes e normaliza cada match', () => {
    const out = normalizeAllSources({
      clubGames: [
        { id: 'g1', side_a: [{ user_id: 'u1' }, { user_id: 'u2' }], side_b: [{ user_id: 'u3' }, { user_id: 'u4' }], score_a: 11, score_b: 9 },
      ],
      clubEventGames: [
        { id: 'cg1', side_a_ids: ['u1', 'u5'], side_b_ids: ['u3', 'u6'], winner_side: 'b', score_a: 5, score_b: 11 },
      ],
      tournamentMatches: [
        { id: 'tm1', side_a_ids: ['u1', 'u2'], side_b_ids: ['u3', 'u4'], winner_side: 'a', score_a: 11, score_b: 7 },
      ],
    });
    expect(out).toHaveLength(3);
    expect(out.map((m) => m.source)).toEqual(['club_event_game', 'club_event_game', 'tournament_match']);
  });
});

describe('filterMatchesForClub', () => {
  it('mantém só matches com pelo menos um uid do clube', () => {
    const matches = [
      { source: 'club_event_game', side_a: ['u1', 'u2'], side_b: ['u3', 'u4'], winner: 'a', points_a: 11, points_b: 9, id: 'a' },
      { source: 'tournament_match', side_a: ['x1', 'x2'], side_b: ['x3', 'x4'], winner: 'a', points_a: 11, points_b: 9, id: 'b' },
      { source: 'tournament_match', side_a: ['u1', 'x2'], side_b: ['x3', 'x4'], winner: 'a', points_a: 11, points_b: 9, id: 'c' },
    ];
    const filtered = filterMatchesForClub(matches, ['u1', 'u2'], { includeClub: true, includeExternal: true });
    expect(filtered.map((m) => m.id)).toEqual(['a', 'c']);
  });

  it('includeClub=false remove jogos do próprio clube', () => {
    const matches = [
      { source: 'club_event_game', side_a: ['u1', 'u2'], side_b: ['u3', 'u4'], winner: 'a', points_a: 11, points_b: 9, id: 'a' },
      { source: 'tournament_match', side_a: ['u1', 'x2'], side_b: ['x3', 'x4'], winner: 'a', points_a: 11, points_b: 9, id: 'c' },
    ];
    const filtered = filterMatchesForClub(matches, ['u1', 'u2'], { includeClub: false, includeExternal: true });
    expect(filtered.map((m) => m.id)).toEqual(['c']);
  });

  it('includeExternal=false remove fontes externas', () => {
    const matches = [
      { source: 'club_event_game', side_a: ['u1', 'u2'], side_b: ['u3', 'u4'], winner: 'a', points_a: 11, points_b: 9, id: 'a' },
      { source: 'tournament_match', side_a: ['u1', 'x2'], side_b: ['x3', 'x4'], winner: 'a', points_a: 11, points_b: 9, id: 'c' },
    ];
    const filtered = filterMatchesForClub(matches, ['u1', 'u2'], { includeClub: true, includeExternal: false });
    expect(filtered.map((m) => m.id)).toEqual(['a']);
  });

  it('descarta matches sem vencedor decidido', () => {
    const matches = [
      { source: 'tournament_match', side_a: ['u1', 'u2'], side_b: ['u3', 'u4'], winner: null, points_a: 0, points_b: 0, id: 'a' },
      { source: 'tournament_match', side_a: ['u1', 'u2'], side_b: ['u3', 'u4'], winner: 'a', points_a: 11, points_b: 9, id: 'b' },
    ];
    const filtered = filterMatchesForClub(matches, ['u1']);
    expect(filtered.map((m) => m.id)).toEqual(['b']);
  });

  it('deduplica por id', () => {
    const matches = [
      { source: 'tournament_match', side_a: ['u1', 'u2'], side_b: ['u3', 'u4'], winner: 'a', points_a: 11, points_b: 9, id: 'x' },
      { source: 'tournament_match', side_a: ['u1', 'u2'], side_b: ['u3', 'u4'], winner: 'a', points_a: 11, points_b: 9, id: 'x' },
    ];
    const filtered = filterMatchesForClub(matches, ['u1']);
    expect(filtered).toHaveLength(1);
  });
});

describe('summarizeSources', () => {
  it('conta club/external/doubles/singles', () => {
    const matches = [
      { source: 'club_event_game', side_a: ['u1', 'u2'], side_b: ['u3', 'u4'], winner: 'a' },
      { source: 'club_event_game', side_a: ['u1'], side_b: ['u3'], winner: 'a' },
      { source: 'tournament_match', side_a: ['u1', 'u2'], side_b: ['u3', 'u4'], winner: 'a' },
      { source: 'tournament_match', side_a: ['u1', 'u2'], side_b: ['u3'], winner: 'a' },
    ];
    const s = summarizeSources(matches);
    expect(s.club).toBe(2);
    expect(s.external).toBe(2);
    expect(s.doubles).toBe(2);
    expect(s.singles).toBe(1);
  });
});
