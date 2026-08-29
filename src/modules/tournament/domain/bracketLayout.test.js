import { describe, it, expect } from 'vitest';
import {
  isWinnersBracketMatch, roundLabel, buildBracketColumns, isKnockoutSet,
} from './bracketLayout.js';

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

describe('isKnockoutSet', () => {
  it('mata-mata e dupla eliminação são chave', () => {
    expect(isKnockoutSet([{ stage_type: 'knockout', round: 1 }])).toBe(true);
    expect(isKnockoutSet([{ stage_type: 'double_knockout', round: 1 }])).toBe(true);
    expect(isKnockoutSet([{ bracket: 'lb', round: 1 }])).toBe(true);
  });

  it('grupo único e suíço são rodadas, não chave', () => {
    expect(isKnockoutSet([{ stage_type: 'round_robin', round: 1 }])).toBe(false);
    expect(isKnockoutSet([{ stage_type: 'swiss', round: 1 }])).toBe(false);
  });

  it('sem o tipo da fase, mantém o comportamento clássico de chave', () => {
    expect(isKnockoutSet([{ round: 1 }])).toBe(true);
    expect(isKnockoutSet([])).toBe(true);
  });
});

describe('buildBracketColumns — rodadas x fases finais', () => {
  const mk = (stageType, round, position) => ({
    id: `${round}-${position}`, stage_type: stageType, round, position,
  });

  it('grupo único (pontos corridos): as colunas são RODADAS', () => {
    const { columns, kind } = buildBracketColumns([
      mk('round_robin', 1, 1), mk('round_robin', 2, 1), mk('round_robin', 3, 1),
    ]);
    expect(kind).toBe('rounds');
    expect(columns.map((c) => c.label)).toEqual(['Rodada 1', 'Rodada 2', 'Rodada 3']);
  });

  it('mata-mata: as colunas são as fases finais', () => {
    const { columns, kind } = buildBracketColumns([
      mk('knockout', 1, 1), mk('knockout', 1, 2), mk('knockout', 2, 1),
    ]);
    expect(kind).toBe('bracket');
    expect(columns.map((c) => c.label)).toEqual(['Semifinal', 'Final']);
  });
});
