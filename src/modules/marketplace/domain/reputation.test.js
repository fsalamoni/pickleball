import { describe, it, expect } from 'vitest';
import { validateReview, reviewIsVisible, summarizeReviews, ratingLabel, sellerBadges } from './reputation.js';

describe('reputação', () => {
  it('valida a avaliação', () => {
    expect(validateReview({ rating: 0 }).error).toBeTruthy();
    expect(validateReview({ rating: 1, comment: 'ruim' }).error).toMatch(/Conte/);
    expect(validateReview({ rating: 5 }).value).toEqual({ rating: 5, comment: '' });
  });
  it('cegueira mútua', () => {
    const now = Date.UTC(2026, 9, 30);
    expect(reviewIsVisible({ created_at_ms: now - 86400000 }, { now })).toBe(false);
    expect(reviewIsVisible({ created_at_ms: now - 86400000 }, { now, otherSideReviewed: true })).toBe(true);
    expect(reviewIsVisible({ created_at_ms: now - 15 * 86400000 }, { now })).toBe(true);
  });
  it('resumo e rótulo', () => {
    const s = summarizeReviews([{ rating: 5, visible: true }, { rating: 4, visible: true }, { rating: 5, visible: true }, { rating: 1, visible: false }]);
    expect(s).toMatchObject({ count: 3, avg: 4.7, showRating: true });
    expect(ratingLabel(4.66, 3)).toBe('4,7 (3)');
    expect(ratingLabel(5, 2)).toBe('Vendedor novo');
  });
  it('selos', () => {
    expect(sellerBadges({ verified: true, seller_type: 'store' }).map((b) => b.label)).toEqual(['Loja verificada']);
    expect(sellerBadges({ seller_type: 'coach', sales_count: 12, rating_avg: 4.9, rating_count: 5 }).map((b) => b.id)).toEqual(['coach', 'top']);
  });
});
