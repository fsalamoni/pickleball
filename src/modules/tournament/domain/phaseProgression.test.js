import { describe, it, expect } from 'vitest';
import {
  rankEntrantsInGroup,
  selectQualifiers,
  buildNextPhaseEntrants,
} from './phaseProgression.js';
import { normalizePhase } from './phases.js';
import { DEFAULT_SCORING_CONFIG } from './scoring.js';
import {
  TOURNAMENT_STAGE_TYPE,
  PHASE_DIVISION_MODE,
  PHASE_QUALIFIER_MODE,
  PHASE_FEED_MODE,
  PHASE_PAIRING_MODE,
} from './constants.js';

const CFG = DEFAULT_SCORING_CONFIG;

/** Jogo finalizado: winnerSide 'a' vence por 11x5. */
function match(group, aIds, bIds, winnerSide) {
  const a = Array.isArray(aIds) ? aIds : [aIds];
  const b = Array.isArray(bIds) ? bIds : [bIds];
  return {
    group,
    side_a_ids: a,
    side_b_ids: b,
    games: [winnerSide === 'a' ? { a: 11, b: 5 } : { a: 5, b: 11 }],
    walkover: null,
    status: 'finished',
  };
}

function entrant(id, meta = {}) {
  return { id, members: [id], label: id, ...meta };
}

