import { describe, it, expect } from 'vitest';
import {
  GAME_DAY_FORMAT,
  generateMexicanoSchedule,
  kingOfCourtFirstRound,
  kingOfCourtNextRound,
  kingOfCourtStandings,
} from './gameDayFormats.js';

const ids8 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

describe('GAME_DAY_FORMAT', () => {
  it('expõe os formatos', () => {
    expect(GAME_DAY_FORMAT.MEXICANO).toBe('mexicano');
    expect(GAME_DAY_FORMAT.KING_OF_COURT).toBe('king_of_court');
  });
});

describe('generateMexicanoSchedule', () => {
  it('exige ao menos 4 participantes', () => {
    expect(() => generateMexicanoSchedule(['a', 'b'])).toThrow();
  });

  it('gera rounds×courts jogos com pareamento 1&4 vs 2&3', () => {
    const games = generateMexicanoSchedule(ids8, { rounds: 3, seed: 's' });
    expect(games).toHaveLength(3 * 2); // 8 jogadores = 2 quadras
    // cada jogo tem 2 vs 2 e round/court definidos
    games.forEach((g) => {
      expect(g.side_a).toHaveLength(2);
      expect(g.side_b).toHaveLength(2);
      expect(g.round).toBeGreaterThanOrEqual(1);
      expect(g.court).toBeGreaterThanOrEqual(1);
    });
  });

  it('é determinístico para a mesma seed', () => {
    const a = generateMexicanoSchedule(ids8, { rounds: 4, seed: 'x' });
    const b = generateMexicanoSchedule(ids8, { rounds: 4, seed: 'x' });
    expect(a).toEqual(b);
  });

  it('não repete jogador dentro do mesmo jogo', () => {
    const games = generateMexicanoSchedule(ids8, { rounds: 2, seed: 's' });
    games.forEach((g) => {
      const all = [...g.side_a, ...g.side_b];
      expect(new Set(all).size).toBe(4);
    });
  });
});

describe('kingOfCourtFirstRound', () => {
  it('distribui em quadras de 4 na rodada 1', () => {
    const r1 = kingOfCourtFirstRound(ids8, { seed: 'k' });
    expect(r1).toHaveLength(2);
    expect(r1.every((g) => g.round === 1)).toBe(true);
    expect(r1.map((g) => g.court).sort()).toEqual([1, 2]);
  });
});

describe('kingOfCourtNextRound', () => {
  it('vencedor sobe, perdedor desce de quadra', () => {
    const last = [
      { round: 1, court: 1, side_a: ['a', 'b'], side_b: ['c', 'd'], score_a: 11, score_b: 5 },
      { round: 1, court: 2, side_a: ['e', 'f'], side_b: ['g', 'h'], score_a: 4, score_b: 11 },
    ];
    const next = kingOfCourtNextRound(last, { round: 2 });
    // quadra 1: vencedor de c1 (a,b) permanece + perdedor de c2? não; perdedor de c1 (c,d) desce p/ c2,
    // vencedor de c2 (g,h) sobe p/ c1, perdedor de c2 (e,f) permanece em c2 (última).
    // Quadra 1 recebe: (a,b) [vencedor c1 fica] e (g,h) [vencedor c2 sobe].
    const court1 = next.find((g) => g.court === 1);
    const court2 = next.find((g) => g.court === 2);
    expect(court1).toBeTruthy();
    expect(court2).toBeTruthy();
    const c1ids = [...court1.side_a, ...court1.side_b].sort();
    expect(c1ids).toEqual(['a', 'b', 'g', 'h']);
    const c2ids = [...court2.side_a, ...court2.side_b].sort();
    expect(c2ids).toEqual(['c', 'd', 'e', 'f']);
    expect(next.every((g) => g.round === 2)).toBe(true);
  });

  it('jogo sem placar mantém as duplas na mesma quadra', () => {
    const last = [{ round: 1, court: 1, side_a: ['a', 'b'], side_b: ['c', 'd'], score_a: null, score_b: null }];
    const next = kingOfCourtNextRound(last, { round: 2 });
    expect(next).toHaveLength(1);
    expect([...next[0].side_a, ...next[0].side_b].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('aceita lados no formato [{id}]', () => {
    const last = [{ round: 1, court: 1, side_a: [{ id: 'a' }, { id: 'b' }], side_b: [{ id: 'c' }, { id: 'd' }], score_a: 11, score_b: 9 }];
    const next = kingOfCourtNextRound(last, { round: 2 });
    expect(next[0].side_a.concat(next[0].side_b).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('kingOfCourtStandings', () => {
  it('pontua vitória (3) + bônus na quadra do rei', () => {
    const games = [
      { court: 1, side_a: ['a', 'b'], side_b: ['c', 'd'], score_a: 11, score_b: 6 },
    ];
    const st = kingOfCourtStandings(games);
    const a = st.find((s) => s.id === 'a');
    const c = st.find((s) => s.id === 'c');
    expect(a.points).toBe(4); // 3 vitória + 1 bônus quadra 1
    expect(c.points).toBe(1); // derrota
    expect(st[0].points).toBeGreaterThanOrEqual(st[st.length - 1].points);
  });
});
