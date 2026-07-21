import { describe, it, expect } from 'vitest';
import {
  INTERNAL_TOURNAMENT_STATUS, PRIZE_TYPE,
  normalizeInternalTournamentInput, normalizePrizeInput, calculateLadderPosition,
} from './leagues.js';

describe('normalizeInternalTournamentInput', () => {
  it('aceita torneio válido', () => {
    const r = normalizeInternalTournamentInput({ name: 'Torneio', date: '2026-07-20', max_participants: 8 });
    expect(r.valid).toBe(true);
    expect(r.value.max_participants).toBe(8);
  });
  it('rejeita sem nome', () => {
    const r = normalizeInternalTournamentInput({ date: '2026-07-20', max_participants: 8 });
    expect(r.valid).toBe(false);
  });
  it('rejeita max_participants fora do range', () => {
    expect(normalizeInternalTournamentInput({ name: 'X', date: '2026-07-20', max_participants: 1 }).valid).toBe(false);
    expect(normalizeInternalTournamentInput({ name: 'X', date: '2026-07-20', max_participants: 100 }).valid).toBe(false);
  });
});

describe('normalizePrizeInput', () => {
  it('aceita prêmio válido', () => {
    const r = normalizePrizeInput({ position: 1, type: 'cash', value: 'R$ 500' });
    expect(r.valid).toBe(true);
  });
  it('rejeita position > 10', () => {
    const r = normalizePrizeInput({ position: 11, value: 'X' });
    expect(r.valid).toBe(false);
  });
});

describe('calculateLadderPosition', () => {
  it('ordena por pontos desc', () => {
    const list = [
      { id: 'u1', name: 'A', points: 5 },
      { id: 'u2', name: 'B', points: 10 },
      { id: 'u3', name: 'C', points: 3 },
    ];
    const r = calculateLadderPosition(list);
    expect(r[0].id).toBe('u2');
    expect(r[0].ladder_position).toBe(1);
    expect(r[2].id).toBe('u3');
    expect(r[2].ladder_position).toBe(3);
  });
  it('vazio para entrada vazia', () => {
    expect(calculateLadderPosition([])).toEqual([]);
  });
});
