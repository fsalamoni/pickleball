import { describe, it, expect } from 'vitest';
import {
  matchScore,
  matchesCriteria,
  sortByMatchScore,
  topMatches,
  scoreLabel,
  scoreTone,
  normalizeMatchmakingCriteria,
} from './matchmaking.js';

describe('matchScore', () => {
  it('retorna 0 se user ou candidate é null', () => {
    expect(matchScore(null, {})).toBe(0);
    expect(matchScore({}, null)).toBe(0);
  });
  it('retorna 0 se é o próprio user', () => {
    const user = { uid: 'u1', level: 3 };
    const candidate = { id: 'u1', level: 3 };
    expect(matchScore(user, candidate)).toBe(0);
  });
  it('score alto para nível próximo e mesma cidade', () => {
    const user = { uid: 'u1', level: 3, city: 'São Paulo' };
    const candidate = { id: 'u2', level: 3, city: 'São Paulo' };
    const s = matchScore(user, candidate);
    expect(s).toBeGreaterThanOrEqual(80);
  });
  it('score médio para nível próximo mas cidade diferente', () => {
    const user = { uid: 'u1', level: 3, city: 'São Paulo' };
    const candidate = { id: 'u2', level: 3, city: 'Rio' };
    const s = matchScore(user, candidate);
    // diff=0 (mesmo nível), cidades diferentes → 50 (base) + 40 (proximidade) + 0 = 90
    expect(s).toBeLessThan(100);
    expect(s).toBeGreaterThanOrEqual(50);
  });
  it('score baixo para nível muito diferente', () => {
    const user = { uid: 'u1', level: 3, city: 'SP' };
    const candidate = { id: 'u2', level: 7, city: 'SP' };
    const s = matchScore(user, candidate);
    // diff=4 > maxDiff(1.5) → -30; mesma cidade → +20 = 40
    expect(s).toBeLessThanOrEqual(50);
  });
  it('penaliza candidato novo (< 5 jogos)', () => {
    const user = { uid: 'u1', level: 3 };
    const c1 = { id: 'u2', level: 3, matches_played: 0 };
    const c2 = { id: 'u3', level: 3, matches_played: 20 };
    const s1 = matchScore(user, c1);
    const s2 = matchScore(user, c2);
    expect(s2).toBeGreaterThan(s1);
  });
  it('não passa de 100', () => {
    const user = { uid: 'u1', level: 3, city: 'SP' };
    const candidate = { id: 'u2', level: 3, city: 'SP', preferred_formats: ['duplas'], objective: 'social' };
    const s = matchScore(user, candidate, { min_level_diff: 0, max_level_diff: 1, prefer_same_city: true });
    expect(s).toBeLessThanOrEqual(100);
  });
  it('não fica abaixo de 0', () => {
    const user = { uid: 'u1', level: 3 };
    const candidate = { id: 'u2', level: 0, matches_played: 0 };
    const s = matchScore(user, candidate, { min_level_diff: 0, max_level_diff: 5 });
    expect(s).toBeGreaterThanOrEqual(0);
  });
});

describe('matchesCriteria', () => {
  const user = { uid: 'u1', level: 3, city: 'SP' };

  it('true para candidato dentro dos critérios', () => {
    const c = { id: 'u2', level: 3, city: 'SP' };
    expect(matchesCriteria(user, c)).toBe(true);
  });
  it('false se nível muito diferente', () => {
    const c = { id: 'u2', level: 6 };
    expect(matchesCriteria(user, c, { max_level_diff: 1.5 })).toBe(false);
  });
  it('false se cidade não bate', () => {
    const c = { id: 'u2', level: 3, city: 'RJ' };
    expect(matchesCriteria(user, c, { city: 'SP' })).toBe(false);
  });
  it('false se é o próprio user', () => {
    const c = { id: 'u1', level: 3, city: 'SP' };
    expect(matchesCriteria(user, c)).toBe(false);
  });
  it('false se formato não bate', () => {
    const c = { id: 'u2', level: 3, preferred_formats: ['simples'] };
    expect(matchesCriteria(user, c, { format: 'duplas' })).toBe(false);
  });
});

describe('sortByMatchScore', () => {
  it('ordena por score decrescente', () => {
    const user = { uid: 'u1', level: 3, city: 'SP' };
    const cands = [
      { id: 'u2', level: 3, city: 'SP' },     // alto (mesmo nível + mesma cidade)
      { id: 'u3', level: 5, city: 'SP' },     // baixo (nível diferente)
      { id: 'u4', level: 3, city: 'RJ' },     // médio (mesmo nível, cidade diferente)
    ];
    const out = sortByMatchScore(user, cands, { max_level_diff: 3 });
    expect(out[0].id).toBe('u2');
    expect(out[1].id).toBe('u4');
    expect(out[2].id).toBe('u3');
  });
  it('adiciona _score em cada candidato', () => {
    const user = { uid: 'u1', level: 3 };
    const out = sortByMatchScore(user, [{ id: 'u2', level: 3 }]);
    expect(typeof out[0]._score).toBe('number');
  });
});

describe('topMatches', () => {
  it('retorna top N', () => {
    const user = { uid: 'u1', level: 3 };
    const cands = Array.from({ length: 20 }, (_, i) => ({ id: `u${i + 2}`, level: 3 }));
    const out = topMatches(user, cands, {}, 5);
    expect(out.length).toBe(5);
  });
});

describe('scoreLabel', () => {
  it('rótulos por faixa', () => {
    expect(scoreLabel(90)).toContain('Excelente');
    expect(scoreLabel(70)).toContain('Bom');
    expect(scoreLabel(50)).toContain('ok');
    expect(scoreLabel(30)).toContain('fraco');
    expect(scoreLabel(10)).toContain('Sem');
  });
});

describe('scoreTone', () => {
  it('cores por faixa', () => {
    expect(scoreTone(90)).toBe('green');
    expect(scoreTone(70)).toBe('blue');
    expect(scoreTone(50)).toBe('amber');
    expect(scoreTone(20)).toBe('gray');
  });
});

describe('normalizeMatchmakingCriteria', () => {
  it('aceita critério padrão', () => {
    const r = normalizeMatchmakingCriteria({});
    expect(r.valid).toBe(true);
    expect(r.value.max_level_diff).toBe(1.5);
  });
  it('rejeita min > max', () => {
    const r = normalizeMatchmakingCriteria({ min_level_diff: 3, max_level_diff: 1 });
    expect(r.valid).toBe(false);
  });
  it('rejeita diff negativo', () => {
    const r = normalizeMatchmakingCriteria({ max_level_diff: -1 });
    expect(r.valid).toBe(false);
  });
});
