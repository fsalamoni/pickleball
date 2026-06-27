import { describe, it, expect } from 'vitest';
import { rankMatchmakingCandidates } from './matchmaking.js';

const candidates = [
  { id: 'a', rating: 1000, city: 'São Paulo' },
  { id: 'b', rating: 1300, city: 'Rio' },
  { id: 'c', rating: 1050, city: 'Rio' },
  { id: 'd', rating: 950, city: 'São Paulo' },
];

describe('rankMatchmakingCandidates', () => {
  it('ordena por proximidade de rating', () => {
    const result = rankMatchmakingCandidates(1000, candidates);
    expect(result[0].id).toBe('a'); // diff 0
    expect(result.at(-1).id).toBe('b'); // diff 300
    expect(result[0].ratingDiff).toBe(0);
  });

  it('filtra pela faixa máxima de diferença', () => {
    const result = rankMatchmakingCandidates(1000, candidates, { maxDiff: 100 });
    expect(result.map((c) => c.id).sort()).toEqual(['a', 'c', 'd']);
    expect(result.some((c) => c.id === 'b')).toBe(false);
  });

  it('prioriza a mesma cidade antes da proximidade de rating', () => {
    const result = rankMatchmakingCandidates(1000, candidates, { city: 'Rio' });
    // candidatos do Rio (c, b) vêm primeiro, ordenados por diff entre si
    expect(result[0].id).toBe('c');
    expect(result[1].id).toBe('b');
  });

  it('é tolerante a rating ausente', () => {
    const result = rankMatchmakingCandidates(NaN, [{ id: 'x', rating: 1200 }]);
    expect(result).toHaveLength(1);
    expect(result[0].ratingDiff).toBe(1200);
  });
});
