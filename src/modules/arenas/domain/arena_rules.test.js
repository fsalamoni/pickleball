/**
 * Tests do domínio arena_rules.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeArenaRule, normalizeArenaRules, groupRulesByCategory, ARENA_RULE_CATEGORIES,
} from './arena_rules.js';

describe('normalizeArenaRule', () => {
  it('aceita regra válida', () => {
    const r = normalizeArenaRule({ title: 'Não fumar', description: 'Proibido fumar nas quadras' }, 0);
    expect(r.valid).toBe(true);
    expect(r.value.title).toBe('Não fumar');
    expect(r.value.description).toBe('Proibido fumar nas quadras');
    expect(r.value.category).toBe(ARENA_RULE_CATEGORIES.GENERAL);
    expect(r.value.order).toBe(0);
  });
  it('rejeita sem título', () => {
    expect(normalizeArenaRule({ description: 'Sem título' }, 0).valid).toBe(false);
    expect(normalizeArenaRule({ title: '' }, 0).valid).toBe(false);
    expect(normalizeArenaRule({ title: '   ' }, 0).valid).toBe(false);
  });
  it('trunca título > 80', () => {
    const r = normalizeArenaRule({ title: 'A'.repeat(100) }, 0);
    expect(r.valid).toBe(false);
  });
  it('trunca description > 500', () => {
    const r = normalizeArenaRule({ title: 'OK', description: 'B'.repeat(600) }, 0);
    expect(r.valid).toBe(true);
    expect(r.value.description.length).toBe(500);
  });
  it('aceita category custom', () => {
    const r = normalizeArenaRule({ title: 'OK', category: 'Pagamento' }, 0);
    expect(r.value.category).toBe('Pagamento');
  });
  it('gera id se não passado', () => {
    const r = normalizeArenaRule({ title: 'OK' }, 0);
    expect(r.value.id).toBeTruthy();
    expect(r.value.id.startsWith('rule_')).toBe(true);
  });
  it('preserva id passado', () => {
    const r = normalizeArenaRule({ id: 'meu-id', title: 'OK' }, 0);
    expect(r.value.id).toBe('meu-id');
  });
});

describe('normalizeArenaRules', () => {
  it('retorna [] se não-array', () => {
    expect(normalizeArenaRules(null)).toEqual([]);
    expect(normalizeArenaRules('string')).toEqual([]);
  });
  it('filtra inválidas e re-ordena', () => {
    const rules = [
      { title: 'A' },
      { title: '' }, // inválida
      { title: 'B' },
      { title: 'C' },
    ];
    const r = normalizeArenaRules(rules);
    expect(r).toHaveLength(3);
    expect(r.map((x) => x.title)).toEqual(['A', 'B', 'C']);
    expect(r.map((x) => x.order)).toEqual([0, 1, 2]);
  });
  it('limita a 50 regras', () => {
    const rules = Array(60).fill({ title: 'X' });
    const r = normalizeArenaRules(rules);
    expect(r).toHaveLength(50);
  });
});

describe('groupRulesByCategory', () => {
  it('agrupa por categoria', () => {
    const rules = [
      { id: '1', title: 'A', category: 'Pagamento', order: 0 },
      { id: '2', title: 'B', category: 'Conduta', order: 1 },
      { id: '3', title: 'C', category: 'Pagamento', order: 2 },
    ];
    const g = groupRulesByCategory(rules);
    expect(Object.keys(g).sort()).toEqual(['Conduta', 'Pagamento']);
    expect(g['Pagamento']).toHaveLength(2);
    expect(g['Conduta']).toHaveLength(1);
  });
  it('categoria default = Geral', () => {
    const g = groupRulesByCategory([{ id: '1', title: 'A' }]);
    expect(g['Geral']).toHaveLength(1);
  });
});
