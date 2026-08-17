import { describe, it, expect } from 'vitest';
import {
  hasResult, splitGamesByResult, nextRoundBase, offsetRounds, maxOrderOf, planAdditiveDraw,
} from './gameDayDrawMerge.js';

describe('gameDayDrawMerge', () => {
  describe('hasResult', () => {
    it('exige ambos os placares preenchidos', () => {
      expect(hasResult({ score_a: 11, score_b: 7 })).toBe(true);
      expect(hasResult({ score_a: 0, score_b: 0 })).toBe(true);
      expect(hasResult({ score_a: 11, score_b: null })).toBe(false);
      expect(hasResult({ score_a: null, score_b: null })).toBe(false);
      expect(hasResult(null)).toBe(false);
    });
  });

  describe('splitGamesByResult', () => {
    it('separa jogos com e sem resultado', () => {
      const games = [
        { id: 'g1', score_a: 11, score_b: 5 },
        { id: 'g2', score_a: null, score_b: null },
        { id: 'g3', score_a: 9, score_b: 11 },
        { id: 'g4', score_a: 5, score_b: null },
      ];
      const { scored, unscored } = splitGamesByResult(games);
      expect(scored.map((g) => g.id)).toEqual(['g1', 'g3']);
      expect(unscored.map((g) => g.id)).toEqual(['g2', 'g4']);
    });

    it('lida com lista vazia/nula', () => {
      expect(splitGamesByResult([])).toEqual({ scored: [], unscored: [] });
      expect(splitGamesByResult(null)).toEqual({ scored: [], unscored: [] });
    });
  });

  describe('nextRoundBase', () => {
    it('retorna a maior rodada existente', () => {
      expect(nextRoundBase([{ round: 1 }, { round: 3 }, { round: 2 }])).toBe(3);
    });
    it('ignora rodadas nulas/avulsas', () => {
      expect(nextRoundBase([{ round: null }, { round: 2 }])).toBe(2);
      expect(nextRoundBase([{ round: null }])).toBe(0);
      expect(nextRoundBase([])).toBe(0);
    });
  });

  describe('offsetRounds', () => {
    it('soma o offset às rodadas', () => {
      const out = offsetRounds([{ round: 1, x: 'a' }, { round: 2, x: 'b' }], 3);
      expect(out).toEqual([{ round: 4, x: 'a' }, { round: 5, x: 'b' }]);
    });
    it('offset 0 preserva as rodadas', () => {
      const games = [{ round: 1 }, { round: 2 }];
      expect(offsetRounds(games, 0)).toEqual(games);
    });
    it('preserva rodadas nulas (avulsas)', () => {
      expect(offsetRounds([{ round: null }], 5)).toEqual([{ round: null }]);
    });
  });

  describe('maxOrderOf', () => {
    it('retorna a maior ordem, ou -1 se nenhuma', () => {
      expect(maxOrderOf([{ order: 0 }, { order: 5 }, { order: 3 }])).toBe(5);
      expect(maxOrderOf([{ order: null }])).toBe(-1);
      expect(maxOrderOf([])).toBe(-1);
    });
  });

  describe('planAdditiveDraw', () => {
    const games = [
      { id: 'g1', round: 1, order: 0, score_a: 11, score_b: 5 }, // com resultado
      { id: 'g2', round: 1, order: 1, score_a: null, score_b: null }, // sem
      { id: 'g3', round: 2, order: 2, score_a: null, score_b: null }, // sem
    ];

    it('mantém tudo e não remove nada quando NÃO substitui os sem resultado', () => {
      const plan = planAdditiveDraw({ existingGames: games, replaceUnscored: false });
      expect(plan.keptGames.map((g) => g.id)).toEqual(['g1', 'g2', 'g3']);
      expect(plan.removeIds).toEqual([]);
      expect(plan.roundBase).toBe(2);
      expect(plan.orderBase).toBe(3);
    });

    it('remove os sem resultado e mantém os com resultado quando substitui', () => {
      const plan = planAdditiveDraw({ existingGames: games, replaceUnscored: true });
      expect(plan.keptGames.map((g) => g.id)).toEqual(['g1']);
      expect(plan.removeIds).toEqual(['g2', 'g3']);
      expect(plan.roundBase).toBe(1);
      expect(plan.orderBase).toBe(1);
    });

    it('dia vazio: nada a manter nem remover, base zero', () => {
      const plan = planAdditiveDraw({ existingGames: [], replaceUnscored: true });
      expect(plan.keptGames).toEqual([]);
      expect(plan.removeIds).toEqual([]);
      expect(plan.roundBase).toBe(0);
      expect(plan.orderBase).toBe(0);
    });

    it('nunca perde jogos com resultado mesmo ao substituir', () => {
      const onlyScored = [{ id: 'a', round: 1, order: 0, score_a: 11, score_b: 9 }];
      const plan = planAdditiveDraw({ existingGames: onlyScored, replaceUnscored: true });
      expect(plan.removeIds).toEqual([]);
      expect(plan.keptGames.map((g) => g.id)).toEqual(['a']);
    });
  });
});
