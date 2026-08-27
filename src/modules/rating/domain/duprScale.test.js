import { describe, it, expect } from 'vitest';
import {
  computeDuprRatings,
  seedFromProfile,
  usapToRating,
  clampRating,
  expectedShare,
  kFactor,
  reliabilityFromGames,
  DUPR_MIN,
  DUPR_MAX,
  DUPR_DEFAULT_SEED,
} from './duprScale.js';

const LEVELS = [
  { id: 'iniciante_1', usap: '1.0 – 1.5' },
  { id: 'iniciante_2', usap: '2.0' },
  { id: 'iniciante_plus', usap: '2.5' },
  { id: 'avancado', usap: '5.0' },
];

describe('duprScale — escala, expectativa e K', () => {
  it('mantém o rating dentro de [2.000, 8.000]', () => {
    expect(clampRating(1.2)).toBe(DUPR_MIN);
    expect(clampRating(9)).toBe(DUPR_MAX);
    expect(clampRating(4.321)).toBeCloseTo(4.321, 3);
  });

  it('participação esperada é 0.5 para ratings iguais e cresce com a vantagem', () => {
    expect(expectedShare(4, 4)).toBeCloseTo(0.5, 6);
    expect(expectedShare(6, 4)).toBeGreaterThan(0.5);
    expect(expectedShare(4, 6)).toBeLessThan(0.5);
  });

  it('K é maior no começo (converge rápido) e menor com experiência', () => {
    expect(kFactor(0)).toBeGreaterThan(kFactor(10));
    expect(kFactor(10)).toBeGreaterThan(kFactor(40));
  });

  it('confiabilidade cresce com os jogos (0 → sobe → satura)', () => {
    expect(reliabilityFromGames(0)).toBe(0);
    expect(reliabilityFromGames(10)).toBeGreaterThan(reliabilityFromGames(3));
    expect(reliabilityFromGames(50)).toBeGreaterThan(90);
  });
});

describe('duprScale — semente (seed)', () => {
  it('prioriza o rating DUPR informado manualmente', () => {
    expect(seedFromProfile({ dupr_rating: 4.25 }, LEVELS)).toBeCloseTo(4.25, 3);
  });
  it('cai para o valor USAP do nível (2.5 → 2.5)', () => {
    expect(seedFromProfile({ leveling_level: 'iniciante_plus' }, LEVELS)).toBeCloseTo(2.5, 3);
  });
  it('faixas USAP viram a média dos limites, limitadas à escala', () => {
    expect(usapToRating('1.0 – 1.5')).toBeCloseTo(2.0, 3); // 1.25 < 2.0 → clamp
    expect(usapToRating('5.0')).toBeCloseTo(5.0, 3);
  });
  it('usa a semente padrão quando não há DUPR nem nível', () => {
    expect(seedFromProfile({}, LEVELS)).toBe(DUPR_DEFAULT_SEED);
    expect(seedFromProfile(null, LEVELS)).toBe(DUPR_DEFAULT_SEED);
  });
});