describe('rankEntrantsInGroup', () => {
  it('classifica por vitórias (round-robin de 3)', () => {
    const entrants = [entrant('a'), entrant('b'), entrant('c')];
    // a vence b e c; b vence c → ordem a, b, c
    const matches = [
      match('A', 'a', 'b', 'a'),
      match('A', 'a', 'c', 'a'),
      match('A', 'b', 'c', 'a'),
    ];
    const ranked = rankEntrantsInGroup(entrants, matches, CFG);
    expect(ranked.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(ranked[0].rank).toBe(1);
  });
});

describe('rankEntrantsInGroup — duplas formadas contam como uma unidade', () => {
  it('agrega as estatísticas dos 2 membros e classifica o par como um só', () => {
    // 2 duplas formadas: AB (a,b) vence CD (c,d) por 11x5.
    const entrants = [
      { id: 'AB', members: ['a', 'b'], label: 'AB' },
      { id: 'CD', members: ['c', 'd'], label: 'CD' },
    ];
    const matches = [
      { group: 'G', side_a_ids: ['a', 'b'], side_b_ids: ['c', 'd'], games: [{ a: 11, b: 5 }], status: 'finished' },
    ];
    const ranked = rankEntrantsInGroup(entrants, matches, CFG);
    expect(ranked.map((e) => e.id)).toEqual(['AB', 'CD']);
    // vitórias contam 1 para o par (não 2, apesar de 2 membros)
    expect(ranked[0].stats.wins).toBe(1);
    expect(ranked[0].stats.played).toBe(1);
    expect(ranked[0].stats.points_for).toBe(11);
    expect(ranked[1].stats.wins).toBe(0);
  });
});

describe('selectQualifiers', () => {
  const ranked = [
    entrant('m1', { gender: 'male', rank: 1 }),
    entrant('f1', { gender: 'female', rank: 2 }),
    entrant('m2', { gender: 'male', rank: 3 }),
    entrant('f2', { gender: 'female', rank: 4 }),
  ];

  it('OVERALL pega os N melhores', () => {
    const q = selectQualifiers(ranked, {
      qualifier_mode: PHASE_QUALIFIER_MODE.OVERALL,
      qualifiers_per_group: 2,
    });
    expect(q.map((e) => e.id)).toEqual(['m1', 'f1']);
  });

  it('BY_GENDER pega o melhor de cada gênero', () => {
    const q = selectQualifiers(ranked, {
      qualifier_mode: PHASE_QUALIFIER_MODE.BY_GENDER,
      qualifiers_per_group: 1,
    });
    expect(q.map((e) => e.id).sort()).toEqual(['f1', 'm1']);
  });
});

describe('buildNextPhaseEntrants — Exemplo 1 (mista por grupo → mata-mata AB/CD)', () => {
  it('forma 1 dupla mista por grupo e ordena a chave A×B, C×D', () => {
    const prev = normalizePhase({
      type: TOURNAMENT_STAGE_TYPE.AMERICANO,
      division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
      group_count: 4,
      qualifier_mode: PHASE_QUALIFIER_MODE.BY_GENDER,
      qualifiers_per_group: 1,
      pairing_mode: PHASE_PAIRING_MODE.MIXED_BY_GROUP,
    });
    const next = normalizePhase({ type: TOURNAMENT_STAGE_TYPE.KNOCKOUT });

    const sourceGroups = ['A', 'B', 'C', 'D'].map((letter, i) => ({
      index: i,
      name: `Grupo ${letter}`,
      ranked: [
        entrant(`${letter}m`, { gender: 'male', rank: 1 }),
        entrant(`${letter}f`, { gender: 'female', rank: 2 }),
        entrant(`${letter}x`, { gender: 'male', rank: 3 }),
      ],
    }));

    const { groups, bracketOrder } = buildNextPhaseEntrants(sourceGroups, prev, next);
    // Uma única chave, com 4 duplas mistas em ordem A, B, C, D
    expect(groups).toHaveLength(1);
    expect(bracketOrder).toHaveLength(4);
    expect(bracketOrder[0].members.sort()).toEqual(['Af', 'Am']);
    expect(bracketOrder[1].members.sort()).toEqual(['Bf', 'Bm']);
    // Cada dupla mista carrega os 2 membros (M + F do grupo)
    bracketOrder.forEach((e) => expect(e.members).toHaveLength(2));
  });
});

describe('buildNextPhaseEntrants — Exemplo 2 (fusão de grupos AB/CD)', () => {
  it('funde 4 grupos em 2 (AB, CD) levando os 2 melhores de cada', () => {
    const prev = normalizePhase({
      type: TOURNAMENT_STAGE_TYPE.AMERICANO,
      division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
      group_count: 4,
      qualifier_mode: PHASE_QUALIFIER_MODE.OVERALL,
      qualifiers_per_group: 2,
      pairing_mode: PHASE_PAIRING_MODE.NONE,
    });
    const next = normalizePhase({
      type: TOURNAMENT_STAGE_TYPE.AMERICANO,
      division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
      group_count: 2,
      feed_mode: PHASE_FEED_MODE.MERGE_GROUPS,
      merge_size: 2,
    });

    const sourceGroups = ['A', 'B', 'C', 'D'].map((letter, i) => ({
      index: i,
      name: `Grupo ${letter}`,
      ranked: [
        entrant(`${letter}1`, { rank: 1 }),
        entrant(`${letter}2`, { rank: 2 }),
        entrant(`${letter}3`, { rank: 3 }),
      ],
    }));

    const { groups } = buildNextPhaseEntrants(sourceGroups, prev, next);
    expect(groups).toHaveLength(2);
    expect(groups[0].name).toBe('Grupo AB');
    expect(groups[0].entrants.map((e) => e.id)).toEqual(['A1', 'A2', 'B1', 'B2']);
    expect(groups[1].name).toBe('Grupo CD');
    expect(groups[1].entrants.map((e) => e.id)).toEqual(['C1', 'C2', 'D1', 'D2']);
  });
});

describe('buildNextPhaseEntrants — pairing é ignorado quando a próxima fase é rotação', () => {
  it('2 grupos, 2 classificados, PAIR_TOP_TWO + próxima Americano: avançam 4 individuais (grupo AB)', () => {
    const prev = normalizePhase({
      type: TOURNAMENT_STAGE_TYPE.AMERICANO,
      division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
      group_count: 2,
      qualifier_mode: PHASE_QUALIFIER_MODE.OVERALL,
      qualifiers_per_group: 2,
      pairing_mode: PHASE_PAIRING_MODE.PAIR_TOP_TWO, // será ignorado (rotação)
    });
    const next = normalizePhase({
      type: TOURNAMENT_STAGE_TYPE.AMERICANO,
      division_mode: PHASE_DIVISION_MODE.SINGLE,
      feed_mode: PHASE_FEED_MODE.MERGE_GROUPS,
      merge_size: 2,
    });
    const sourceGroups = ['A', 'B'].map((letter, i) => ({
      index: i,
      name: `Grupo ${letter}`,
      ranked: [
        entrant(`${letter}1`, { rank: 1 }),
        entrant(`${letter}2`, { rank: 2 }),
        entrant(`${letter}3`, { rank: 3 }),
      ],
    }));
    const { groups, entrants } = buildNextPhaseEntrants(sourceGroups, prev, next);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Grupo AB');
    // 4 entrants individuais (não 2 duplas)
    expect(entrants).toHaveLength(4);
    entrants.forEach((e) => expect(e.members).toHaveLength(1));
    expect(groups[0].entrants.map((e) => e.id)).toEqual(['A1', 'A2', 'B1', 'B2']);
  });
});

describe('buildNextPhaseEntrants — final por duplas (PAIR_TOP_TWO)', () => {
  it('forma 1 dupla com os 2 melhores de cada grupo para a final', () => {
    const prev = normalizePhase({
      type: TOURNAMENT_STAGE_TYPE.AMERICANO,
      qualifier_mode: PHASE_QUALIFIER_MODE.OVERALL,
      qualifiers_per_group: 2,
      pairing_mode: PHASE_PAIRING_MODE.PAIR_TOP_TWO,
    });
    const next = normalizePhase({ type: TOURNAMENT_STAGE_TYPE.KNOCKOUT });

    const sourceGroups = ['AB', 'CD'].map((letter, i) => ({
      index: i,
      name: `Grupo ${letter}`,
      ranked: [entrant(`${letter}1`, { rank: 1 }), entrant(`${letter}2`, { rank: 2 })],
    }));

    const { bracketOrder } = buildNextPhaseEntrants(sourceGroups, prev, next);
    expect(bracketOrder).toHaveLength(2);
    expect(bracketOrder[0].members.sort()).toEqual(['AB1', 'AB2']);
    expect(bracketOrder[1].members.sort()).toEqual(['CD1', 'CD2']);
  });
});
