import { describe, it, expect } from 'vitest';
import { pairKey, computeDoublesRanking } from './doublesRanking.js';

describe('pairKey', () => {
  it('é estável independente da ordem', () => {
    expect(pairKey('b', 'a')).toBe(pairKey('a', 'b'));
  });
});

describe('computeDoublesRanking', () => {
  const matches = [
    { side_a: ['a', 'b'], side_b: ['c', 'd'], winner: 'a', points_a: 21, points_b: 15 },
    { side_a: ['a', 'b'], side_b: ['e', 'f'], winner: 'a', points_a: 21, points_b: 10 },
    { side_a: ['c', 'd'], side_b: ['e', 'f'], winner: 'b', points_a: 18, points_b: 21 },
  ];

  it('agrega vitórias/derrotas por parceria', () => {
    const rk = computeDoublesRanking(matches);
    const ab = rk.find((r) => r.pair_key === pairKey('a', 'b'));
    expect(ab.games).toBe(2);
    expect(ab.wins).toBe(2);
    expect(ab.losses).toBe(0);
    expect(ab.win_rate).toBe(1);
    expect(ab.points_for).toBe(42);
    expect(ab.points_against).toBe(25);
    expect(ab.points_balance).toBe(17);
  });

  it('ordena por vitórias e aproveitamento (dupla ab em 1º)', () => {
    const rk = computeDoublesRanking(matches);
    expect(rk[0].pair_key).toBe(pairKey('a', 'b'));
  });

  it('ignora jogos que não são de duplas (2x2)', () => {
    const rk = computeDoublesRanking([
      { side_a: ['a'], side_b: ['b'], winner: 'a' },
      { side_a: ['a', 'b', 'c'], side_b: ['d', 'e', 'f'], winner: 'b' },
    ]);
    expect(rk).toHaveLength(0);
  });

  it('ignora jogos sem vencedor', () => {
    const rk = computeDoublesRanking([{ side_a: ['a', 'b'], side_b: ['c', 'd'], winner: null }]);
    expect(rk).toHaveLength(0);
  });

  it('respeita minGames', () => {
    // ab, cd e ef têm 2 jogos cada; com minGames 3 ninguém passa.
    expect(computeDoublesRanking(matches, { minGames: 3 })).toHaveLength(0);
    const rk2 = computeDoublesRanking(matches, { minGames: 2 });
    expect(rk2).toHaveLength(3);
    expect(rk2[0].pair_key).toBe(pairKey('a', 'b'));
  });
});