describe('duprScale — atualização BASEADA NO PLACAR (essência do DUPR)', () => {
  it('vencer sobe e perder desce entre iguais', () => {
    const res = computeDuprRatings([
      { side_a: ['a'], side_b: ['b'], winner: 'a', points_a: 11, points_b: 5, at: 1 },
    ], { seeds: { a: 4, b: 4 } });
    const a = res.find((p) => p.player_id === 'a');
    const b = res.find((p) => p.player_id === 'b');
    expect(a.singles.rating).toBeGreaterThan(4);
    expect(b.singles.rating).toBeLessThan(4);
  });

  it('DERROTA APERTADA contra adversário muito mais forte SOBE o rating', () => {
    // underdog 3.0 perde por pouco (9-11) para um 6.0 → desempenho acima do esperado
    const res = computeDuprRatings([
      { side_a: ['under'], side_b: ['strong'], winner: 'b', points_a: 9, points_b: 11, at: 1 },
    ], { seeds: { under: 3.0, strong: 6.0 } });
    const under = res.find((p) => p.player_id === 'under');
    expect(under.singles.rating).toBeGreaterThan(3.0); // subiu, mesmo perdendo
    expect(under.singles.losses).toBe(1);
  });

  it('vitória por margem larga move MAIS que vitória apertada (entre iguais)', () => {
    const squeaker = computeDuprRatings([
      { side_a: ['a'], side_b: ['b'], winner: 'a', points_a: 11, points_b: 9, at: 1 },
    ], { seeds: { a: 4, b: 4 } }).find((p) => p.player_id === 'a').singles.rating;
    const blowout = computeDuprRatings([
      { side_a: ['a'], side_b: ['b'], winner: 'a', points_a: 11, points_b: 1, at: 1 },
    ], { seeds: { a: 4, b: 4 } }).find((p) => p.player_id === 'a').singles.rating;
    expect(blowout).toBeGreaterThan(squeaker);
  });

  it('W.O. / jogo sem placar é IGNORADO (não altera rating nem contagem)', () => {
    const res = computeDuprRatings([
      { side_a: ['a'], side_b: ['b'], winner: 'a', points_a: 0, points_b: 0, at: 1 },
    ], { seeds: { a: 4, b: 4 } });
    expect(res).toHaveLength(0);
  });

  it('duplas: move o bloco doubles de cada parceiro, não o singles', () => {
    const res = computeDuprRatings([
      { side_a: ['a', 'b'], side_b: ['c', 'd'], winner: 'a', points_a: 11, points_b: 7, at: 1 },
    ], { seeds: { a: 4, b: 4, c: 4, d: 4 } });
    const a = res.find((p) => p.player_id === 'a');
    const c = res.find((p) => p.player_id === 'c');
    expect(a.doubles.rating).toBeGreaterThan(4);
    expect(c.doubles.rating).toBeLessThan(4);
    expect(a.singles.games).toBe(0);
    expect(a.singles.rating).toBeCloseTo(4, 3);
  });

  it('permanece dentro da escala após muitas surras', () => {
    const matches = [];
    for (let i = 0; i < 300; i += 1) {
      matches.push({ side_a: ['a'], side_b: ['b'], winner: 'a', points_a: 11, points_b: 0, at: i });
    }
    const res = computeDuprRatings(matches, { seeds: { a: 4, b: 4 } });
    const a = res.find((p) => p.player_id === 'a');
    const b = res.find((p) => p.player_id === 'b');
    expect(a.singles.rating).toBeLessThanOrEqual(DUPR_MAX);
    expect(b.singles.rating).toBeGreaterThanOrEqual(DUPR_MIN);
  });

  it('expõe confiabilidade e marca provisório com poucos jogos', () => {
    const few = computeDuprRatings([
      { side_a: ['a'], side_b: ['b'], winner: 'a', points_a: 11, points_b: 8, at: 1 },
    ], { seeds: { a: 4, b: 4 } }).find((p) => p.player_id === 'a');
    expect(few.singles.provisional).toBe(true);
    expect(few.singles.reliability).toBeGreaterThanOrEqual(0);
    expect(few.singles.reliability).toBeLessThan(50);
  });

  it('gera a trajetória de evolução (um ponto por jogo, em ordem)', () => {
    const matches = [
      { side_a: ['a'], side_b: ['b'], winner: 'a', points_a: 11, points_b: 5, at: 1 },
      { side_a: ['a'], side_b: ['b'], winner: 'b', points_a: 7, points_b: 11, at: 2 },
      { side_a: ['a'], side_b: ['b'], winner: 'a', points_a: 11, points_b: 9, at: 3 },
    ];
    const a = computeDuprRatings(matches, { seeds: { a: 4, b: 4 } }).find((p) => p.player_id === 'a');
    expect(a.singles.trajectory).toHaveLength(3);
    expect(a.singles.trajectory[a.singles.trajectory.length - 1].rating).toBeCloseTo(a.singles.rating, 3);
    // duplas sem jogos → trajetória vazia
    expect(a.doubles.trajectory).toHaveLength(0);
  });

  it('rating formatado com no máximo 3 casas (x.xxx)', () => {
    const r = computeDuprRatings([
      { side_a: ['a'], side_b: ['b'], winner: 'a', points_a: 11, points_b: 6, at: 1 },
    ], { seeds: { a: 4, b: 4 } }).find((p) => p.player_id === 'a').singles.rating;
    expect(Number(r.toFixed(3))).toBe(r);
  });
});
