/**
 * Tests do domínio puro de review_response.
 * Sem I/O — só funções puras.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeReviewResponse, canRespondToReview, hasResponse, responseAgeHours,
  REVIEW_RESPONSE_MAX,
} from './review_response.js';

describe('normalizeReviewResponse', () => {
  it('aceita resposta válida', () => {
    const r = normalizeReviewResponse({ response: 'Obrigado pelo feedback!' });
    expect(r.valid).toBe(true);
    expect(r.error).toBeNull();
    expect(r.value).toBe('Obrigado pelo feedback!');
  });
  it('trima whitespace', () => {
    const r = normalizeReviewResponse({ response: '  Olá  ' });
    expect(r.valid).toBe(true);
    expect(r.value).toBe('Olá');
  });
  it('rejeita vazio', () => {
    const r = normalizeReviewResponse({ response: '' });
    expect(r.valid).toBe(false);
    expect(r.error).toBeTruthy();
  });
  it('rejeita só whitespace', () => {
    const r = normalizeReviewResponse({ response: '   ' });
    expect(r.valid).toBe(false);
  });
  it('rejeita null/undefined', () => {
    expect(normalizeReviewResponse({ response: null }).valid).toBe(false);
    expect(normalizeReviewResponse({}).valid).toBe(false);
  });
  it('trunca > 500 chars com error', () => {
    const r = normalizeReviewResponse({ response: 'A'.repeat(600) });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('500');
    expect(r.value).toHaveLength(REVIEW_RESPONSE_MAX);
  });
  it('aceita exatamente 500 chars', () => {
    const r = normalizeReviewResponse({ response: 'A'.repeat(500) });
    expect(r.valid).toBe(true);
    expect(r.value).toHaveLength(500);
  });
});

describe('canRespondToReview', () => {
  const arena = { id: 'a1', owner_id: 'u1' };
  it('true se owner', () => {
    expect(canRespondToReview({ uid: 'u1' }, arena)).toBe(true);
  });
  it('true se platform_admin', () => {
    expect(canRespondToReview({ uid: 'u9', isPlatformAdmin: true }, arena)).toBe(true);
  });
  it('true se user é manager da arena', () => {
    expect(canRespondToReview({ uid: 'u2' }, arena, [{ id: 'a1' }])).toBe(true);
  });
  it('false se user é manager de outra arena', () => {
    expect(canRespondToReview({ uid: 'u2' }, arena, [{ id: 'a2' }])).toBe(false);
  });
  it('false se sem user', () => {
    expect(canRespondToReview(null, arena)).toBe(false);
    expect(canRespondToReview({}, arena)).toBe(false);
  });
});

describe('hasResponse', () => {
  it('true se response com texto', () => {
    expect(hasResponse({ response: 'obrigado' })).toBe(true);
  });
  it('false com só whitespace (trim)', () => {
    expect(hasResponse({ response: '   ' })).toBe(false);
  });
  it('false se null/empty/undefined', () => {
    expect(hasResponse({ response: null })).toBe(false);
    expect(hasResponse({ response: '' })).toBe(false);
    expect(hasResponse({})).toBe(false);
    expect(hasResponse(null)).toBe(false);
  });
});

describe('responseAgeHours', () => {
  it('retorna null se sem response', () => {
    expect(responseAgeHours(null)).toBeNull();
    expect(responseAgeHours({})).toBeNull();
  });
  it('retorna horas desde responded_at', () => {
    const now = Date.now();
    const twoHoursAgo = { seconds: Math.floor((now - 2 * 60 * 60 * 1000) / 1000) };
    expect(responseAgeHours({ response: 'ok', responded_at: twoHoursAgo })).toBe(2);
  });
  it('retorna 0 se timestamp no futuro', () => {
    const future = { seconds: Math.floor((Date.now() + 60000) / 1000) };
    expect(responseAgeHours({ response: 'ok', responded_at: future })).toBe(0);
  });
  it('aceita timestamp number', () => {
    const now = Date.now();
    expect(responseAgeHours({ response: 'ok', responded_at: now - 3600000 })).toBe(1);
  });
});
