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

describe('buildBracketColumns — a chave inteira desde o sorteio', () => {
  const r1 = [1, 2, 3, 4].map((p) => ({ id: `q${p}`, stage_type: 'knockout', round: 1, position: p }));

  it('⭐ só com a 1ª rodada sorteada, já mostra Quartas, Semifinal e Final', () => {
    const { columns, totalRounds } = buildBracketColumns(r1);
    expect(totalRounds).toBe(3);
    expect(columns.map((c) => c.label)).toEqual(['Quartas de final', 'Semifinal', 'Final']);
    expect(columns.map((c) => c.matches.length)).toEqual([4, 2, 1]);
  });

  it('as vagas dizem de quais jogos vêm os classificados', () => {
    const { columns } = buildBracketColumns(r1);
    expect(columns[0].matches.map((m) => m.number)).toEqual([1, 2, 3, 4]);
    expect(columns[1].matches[0]).toMatchObject({ placeholder: true, number: 5, from: [1, 2] });
    expect(columns[1].matches[1]).toMatchObject({ placeholder: true, number: 6, from: [3, 4] });
    expect(columns[2].matches[0]).toMatchObject({ placeholder: true, number: 7, from: [5, 6] });
  });

  it('confronto já criado ocupa o lugar dele, e o 3º lugar sai separado', () => {
    const { columns, thirdPlace } = buildBracketColumns([
      ...r1,
      { id: 's2', stage_type: 'knockout', round: 2, position: 2 },
      { id: 'bronze', stage_type: 'knockout', round: 3, position: 2, third_place: true },
    ]);
    expect(columns[1].matches[0].placeholder).toBe(true);
    expect(columns[1].matches[1].id).toBe('s2');
    expect(columns[2].matches).toHaveLength(1);
    expect(thirdPlace.id).toBe('bronze');
  });
});
