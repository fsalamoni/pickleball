import { describe, it, expect } from 'vitest';
import { COURT_SIDE } from '@/modules/athletes/domain/profileMeta';
import {
  computeMatchCompatibility, rankSmartMatchmaking, ratingProximityScore,
  courtSideScore, cityScore, interestsOverlap, SMART_WEIGHTS,
} from './smartMatchmaking.js';

describe('smartMatchmaking', () => {
  it('rating: proximidade máxima quando igual, zero quando muito distante', () => {
    expect(ratingProximityScore(1000, 1000)).toBe(SMART_WEIGHTS.rating);
    expect(ratingProximityScore(1000, 1300)).toBe(0); // diff = RATING_SCALE
    expect(ratingProximityScore(1000, 1600)).toBe(0); // além da escala
    expect(ratingProximityScore(1000, 1150)).toBeCloseTo(SMART_WEIGHTS.rating * 0.5, 5);
  });

  it('rating: sem rating válido não pontua', () => {
    expect(ratingProximityScore(undefined, 1000)).toBe(0);
    expect(ratingProximityScore(1000, null)).toBe(0);
  });

  it('lado da quadra: complementar > qualquer > mesmo lado', () => {
    const complementar = courtSideScore(COURT_SIDE.LEFT, COURT_SIDE.RIGHT);
    const flexivel = courtSideScore(COURT_SIDE.ANY, COURT_SIDE.LEFT);
    const mesmo = courtSideScore(COURT_SIDE.LEFT, COURT_SIDE.LEFT);
    expect(complementar).toBe(SMART_WEIGHTS.courtSide);
    expect(complementar).toBeGreaterThan(flexivel);
    expect(flexivel).toBeGreaterThan(mesmo);
  });

  it('cidade: tudo ou nada, case/espaco-insensível', () => {
    expect(cityScore('Porto Alegre', ' porto alegre ')).toBe(SMART_WEIGHTS.city);
    expect(cityScore('Porto Alegre', 'Canoas')).toBe(0);
    expect(cityScore('', 'Canoas')).toBe(0);
  });

  it('interesses: proporcional e conta compartilhados', () => {
    const r = interestsOverlap(['a', 'b', 'c'], ['b', 'c', 'x']);
    expect(r.shared).toBe(2);
    expect(r.score).toBeCloseTo(SMART_WEIGHTS.interests * (2 / 3), 5);
    expect(interestsOverlap([], ['a']).score).toBe(0);
  });

  it('compatibilidade total fica entre 0 e 100 e lista motivos', () => {
    const me = { rating: 1000, city: 'Porto Alegre', court_side: COURT_SIDE.LEFT, interests: ['random_partners', 'ranking'] };
    const perfect = { rating: 1000, city: 'Porto Alegre', court_side: COURT_SIDE.RIGHT, interests: ['random_partners', 'ranking'] };
    const res = computeMatchCompatibility(me, perfect);
    expect(res.score).toBe(100);
    expect(res.reasons).toContain('Nível parecido');
    expect(res.reasons).toContain('Lados complementares');
    expect(res.reasons).toContain('Mesma cidade');
    expect(res.reasons).toContain('2 interesses em comum');
  });

  it('parceiro pouco compatível pontua baixo', () => {
    const me = { rating: 1000, city: 'Porto Alegre', court_side: COURT_SIDE.LEFT, interests: ['random_partners'] };
    const far = { rating: 1500, city: 'Recife', court_side: COURT_SIDE.LEFT, interests: ['arena_manage'] };
    const res = computeMatchCompatibility(me, far);
    expect(res.score).toBeLessThan(30);
    expect(res.reasons).toHaveLength(0);
  });

  it('rankSmartMatchmaking ordena por score desc e anota compatibility', () => {
    const me = { rating: 1000, city: 'Porto Alegre', court_side: COURT_SIDE.LEFT, interests: ['random_partners'] };
    const cands = [
      { id: 'far', rating: 1400, city: 'Recife', court_side: COURT_SIDE.LEFT, interests: [] },
      { id: 'perfect', rating: 1000, city: 'Porto Alegre', court_side: COURT_SIDE.RIGHT, interests: ['random_partners'] },
    ];
    const ranked = rankSmartMatchmaking(me, cands);
    expect(ranked[0].id).toBe('perfect');
    expect(ranked[0].compatibility.score).toBeGreaterThan(ranked[1].compatibility.score);
  });

  it('minScore filtra candidatos fracos', () => {
    const me = { rating: 1000, court_side: COURT_SIDE.ANY, interests: [] };
    const cands = [{ id: 'x', rating: 2000, court_side: COURT_SIDE.ANY, interests: [] }];
    expect(rankSmartMatchmaking(me, cands, { minScore: 50 })).toHaveLength(0);
  });
});
