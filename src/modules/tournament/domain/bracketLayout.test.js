import { describe, it, expect } from 'vitest';
import { isWinnersBracketMatch, roundLabel, buildBracketColumns } from './bracketLayout.js';

describe('isWinnersBracketMatch', () => {
  it('aceita jogo de mata-mata (round, sem grupo)', () => {
    expect(isWinnersBracketMatch({ round: 1, position: 1 })).toBe(true);
    expect(isWinnersBracketMatch({ round: 2, bracket: 'wb' })).toBe(true);
  });
  it('rejeita grupo, repescagem e grande final', () => {
    expect(isWinnersBracketMatch({ round: 1, group: 'A' })).toBe(false);
    expect(isWinnersBracketMatch({ round: 1, bracket: 'lb' })).toBe(false);
    expect(isWinnersBracketMatch({ round: 1, bracket: 'gf' })).toBe(false);
    expect(isWinnersBracketMatch({ position: 1 })).toBe(false);
  });
});

describe('roundLabel', () => {
  it('nomeia as fases finais', () => {
    expect(roundLabel(3, 3)).toBe('Final');
    expect(roundLabel(2, 3)).toBe('Semifinal');
    expect(roundLabel(1, 3)).toBe('Quartas de final');
    expect(roundLabel(1, 4)).toBe('Oitavas de final');
    expect(roundLabel(1, 5)).toBe('Rodada 1');
  });
});

describe('buildBracketColumns', () => {
  const matches = [
    { id: 'm1', round: 1, position: 2, side_a: 'C', side_b: 'D' },
    { id: 'm2', round: 1, position: 1, side_a: 'A', side_b: 'B' },
    { id: 'm3', round: 2, position: 1, side_a: 'A', side_b: 'C' },
    { id: 'g1', round: 1, group: 'A' }, // ignorado
  ];

  it('agrupa por rodada e ordena por posição', () => {
    const { columns, totalRounds } = buildBracketColumns(matches);
    expect(totalRounds).toBe(2);
    expect(columns).toHaveLength(2);
    expect(columns[0].matches.map((m) => m.id)).toEqual(['m2', 'm1']); // ordenado por position
    expect(columns[0].label).toBe('Semifinal');
    expect(columns[1].label).toBe('Final');
  });

  it('vazio quando não há mata-mata', () => {
    expect(buildBracketColumns([{ round: 1, group: 'A' }]).columns).toHaveLength(0);
  });
});
