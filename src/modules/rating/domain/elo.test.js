import { describe, it, expect } from 'vitest';
import {
  expectedScore,
  kFactor,
  seedFromLevelOrdinal,
  computeRatings,
  DEFAULT_SEED_RATING,
  PROVISIONAL_K,
  ELO_K,
  PROVISIONAL_GAMES,
} from './elo.js';

describe('expectedScore', () => {
  it('é 0.5 para ratings iguais', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
  });
  it('favorece o lado de maior rating', () => {
    expect(expectedScore(1200, 1000)).toBeGreaterThan(0.5);
    expect(expectedScore(1000, 1200)).toBeLessThan(0.5);
  });
});

describe('kFactor', () => {
  it('usa K provisório no início e K padrão depois', () => {
    expect(kFactor(0)).toBe(PROVISIONAL_K);
    expect(kFactor(PROVISIONAL_GAMES - 1)).toBe(PROVISIONAL_K);
    expect(kFactor(PROVISIONAL_GAMES)).toBe(ELO_K);
  });
});

describe('seedFromLevelOrdinal', () => {
  it('cresce com o nível e usa padrão para entradas inválidas', () => {
    expect(seedFromLevelOrdinal(0, 9)).toBeLessThan(seedFromLevelOrdinal(8, 9));
    expect(seedFromLevelOrdinal(null, 9)).toBe(DEFAULT_SEED_RATING);
    expect(seedFromLevelOrdinal(2, 1)).toBe(DEFAULT_SEED_RATING);
  });
});

describe('computeRatings', () => {
  it('retorna vazio sem jogos', () => {
    expect(computeRatings([])).toEqual([]);
  });

  it('aumenta o rating do vencedor e reduz o do perdedor (simples)', () => {
    const result = computeRatings([{ side_a: ['p1'], side_b: ['p2'], winner: 'a' }]);
    const p1 = result.find((p) => p.player_id === 'p1');
    const p2 = result.find((p) => p.player_id === 'p2');
    expect(p1.rating).toBeGreaterThan(DEFAULT_SEED_RATING);
    expect(p2.rating).toBeLessThan(DEFAULT_SEED_RATING);
    expect(p1.wins).toBe(1);
    expect(p2.losses).toBe(1);
    // soma de variações é simétrica (mesmo K provisório nos dois)
    expect(p1.rating - DEFAULT_SEED_RATING).toBe(DEFAULT_SEED_RATING - p2.rating);
  });

  it('distribui o resultado para os dois jogadores de uma dupla', () => {
    const result = computeRatings([
      { side_a: ['a1', 'a2'], side_b: ['b1', 'b2'], winner: 'a' },
    ]);
    const a1 = result.find((p) => p.player_id === 'a1');
    const a2 = result.find((p) => p.player_id === 'a2');
    expect(a1.rating).toBe(a2.rating);
    expect(a1.rating).toBeGreaterThan(DEFAULT_SEED_RATING);
    expect(a1.games).toBe(1);
  });

  it('aplica sementes por jogador', () => {
    const result = computeRatings(
      [{ side_a: ['forte'], side_b: ['fraco'], winner: 'a' }],
      { seeds: { forte: 1400, fraco: 800 } },
    );
    const forte = result.find((p) => p.player_id === 'forte');
    // favorito venceu: ganha pouco (resultado esperado)
    expect(forte.rating - 1400).toBeLessThan(10);
    expect(forte.rating).toBeGreaterThan(1400);
  });

  it('ordena por rating desc e reordena por timestamp quando fornecido', () => {
    const result = computeRatings([
      { side_a: ['p2'], side_b: ['p1'], winner: 'a', at: 2 },
      { side_a: ['p1'], side_b: ['p2'], winner: 'a', at: 1 },
    ]);
    // p1 venceu o 1º, p2 venceu o 2º → empatam em vitórias; ranking ordenado por rating
    expect(result[0].rating).toBeGreaterThanOrEqual(result[1].rating);
  });

  it('ignora jogos sem vencedor ou com lado vazio', () => {
    const result = computeRatings([
      { side_a: ['p1'], side_b: ['p2'], winner: null },
      { side_a: ['p1'], side_b: [], winner: 'a' },
    ]);
    expect(result).toEqual([]);
  });
});
