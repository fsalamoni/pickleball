import { describe, it, expect } from 'vitest';
import { duprRecordCheck, DUPR_ISSUE } from './duprRecord.js';

describe('duprRecordCheck', () => {
  it('cadastro certo: ID e rating à vista, nada a conferir', () => {
    const r = duprRecordCheck({ dupr_id: '5931502152', dupr_rating: 4.525 });
    expect(r).toMatchObject({ id: '5931502152', rating: 4.525, informed: true, issues: [] });
  });

  it('sem DUPR: não informado, sem alarme', () => {
    expect(duprRecordCheck({})).toMatchObject({ id: null, rating: null, informed: false, issues: [] });
  });

  it('⭐ rating cravado no limite (rastro da leitura antiga que limitava) é apontado', () => {
    expect(duprRecordCheck({ dupr_rating: 8 }).issues).toEqual([DUPR_ISSUE.AT_LIMIT]);
    expect(duprRecordCheck({ dupr_rating: 2 }).issues).toEqual([DUPR_ISSUE.AT_LIMIT]);
  });

  it('rating gravado fora da faixa: apontado, com o palpite', () => {
    const r = duprRecordCheck({ dupr_rating: 4525 });
    expect(r.issues).toEqual([DUPR_ISSUE.OUT_OF_RANGE]);
    expect(r.rating).toBeNull();
    expect(r.raw).toBe('4525');
    expect(r.suggestion).toBe(4.525);
  });

  it('ID trocado com o rating, ou com caractere que o DUPR não usa', () => {
    expect(duprRecordCheck({ dupr_id: '4,525' }).issues).toEqual([DUPR_ISSUE.ID_LOOKS_LIKE_RATING]);
    expect(duprRecordCheck({ dupr_id: 'DDQ 0KL' }).issues).toEqual([DUPR_ISSUE.ID_FORMAT]);
  });

  it('o que veio do login oficial do DUPR não é suspeito', () => {
    const r = duprRecordCheck({ dupr_id: 'ABC123', dupr_rating: 8, dupr_verified: true });
    expect(r.verified).toBe(true);
    expect(r.issues).toEqual([]);
  });
});
