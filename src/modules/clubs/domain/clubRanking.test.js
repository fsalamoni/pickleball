import { describe, it, expect } from 'vitest';
import { computeClubRanking } from './clubRanking.js';

const games = [
  { side_a: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bia' }], side_b: [{ id: 'c', name: 'Caio' }, { id: 'd', name: 'Davi' }], score_a: 6, score_b: 3 },
  { side_a: [{ id: 'a', name: 'Ana' }, { id: 'c', name: 'Caio' }], side_b: [{ id: 'b', name: 'Bia' }, { id: 'd', name: 'Davi' }], score_a: 4, score_b: 6 },
  { side_a: [{ id: 'a' }, { id: 'd' }], side_b: [{ id: 'b' }, { id: 'c' }], score_a: 6, score_b: 6 }, // empate, ignora
];

describe('computeClubRanking', () => {
  it('agrega vitórias/derrotas/saldo por atleta', () => {
    const rk = computeClubRanking(games);
    const ana = rk.find((r) => r.id === 'a');
    expect(ana.games).toBe(2);
    expect(ana.wins).toBe(1);
    expect(ana.losses).toBe(1);
    expect(ana.points_for).toBe(10); // 6 + 4
    expect(ana.points_against).toBe(9); // 3 + 6
    expect(ana.points_balance).toBe(1);
  });

  it('preserva o nome mesmo quando um jogo traz só o id', () => {
    const rk = computeClubRanking(games);
    expect(rk.find((r) => r.id === 'd').name).toBe('Davi');
  });

  it('ignora jogos sem placar ou empatados', () => {
    const rk = computeClubRanking([{ side_a: [{ id: 'a' }], side_b: [{ id: 'b' }], score_a: null, score_b: null }]);
    expect(rk).toHaveLength(0);
  });

  it('ordena por vitórias e aproveitamento', () => {
    const rk = computeClubRanking(games);
    for (let i = 1; i < rk.length; i += 1) {
      expect(rk[i - 1].wins).toBeGreaterThanOrEqual(rk[i].wins);
    }
  });
});
