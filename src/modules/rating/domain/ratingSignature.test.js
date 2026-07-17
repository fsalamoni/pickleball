import { describe, it, expect } from 'vitest';
import { computeRatingSignature } from './ratingSignature.js';
import { TOURNAMENT_STATUS, TOURNAMENT_VISIBILITY } from '@/modules/tournament/domain/constants';

const pubClosed = (id, updated, closed) => ({
  id,
  visibility: TOURNAMENT_VISIBILITY.PUBLIC,
  status: TOURNAMENT_STATUS.FINISHED,
  updated_at: updated,
  auto_closed_at: closed,
});

describe('computeRatingSignature', () => {
  it('considera apenas torneios elegíveis (público + encerrado)', () => {
    const sig = computeRatingSignature([
      pubClosed('t1', 1000, 1000),
      { id: 't2', visibility: TOURNAMENT_VISIBILITY.PRIVATE, status: TOURNAMENT_STATUS.FINISHED },
      { id: 't3', visibility: TOURNAMENT_VISIBILITY.PUBLIC, status: TOURNAMENT_STATUS.IN_PROGRESS },
    ]);
    expect(sig).toBe('t1:1000:1000');
  });

  it('é estável independente da ordem de entrada', () => {
    const a = computeRatingSignature([pubClosed('t1', 1, 1), pubClosed('t2', 2, 2)]);
    const b = computeRatingSignature([pubClosed('t2', 2, 2), pubClosed('t1', 1, 1)]);
    expect(a).toBe(b);
  });

  it('muda quando um torneio é encerrado (novo elegível) ou editado', () => {
    const before = computeRatingSignature([pubClosed('t1', 1, 1)]);
    const afterNew = computeRatingSignature([pubClosed('t1', 1, 1), pubClosed('t2', 5, 5)]);
    const afterEdit = computeRatingSignature([pubClosed('t1', 9, 1)]);
    expect(afterNew).not.toBe(before);
    expect(afterEdit).not.toBe(before);
  });

  it('vazio quando não há torneios elegíveis', () => {
    expect(computeRatingSignature([])).toBe('');
  });
});
