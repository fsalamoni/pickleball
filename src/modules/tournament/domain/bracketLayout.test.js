import { describe, it, expect } from 'vitest';
import {
  isWinnersBracketMatch, roundLabel, buildBracketColumns, isKnockoutSet,
  buildKnockoutDiagram, layoutBracketColumns, refLabel, winnerIdsOf,
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

describe('buildKnockoutDiagram — o desenho da chave', () => {
  const r1 = [1, 2, 3, 4].map((p) => ({
    id: `q${p}`, stage_type: 'knockout', round: 1, position: p, side_a_ids: [`a${p}`], side_b_ids: [`b${p}`],
  }));

  it('grupo e rodadas não viram diagrama (ficam em tabela)', () => {
    expect(buildKnockoutDiagram([{ id: 'g', round: 1, position: 1, group: 'A' }])).toBeNull();
    expect(buildKnockoutDiagram([{ id: 'r', round: 1, position: 1, stage_type: 'groups' }])).toBeNull();
  });

  it('cada vaga futura diz de onde vem e quem a alimenta', () => {
    const d = buildKnockoutDiagram(r1);
    const [quartas, semis, final] = d.sections[0].columns;
    expect(quartas.cells[0].feeders).toEqual([]);
    expect(semis.cells[1].feeders).toEqual([2, 3]);
    expect(semis.cells[1].refs.map(refLabel)).toEqual(['Vencedor do jogo 3', 'Vencedor do jogo 4']);
    expect(final.cells[0].refs.map(refLabel)).toEqual(['Vencedor do jogo 5', 'Vencedor do jogo 6']);
    expect(refLabel(d.champion.ref)).toBe('Vencedor do jogo 7');
    expect(d.champion.ids).toBeNull();
  });

  it('a vaga do 3º lugar aparece antes do jogo existir, com os perdedores das semis', () => {
    const d = buildKnockoutDiagram(r1, { thirdPlace: true });
    expect(d.thirdPlace).toMatchObject({ placeholder: true, number: 8 });
    expect(d.thirdPlace.refs.map(refLabel)).toEqual(['Perdedor do jogo 5', 'Perdedor do jogo 6']);
    expect(buildKnockoutDiagram(r1).thirdPlace).toBeNull();
  });

  it('o campeão sai do vencedor da final', () => {
    const d = buildKnockoutDiagram([
      { id: 'f', stage_type: 'knockout', round: 1, position: 1, side_a_ids: ['x'], side_b_ids: ['y'], winner_side: 'b' },
    ]);
    expect(d.sections[0].columns.map((c) => c.label)).toEqual(['Final']);
    expect(d.champion.ids).toEqual(['y']);
    expect(winnerIdsOf({ placeholder: true, winner_side: 'a' })).toBeNull();
  });

  it('dupla eliminação: repescagem ligada à chave principal e grande final', () => {
    const d = buildKnockoutDiagram(r1.map((m) => ({ ...m, bracket: 'wb', stage_type: 'double_knockout' })));
    expect(d.double).toBe(true);
    const [principal, repescagem] = d.sections;
    expect(principal.columns.map((c) => c.label))
      .toEqual(['Quartas de final', 'Semifinal', 'Final da chave principal', 'Grande final']);
    expect(repescagem.columns.map((c) => c.cells.length)).toEqual([2, 2, 1, 1]);
    // 1ª rodada: os perdedores das quartas.
    expect(repescagem.columns[0].cells[0].refs.map(refLabel)).toEqual(['Perdedor do jogo 1', 'Perdedor do jogo 2']);
    // Junção: o vencedor da repescagem contra quem caiu da semifinal.
    expect(repescagem.columns[1].cells[0].refs.map(refLabel)).toEqual(['Vencedor do jogo 8', 'Perdedor do jogo 5']);
    expect(repescagem.columns[1].cells[0].feeders).toEqual([0]);
    const gf = principal.columns[3].cells[0];
    expect(gf.refs.map(refLabel)).toEqual(['Vencedor do jogo 7', 'Vencedor do jogo 13']);
    expect(refLabel(d.champion.ref)).toBe(`Vencedor do jogo ${gf.number}`);
  });
});

describe('layoutBracketColumns', () => {
  it('cada jogo fica no meio dos dois que o alimentam', () => {
    const cols = [
      { cells: [{ feeders: [] }, { feeders: [] }, { feeders: [] }, { feeders: [] }] },
      { cells: [{ feeders: [0, 1] }, { feeders: [2, 3] }] },
      { cells: [{ feeders: [0, 1] }] },
    ];
    const { ys, height } = layoutBracketColumns(cols, { cardH: 80, gapY: 20 });
    expect(ys[0]).toEqual([40, 140, 240, 340]);
    expect(ys[1]).toEqual([90, 290]);
    expect(ys[2]).toEqual([190]);
    expect(height).toBe(380);
  });
});
