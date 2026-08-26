import { describe, it, expect } from 'vitest';
import {
  computeDuprRatings,
  seedFromProfile,
  usapToRating,
  clampRating,
  expectedScore,
  movMultiplier,
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

describe('duprScale — escala e limites', () => {
  it('mantém o rating dentro de [2.000, 8.000]', () => {
    expect(clampRating(1.2)).toBe(DUPR_MIN);
    expect(clampRating(9)).toBe(DUPR_MAX);
    expect(clampRating(4.321)).toBeCloseTo(4.321, 3);
  });

  it('expectativa é 0.5 para ratings iguais e cresce com a vantagem', () => {
    expect(expectedScore(4, 4)).toBeCloseTo(0.5, 6);
    expect(expectedScore(5, 4)).toBeGreaterThan(0.7);
    expect(expectedScore(4, 5)).toBeLessThan(0.3);
  });

  it('margem de vitória fica entre 1.0 e 1.5, sem inverter sinal', () => {
    expect(movMultiplier(11, 9)).toBeGreaterThanOrEqual(1);
    expect(movMultiplier(11, 0)).toBeCloseTo(1.5, 3);
    expect(movMultiplier(0, 0)).toBe(1);
  });
});

describe('duprScale — semente (seed)', () => {
  it('prioriza o rating DUPR informado manualmente', () => {
    expect(seedFromProfile({ dupr_rating: 4.25 }, LEVELS)).toBeCloseTo(4.25, 3);
  });

  it('cai para o valor USAP do nível quando não há DUPR manual (2.5 → 2.5)', () => {
    expect(seedFromProfile({ leveling_level: 'iniciante_plus' }, LEVELS)).toBeCloseTo(2.5, 3);
  });

  it('faixas USAP viram a média dos limites (1.0–1.5 → 1.25 → limitado a 2.0)', () => {
    expect(usapToRating('1.0 – 1.5')).toBeCloseTo(2.0, 3); // 1.25 < 2.0 → clamp
    expect(usapToRating('2.0')).toBeCloseTo(2.0, 3);
    expect(usapToRating('5.0')).toBeCloseTo(5.0, 3);
  });

  it('usa a semente padrão quando não há DUPR nem nível', () => {
    expect(seedFromProfile({}, LEVELS)).toBe(DUPR_DEFAULT_SEED);
    expect(seedFromProfile(null, LEVELS)).toBe(DUPR_DEFAULT_SEED);
  });
});

describe('duprScale — replay de jogos', () => {
  const seeds = { a: 4.0, b: 4.0, c: 4.0, d: 4.0 };

  it('vencer sobe e perder desce (simples), no bloco singles', () => {
    const res = computeDuprRatings([
      { side_a: ['a'], side_b: ['b'], winner: 'a', points_a: 11, points_b: 5, at: 1 },
    ], { seeds });
    const a = res.find((p) => p.player_id === 'a');
    const b = res.find((p) => p.player_id === 'b');
    expect(a.singles.rating).toBeGreaterThan(4.0);
    expect(b.singles.rating).toBeLessThan(4.0);
    expect(a.singles.games).toBe(1);
    expect(a.singles.wins).toBe(1);
    expect(b.singles.losses).toBe(1);
    // duplas intactas (não jogou duplas)
    expect(a.doubles.games).toBe(0);
    expect(a.doubles.rating).toBeCloseTo(4.0, 3);
  });

  it('jogo de duplas move o bloco doubles de cada parceiro, não o singles', () => {
    const res = computeDuprRatings([
      { side_a: ['a', 'b'], side_b: ['c', 'd'], winner: 'a', points_a: 11, points_b: 7, at: 1 },
    ], { seeds });
    const a = res.find((p) => p.player_id === 'a');
    const c = res.find((p) => p.player_id === 'c');
    expect(a.doubles.rating).toBeGreaterThan(4.0);
    expect(c.doubles.rating).toBeLessThan(4.0);
    expect(a.doubles.games).toBe(1);
    expect(a.singles.games).toBe(0);
    expect(a.singles.rating).toBeCloseTo(4.0, 3);
  });

  it('ratings ficam dentro da escala mesmo após muitas vitórias', () => {
    const matches = [];
    for (let i = 0; i < 200; i += 1) {
      matches.push({ side_a: ['a'], side_b: ['b'], winner: 'a', points_a: 11, points_b: 0, at: i });
    }
    const res = computeDuprRatings(matches, { seeds });
    const a = res.find((p) => p.player_id === 'a');
    const b = res.find((p) => p.player_id === 'b');
    expect(a.singles.rating).toBeLessThanOrEqual(DUPR_MAX);
    expect(b.singles.rating).toBeGreaterThanOrEqual(DUPR_MIN);
    expect(a.singles.rating).toBeGreaterThan(4.0);
  });

  it('marca provisório abaixo de 5 jogos e estabelecido a partir de 5', () => {
    const few = computeDuprRatings([
      { side_a: ['a'], side_b: ['b'], winner: 'a', at: 1 },
    ], { seeds });
    expect(few.find((p) => p.player_id === 'a').singles.provisional).toBe(true);

    const many = [];
    for (let i = 0; i < 5; i += 1) {
      many.push({ side_a: ['a'], side_b: ['b'], winner: i % 2 === 0 ? 'a' : 'b', at: i });
    }
    const res = computeDuprRatings(many, { seeds });
    expect(res.find((p) => p.player_id === 'a').singles.provisional).toBe(false);
    expect(res.find((p) => p.player_id === 'a').singles.games).toBe(5);
  });

  it('rating formatado com 3 casas (x.xxx)', () => {
    const res = computeDuprRatings([
      { side_a: ['a'], side_b: ['b'], winner: 'a', at: 1 },
    ], { seeds });
    const r = res.find((p) => p.player_id === 'a').singles.rating;
    // no máximo 3 casas decimais
    expect(Number(r.toFixed(3))).toBe(r);
  });
});
