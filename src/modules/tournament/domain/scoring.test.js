import { describe, it, expect } from 'vitest';
import { RULESET, TARGET_SCORE } from './constants.js';
import {
  DEFAULT_SCORING_CONFIG,
  normalizeScoringConfig,
  getGameWinner,
  getMatchResult,
  getMatchPoints,
} from './scoring.js';

describe('pickleball scoring engine', () => {
  describe('normalizeScoringConfig', () => {
    it('aplica defaults quando vazio', () => {
      const cfg = normalizeScoringConfig();
      expect(cfg.target_score).toBe(11);
      expect(cfg.ruleset).toBe(RULESET.CBP);
      expect(cfg.sets_per_match).toBe(1);
    });
    it('corrige valores inválidos', () => {
      const cfg = normalizeScoringConfig({ target_score: 99, sets_per_match: 2, ruleset: 'xx' });
      expect(cfg.target_score).toBe(11);
      expect(cfg.sets_per_match).toBe(1);
      expect(cfg.ruleset).toBe(RULESET.CBP);
    });
  });

  describe('getGameWinner', () => {
    it('11x9 com win-by-two é válido', () => {
      expect(getGameWinner({ a: 11, b: 9 }, DEFAULT_SCORING_CONFIG).winner).toBe('a');
    });
    it('11x10 é inválido (sem 2 de vantagem)', () => {
      expect(getGameWinner({ a: 11, b: 10 }, DEFAULT_SCORING_CONFIG).valid).toBe(false);
    });
    it('15x13 a 21 pontos é inválido (não atingiu alvo)', () => {
      expect(getGameWinner({ a: 15, b: 13 }, { target_score: TARGET_SCORE.TWENTY_ONE }).valid).toBe(false);
    });
    it('respeita cap', () => {
      const cfg = { target_score: 11, max_score_cap: 15 };
      expect(getGameWinner({ a: 15, b: 14 }, cfg).winner).toBe('a');
    });
    it('rejeita empate', () => {
      expect(getGameWinner({ a: 11, b: 11 }, DEFAULT_SCORING_CONFIG).valid).toBe(false);
    });
  });

  describe('getMatchResult', () => {
    it('best-of-3, vence quem ganhar 2 sets', () => {
      const match = { games: [{ a: 11, b: 5 }, { a: 8, b: 11 }, { a: 11, b: 9 }] };
      const r = getMatchResult(match, { sets_per_match: 3 });
      expect(r.finished).toBe(true);
      expect(r.winner).toBe('a');
      expect(r.sets_a).toBe(2);
      expect(r.sets_b).toBe(1);
    });
    it('1 set ainda não decidido', () => {
      const r = getMatchResult({ games: [{ a: 5, b: 4 }] }, { sets_per_match: 1 });
      expect(r.finished).toBe(false);
      expect(r.winner).toBeNull();
    });
    it('walkover concede vitória', () => {
      const r = getMatchResult({ walkover: 'a' }, { sets_per_match: 3 });
      expect(r.winner).toBe('a');
      expect(r.walkover).toBe(true);
    });
  });

  describe('getMatchPoints', () => {
    it('vitória concede match_win + per_set_won * setsVencidos', () => {
      const cfg = { sets_per_match: 3, points: { match_win: 3, match_loss: 0, per_set_won: 1 } };
      const match = { games: [{ a: 11, b: 5 }, { a: 11, b: 9 }] };
      const pts = getMatchPoints(match, cfg);
      expect(pts.a).toBe(3 + 2);
      expect(pts.b).toBe(0 + 0);
    });
    it('walkover usa walkover_win', () => {
      const cfg = { points: { walkover_win: 2, walkover_loss: 0 } };
      const pts = getMatchPoints({ walkover: 'b' }, cfg);
      expect(pts.a).toBe(0);
      expect(pts.b).toBe(2);
    });
  });
});
