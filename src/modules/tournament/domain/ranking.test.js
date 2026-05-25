import { describe, it, expect } from 'vitest';
import { buildRanking } from './ranking.js';

describe('ranking engine', () => {
  const cfg = {
    target_score: 11,
    sets_per_match: 1,
    points: { match_win: 3, match_draw: 0, match_loss: 0, walkover_win: 3, walkover_loss: 0, per_set_won: 0 },
  };

  it('classifica corretamente um mini round-robin', () => {
    const matches = [
      { side_a: 'a', side_b: 'b', games: [{ a: 11, b: 5 }] },
      { side_a: 'a', side_b: 'c', games: [{ a: 11, b: 9 }] },
      { side_a: 'b', side_b: 'c', games: [{ a: 11, b: 7 }] },
    ];
    const r = buildRanking(matches, ['a', 'b', 'c'], cfg);
    expect(r[0].participant_id).toBe('a'); // 2 vitórias
    expect(r[0].ranking_points).toBe(6);
    expect(r[1].participant_id).toBe('b'); // 1 vitória
    expect(r[2].participant_id).toBe('c'); // 0 vitória
  });

  it('aplica head-to-head em empate', () => {
    const matches = [
      { side_a: 'a', side_b: 'b', games: [{ a: 11, b: 4 }] },
      { side_a: 'b', side_b: 'c', games: [{ a: 11, b: 6 }] },
      { side_a: 'c', side_b: 'a', games: [{ a: 11, b: 9 }] },
    ];
    const r = buildRanking(matches, ['a', 'b', 'c'], cfg);
    // Todos empatados em 3 pts. Critério H2H gera ciclo, então cai em sets/pts.
    // 'a' fez 11+9=20 pf vs 4+11=15 pa → diff +5
    // 'b' fez 4+11=15 vs 11+6=17 → diff -2
    // 'c' fez 6+11=17 vs 11+9=20 → diff -3
    expect(r[0].participant_id).toBe('a');
  });

  it('ignora jogos não finalizados', () => {
    const r = buildRanking(
      [
        { side_a: 'a', side_b: 'b', games: [{ a: 5, b: 4 }] }, // não terminou
      ],
      ['a', 'b'],
      cfg,
    );
    expect(r.every((s) => s.played === 0)).toBe(true);
  });
});
