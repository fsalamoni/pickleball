import { describe, it, expect } from 'vitest';
import {
  resultFromSets, setsForEdit, gamePoints, setsText, hasSets, MAX_SETS,
} from './gameSets.js';

describe('resultFromSets', () => {
  it('um set: o placar de sempre, sem campos de sets', () => {
    expect(resultFromSets([{ a: '11', b: '7' }])).toEqual({
      ok: true,
      fields: { score_a: 11, score_b: 7, sets: null, points_a: null, points_b: null },
    });
  });

  it('um set em branco: erro, ou limpa com allowEmpty', () => {
    expect(resultFromSets([{ a: '', b: '' }]).ok).toBe(false);
    expect(resultFromSets([{ a: '', b: '' }], { allowEmpty: true }).fields.score_a).toBeNull();
    expect(resultFromSets([{ a: '3', b: '' }], { allowEmpty: true }).ok).toBe(false);
  });

  it('vários sets: score = sets vencidos, points = total', () => {
    const r = resultFromSets([{ a: '11', b: '0' }, { a: '9', b: '11' }, { a: '9', b: '11' }]);
    expect(r.ok).toBe(true);
    // Mais pontos para A (29 × 22), mas B venceu por sets.
    expect(r.fields).toMatchObject({ score_a: 1, score_b: 2, points_a: 29, points_b: 22 });
    expect(r.fields.sets).toHaveLength(3);
  });

  it('recusa set empatado, sets empatados, placar inválido e excesso de sets', () => {
    expect(resultFromSets([{ a: 11, b: 9 }, { a: 10, b: 10 }]).error).toMatch(/set 2 está empatado/);
    expect(resultFromSets([{ a: 11, b: 9 }, { a: 9, b: 11 }]).error).toMatch(/desempate/);
    expect(resultFromSets([{ a: 11, b: 9 }, { a: '', b: 3 }]).error).toMatch(/set 2/);
    expect(resultFromSets([{ a: -1, b: 3 }]).ok).toBe(false);
    expect(resultFromSets([{ a: 1.5, b: 3 }]).ok).toBe(false);
    const muitos = Array.from({ length: MAX_SETS + 1 }, () => ({ a: 11, b: 0 }));
    expect(resultFromSets(muitos).ok).toBe(false);
  });
});

describe('leitura', () => {
  const porSets = { score_a: 2, score_b: 1, sets: [{ a: 11, b: 9 }, { a: 8, b: 11 }, { a: 11, b: 5 }], points_a: 30, points_b: 25 };

  it('setsForEdit devolve os sets gravados ou o placar de um set', () => {
    expect(setsForEdit(porSets)).toEqual([{ a: '11', b: '9' }, { a: '8', b: '11' }, { a: '11', b: '5' }]);
    expect(setsForEdit({ score_a: 11, score_b: 4 })).toEqual([{ a: '11', b: '4' }]);
    expect(setsForEdit({})).toEqual([{ a: '', b: '' }]);
  });

  it('gamePoints usa os pontos dos sets, ou o placar de um set', () => {
    expect(gamePoints(porSets)).toEqual({ a: 30, b: 25 });
    expect(gamePoints({ ...porSets, points_a: null, points_b: null })).toEqual({ a: 30, b: 25 });
    expect(gamePoints({ score_a: 11, score_b: 7 })).toEqual({ a: 11, b: 7 });
  });

  it('setsText e hasSets', () => {
    expect(setsText(porSets)).toBe('11-9 · 8-11 · 11-5');
    expect(hasSets(porSets)).toBe(true);
    expect(setsText({ score_a: 11, score_b: 7, sets: null })).toBeNull();
    expect(hasSets({ sets: [{ a: 11, b: 2 }] })).toBe(false);
  });
});
