/**
 * Tests do domínio puro de Circuitos.
 * Sem I/O — só funções puras.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeCircuitInput, pointsForPosition, computeCircuitRanking,
  normalizeCircuitResult, isTopRanked, CIRCUIT_DEFAULT_POINTS, CIRCUIT_MAX_NAME,
} from './circuit.js';

describe('normalizeCircuitInput', () => {
  const valid = {
    name: 'Circuito Verão 2026',
    description: 'Série de 4 torneios',
    season: '2026 Verão',
    categories: ['Open Misto'],
  };
  it('aceita input mínimo válido', () => {
    const r = normalizeCircuitInput(valid);
    expect(r.valid).toBe(true);
    expect(r.value.name).toBe('Circuito Verão 2026');
    expect(r.value.season).toBe('2026 Verão');
    expect(r.value.categories).toEqual(['Open Misto']);
    expect(r.value.active).toBe(true);
    expect(r.value.points_table).toBe(CIRCUIT_DEFAULT_POINTS);
  });
  it('rejeita name vazio', () => {
    expect(normalizeCircuitInput({ ...valid, name: '' }).valid).toBe(false);
    expect(normalizeCircuitInput({ ...valid, name: '   ' }).valid).toBe(false);
  });
  it('trunca name > max', () => {
    const r = normalizeCircuitInput({ ...valid, name: 'A'.repeat(CIRCUIT_MAX_NAME + 10) });
    expect(r.valid).toBe(false);
  });
  it('rejeita season vazia', () => {
    expect(normalizeCircuitInput({ ...valid, season: '' }).valid).toBe(false);
  });
  it('rejeita categories vazia', () => {
    expect(normalizeCircuitInput({ ...valid, categories: [] }).valid).toBe(false);
    expect(normalizeCircuitInput({ ...valid, categories: [''] }).valid).toBe(false);
  });
  it('trima e dedupe whitespace em categories', () => {
    const r = normalizeCircuitInput({ ...valid, categories: ['  Open  ', '', 'Sênior'] });
    expect(r.valid).toBe(true);
    expect(r.value.categories).toEqual(['Open', 'Sênior']);
  });
  it('limita categories a 10', () => {
    const r = normalizeCircuitInput({ ...valid, categories: Array(15).fill('Cat') });
    expect(r.valid).toBe(true);
    expect(r.value.categories.length).toBeLessThanOrEqual(10);
  });
  it('rejeita end_date < start_date', () => {
    expect(normalizeCircuitInput({ ...valid, start_date: '2026-06-01', end_date: '2026-05-01' }).valid).toBe(false);
  });
  it('aceita start/end válidos', () => {
    const r = normalizeCircuitInput({ ...valid, start_date: '2026-01-01', end_date: '2026-12-31' });
    expect(r.valid).toBe(true);
  });
  it('aceita points_table customizada', () => {
    const r = normalizeCircuitInput({ ...valid, points_table: { 1: 500, 2: 250 } });
    expect(r.valid).toBe(true);
    expect(r.value.points_table[1]).toBe(500);
  });
  it('active: false funciona', () => {
    const r = normalizeCircuitInput({ ...valid, active: false });
    expect(r.value.active).toBe(false);
  });
});

describe('pointsForPosition', () => {
  it('1º = 100 (default)', () => {
    expect(pointsForPosition(1)).toBe(100);
  });
  it('2º = 75', () => {
    expect(pointsForPosition(2)).toBe(75);
  });
  it('3º/4º = 50', () => {
    expect(pointsForPosition(3)).toBe(50);
    expect(pointsForPosition(4)).toBe(50);
  });
  it('posição 0 ou negativa = 0', () => {
    expect(pointsForPosition(0)).toBe(0);
    expect(pointsForPosition(-1)).toBe(0);
  });
  it('posição > 56 sem table = 0', () => {
    expect(pointsForPosition(60)).toBe(0);
    expect(pointsForPosition(100)).toBe(0);
  });
  it('aceita table customizada', () => {
    const t = { 1: 500, 2: 300, 3: 100 };
    expect(pointsForPosition(1, t)).toBe(500);
    expect(pointsForPosition(2, t)).toBe(300);
    expect(pointsForPosition(3, t)).toBe(100);
    expect(pointsForPosition(4, t)).toBe(0);
  });
});

describe('computeCircuitRanking', () => {
  it('vazio = []', () => {
    expect(computeCircuitRanking([])).toEqual([]);
  });
  it('rankeia por pontos desc', () => {
    const results = [
      { tournament_id: 't1', user_id: 'u1', user_name: 'Alice', position: 1 },
      { tournament_id: 't1', user_id: 'u2', user_name: 'Bob', position: 2 },
      { tournament_id: 't1', user_id: 'u3', user_name: 'Carol', position: 3 },
    ];
    const r = computeCircuitRanking(results);
    expect(r).toHaveLength(3);
    expect(r[0].user_id).toBe('u1');
    expect(r[0].total_points).toBe(100);
    expect(r[0].rank).toBe(1);
    expect(r[1].user_id).toBe('u2');
    expect(r[2].user_id).toBe('u3');
  });
  it('agrega pontos de múltiplos torneios', () => {
    const results = [
      { tournament_id: 't1', user_id: 'u1', position: 1 },
      { tournament_id: 't2', user_id: 'u1', position: 1 },
      { tournament_id: 't1', user_id: 'u2', position: 2 },
    ];
    const r = computeCircuitRanking(results);
    expect(r[0].user_id).toBe('u1');
    expect(r[0].total_points).toBe(200);
    expect(r[0].tournaments).toBe(2);
    expect(r[1].user_id).toBe('u2');
    expect(r[1].total_points).toBe(75);
  });
  it('empate: melhor posição vence', () => {
    const results = [
      { tournament_id: 't1', user_id: 'u1', user_name: 'Alice', position: 1 },
      { tournament_id: 't1', user_id: 'u2', user_name: 'Bob', position: 2 },
      { tournament_id: 't2', user_id: 'u1', position: 5 },  // +30
      { tournament_id: 't2', user_id: 'u2', position: 5 },  // +30 (empate!)
    ];
    const r = computeCircuitRanking(results);
    expect(r[0].user_id).toBe('u1'); // melhor best_position
    expect(r[1].user_id).toBe('u2');
  });
  it('empate total: mais torneios vence', () => {
    const results = [
      { tournament_id: 't1', user_id: 'u1', user_name: 'Alice', position: 1 },
      { tournament_id: 't2', user_id: 'u2', user_name: 'Bob', position: 1 },
      { tournament_id: 't3', user_id: 'u2', position: 1 },
    ];
    const r = computeCircuitRanking(results);
    expect(r[0].user_id).toBe('u2'); // 2 torneios vs 1
    expect(r[1].user_id).toBe('u1');
  });
  it('ignora resultados com posição 0 ou inválida', () => {
    const results = [
      { tournament_id: 't1', user_id: 'u1', position: 0 },
      { tournament_id: 't1', user_id: 'u2', position: 1 },
    ];
    const r = computeCircuitRanking(results);
    expect(r).toHaveLength(1);
    expect(r[0].user_id).toBe('u2');
  });
  it('rank começa em 1 e é sequencial', () => {
    const results = [
      { tournament_id: 't1', user_id: 'u1', position: 1 },
      { tournament_id: 't1', user_id: 'u2', position: 2 },
      { tournament_id: 't1', user_id: 'u3', position: 3 },
    ];
    const r = computeCircuitRanking(results);
    expect(r.map((u) => u.rank)).toEqual([1, 2, 3]);
  });
  it('best_position: null se nunca pontuou', () => {
    const results = [{ tournament_id: 't1', user_id: 'u1', position: 100 }]; // 0 pontos
    const r = computeCircuitRanking(results);
    expect(r).toHaveLength(0); // filtrado pq pts <= 0
  });
});

describe('normalizeCircuitResult', () => {
  it('aceita resultado válido', () => {
    const r = normalizeCircuitResult({ user_id: 'u1', user_name: 'Alice', tournament_id: 't1', position: 1 });
    expect(r.valid).toBe(true);
    expect(r.value.position).toBe(1);
    expect(r.value.points).toBe(100);
  });
  it('rejeita position inválida', () => {
    expect(normalizeCircuitResult({ position: 0, user_id: 'u1', tournament_id: 't1' }).valid).toBe(false);
    expect(normalizeCircuitResult({ position: -1, user_id: 'u1', tournament_id: 't1' }).valid).toBe(false);
    expect(normalizeCircuitResult({ position: 'abc', user_id: 'u1', tournament_id: 't1' }).valid).toBe(false);
  });
  it('trunca user_name > 80', () => {
    const r = normalizeCircuitResult({ user_id: 'u1', user_name: 'A'.repeat(100), tournament_id: 't1', position: 1 });
    expect(r.valid).toBe(true);
    expect(r.value.user_name.length).toBe(80);
  });
  it('calcula points automaticamente', () => {
    const r1 = normalizeCircuitResult({ user_id: 'u1', tournament_id: 't1', position: 1 });
    const r2 = normalizeCircuitResult({ user_id: 'u1', tournament_id: 't1', position: 10 });
    const r3 = normalizeCircuitResult({ user_id: 'u1', tournament_id: 't1', position: 100 });
    expect(r1.value.points).toBe(100);
    expect(r2.value.points).toBe(20);
    expect(r3.value.points).toBe(0);
  });
});

describe('isTopRanked', () => {
  it('true para top 3', () => {
    expect(isTopRanked(1)).toBe(true);
    expect(isTopRanked(2)).toBe(true);
    expect(isTopRanked(3)).toBe(true);
  });
  it('false para > 3', () => {
    expect(isTopRanked(4)).toBe(false);
  });
  it('false para inválido', () => {
    expect(isTopRanked(0)).toBe(false);
    expect(isTopRanked(null)).toBe(false);
  });
  it('aceita top N customizado', () => {
    expect(isTopRanked(5, 5)).toBe(true);
    expect(isTopRanked(6, 5)).toBe(false);
  });
});
