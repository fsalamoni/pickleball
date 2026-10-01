import { describe, it, expect } from 'vitest';
import { buildPhaseDraw, buildPoolDraw } from './phaseDraw.js';
import { normalizePhase } from './phases.js';
import { TOURNAMENT_STAGE_TYPE, PHASE_DIVISION_MODE } from './constants.js';

function entrant(id, members) {
  return { id, members: members || [id] };
}

describe('buildPoolDraw — pontos corridos sobre duplas formadas', () => {
  it('cada lado vira o array de membros do entrant', () => {
    const entrants = [entrant('AB', ['a', 'b']), entrant('CD', ['c', 'd']), entrant('EF', ['e', 'f'])];
    const { matches } = buildPoolDraw(entrants, TOURNAMENT_STAGE_TYPE.ROUND_ROBIN, { seed: 's' });
    // 3 entrants → 3 jogos (round robin)
    expect(matches).toHaveLength(3);
    matches.forEach((m) => {
      expect(Array.isArray(m.side_a)).toBe(true);
      expect(m.side_a.length).toBe(2);
      expect(m.side_b.length).toBe(2);
    });
  });
});

describe('buildPhaseDraw — americano em 2 grupos', () => {
  it('gera jogos por grupo, etiquetados com o nome do grupo', () => {
    const phase = normalizePhase({
      type: TOURNAMENT_STAGE_TYPE.AMERICANO,
      division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
      group_count: 2,
    });
    const groups = [
      { name: 'Grupo A', entrants: ['a1', 'a2', 'a3', 'a4'].map((id) => entrant(id)) },
      { name: 'Grupo B', entrants: ['b1', 'b2', 'b3', 'b4'].map((id) => entrant(id)) },
    ];
    const draw = buildPhaseDraw(phase, groups, { seed: 'x' });
    expect(draw.stageType).toBe(TOURNAMENT_STAGE_TYPE.AMERICANO);
    expect(draw.groups).toHaveLength(2);
    expect(draw.matches.length).toBeGreaterThan(0);
    // todos os jogos têm grupo e lados de 2 jogadores (duplas da rotação)
    draw.matches.forEach((m) => {
      expect(['Grupo A', 'Grupo B']).toContain(m.group);
      expect(m.side_a.length).toBe(2);
    });
    // jogadores de A não jogam contra B
    const aMatch = draw.matches.find((m) => m.group === 'Grupo A');
    expect([...aMatch.side_a, ...aMatch.side_b].every((id) => id.startsWith('a'))).toBe(true);
  });
});

describe('buildPhaseDraw — mata-mata define confrontos pela ordem (A×B, C×D)', () => {
  it('a chave pareia entrants adjacentes', () => {
    const phase = normalizePhase({ type: TOURNAMENT_STAGE_TYPE.KNOCKOUT });
    const groups = [
      {
        name: 'Chave',
        entrants: [
          entrant('A', ['am', 'af']),
          entrant('B', ['bm', 'bf']),
          entrant('C', ['cm', 'cf']),
          entrant('D', ['dm', 'df']),
        ],
      },
    ];
    const draw = buildPhaseDraw(phase, groups, { seed: 'k', ordered: true });
    const r1 = draw.matches.filter((m) => m.round === 1).sort((a, b) => a.position - b.position);
    expect(r1).toHaveLength(2);
    // posição 1: A×B ; posição 2: C×D
    expect([...r1[0].side_a, ...r1[0].side_b].sort()).toEqual(['af', 'am', 'bf', 'bm']);
    expect([...r1[1].side_a, ...r1[1].side_b].sort()).toEqual(['cf', 'cm', 'df', 'dm']);
  });
});

describe('🐞 2 turnos (ida e volta) valem também na modalidade de VÁRIAS fases', () => {
  const grupos = [
    { name: 'Grupo A', entrants: ['a1', 'a2', 'a3'].map((id) => entrant(id)) },
    { name: 'Grupo B', entrants: ['b1', 'b2', 'b3'].map((id) => entrant(id)) },
  ];

  it('⭐ grupo de 3 em ida e volta: 6 jogos por grupo, 4 por atleta, lados trocados no returno', () => {
    const fase = normalizePhase({ type: TOURNAMENT_STAGE_TYPE.GROUPS, division_mode: PHASE_DIVISION_MODE.GROUP_COUNT, group_count: 2, round_robin_legs: 2 });
    const draw = buildPhaseDraw(fase, grupos, { seed: 'v' });
    const doA = draw.matches.filter((m) => m.group === 'Grupo A');
    expect(doA).toHaveLength(6);
    const jogosDe = (id) => doA.filter((m) => [].concat(m.side_a, m.side_b).includes(id)).length;
    expect(jogosDe('a1')).toBe(4);
    const chave = (m) => `${[].concat(m.side_a)}|${[].concat(m.side_b)}`;
    const ida = doA.slice(0, 3).map(chave);
    const volta = doA.slice(3).map((m) => `${[].concat(m.side_b)}|${[].concat(m.side_a)}`);
    expect(volta.sort()).toEqual(ida.sort());
    expect(Math.min(...doA.slice(3).map((m) => m.round))).toBeGreaterThan(Math.max(...doA.slice(0, 3).map((m) => m.round)));
  });

  it('só ida (o padrão) segue igual a antes', () => {
    const fase = normalizePhase({ type: TOURNAMENT_STAGE_TYPE.GROUPS, division_mode: PHASE_DIVISION_MODE.GROUP_COUNT, group_count: 2 });
    expect(buildPhaseDraw(fase, grupos, { seed: 'v' }).matches.filter((m) => m.group === 'Grupo A')).toHaveLength(3);
  });

  it('⭐ Americano em ida e volta: cada dupla joga junta 2 vezes', () => {
    const fase = normalizePhase({ type: TOURNAMENT_STAGE_TYPE.AMERICANO, round_robin_legs: 2 });
    const quatro = [{ name: 'Grupo A', entrants: ['p1', 'p2', 'p3', 'p4'].map((id) => entrant(id)) }];
    const { matches } = buildPhaseDraw(fase, quatro, { seed: 'v' });
    expect(matches).toHaveLength(6);
    const duplas = new Map();
    matches.forEach((m) => [m.side_a, m.side_b].forEach((lado) => {
      const k = [...lado].sort().join('+');
      duplas.set(k, (duplas.get(k) || 0) + 1);
    }));
    expect([...duplas.values()].every((v) => v === 2)).toBe(true);
    expect(duplas.size).toBe(6);
  });
});
