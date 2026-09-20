import { describe, it, expect } from 'vitest';
import {
  rankEntrantsInGroup,
  selectQualifiers,
  buildNextPhaseEntrants,
} from './phaseProgression.js';
import { normalizePhase } from './phases.js';
import {
  normalizeTeamConfig, TEAM_GENDER, TEAM_WIN_RULE, TEAM_ETAPA_TYPE,
} from './teamFormat.js';
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

describe('rankEntrantsInGroup — modalidade de EQUIPES', () => {
  const teamConfig = normalizeTeamConfig({
    team_size: 2,
    gender: TEAM_GENDER.MALE,
    win_rule: TEAM_WIN_RULE.ALL,
    etapas: [{ type: TEAM_ETAPA_TYPE.MENS_DOUBLES }, { type: TEAM_ETAPA_TYPE.SINGLES }],
  }).value;

  /** Confronto em que `winner` leva as duas etapas. */
  const confronto = (a, b, winner) => ({
    id: `${a}x${b}`,
    side_a_ids: [a],
    side_b_ids: [b],
    team_confrontation: true,
    etapas: [
      { id: 'etapa_1', games: [{ a: winner === a ? 11 : 4, b: winner === a ? 4 : 11 }] },
      { id: 'etapa_2', games: [{ a: winner === a ? 11 : 6, b: winner === a ? 6 : 11 }] },
    ],
  });

  const entrants = ['t1', 't2', 't3'].map((id) => ({ id, members: [id], label: id }));

  it('classifica por vitórias de confronto, não por games individuais', () => {
    const matches = [
      confronto('t1', 't2', 't1'),
      confronto('t2', 't3', 't2'),
      confronto('t1', 't3', 't1'),
    ];
    const ranked = rankEntrantsInGroup(entrants, matches, {}, { teamConfig });
    expect(ranked.map((e) => e.id)).toEqual(['t1', 't2', 't3']);
    expect(ranked[0].stats).toMatchObject({ wins: 2, losses: 0, sets_won: 4, sets_lost: 0 });
    expect(ranked[2].stats).toMatchObject({ wins: 0, losses: 2 });
  });

  it('sem confrontos disputados, mantém a ordem de entrada', () => {
    const ranked = rankEntrantsInGroup(entrants, [], {}, { teamConfig });
    expect(ranked.map((e) => e.id)).toEqual(['t1', 't2', 't3']);
    expect(ranked[0].rank).toBe(1);
  });
});

/* ------------------------------------------------------------------------ *
 * REPESCAGEM E MÉRITO ENTRE GRUPOS (Onda AT)
 * ------------------------------------------------------------------------ */
describe('⭐ repescagem: as vagas que faltam para fechar a chave', () => {
  /** Grupo já classificado, com estatísticas explícitas. */
  const g = (index, ranked) => ({ index, name: `Grupo ${String.fromCharCode(65 + index)}`, ranked });
  const ent = (id, rank, wins, played, pf, pa) => ({
    id, members: [id], label: id, rank,
    stats: { wins, played, points_for: pf, points_against: pa },
  });

  // 3 grupos de 4, passam 2 → 6 classificados. A chave de 8 pede 2 repescados.
  const grupos = [
    g(0, [ent('a1', 1, 3, 3, 33, 15), ent('a2', 2, 2, 3, 30, 22), ent('a3', 3, 1, 3, 25, 28), ent('a4', 4, 0, 3, 12, 33)]),
    g(1, [ent('b1', 1, 3, 3, 33, 12), ent('b2', 2, 2, 3, 31, 20), ent('b3', 3, 1, 3, 29, 22), ent('b4', 4, 0, 3, 10, 33)]),
    g(2, [ent('c1', 1, 3, 3, 33, 18), ent('c2', 2, 2, 3, 28, 25), ent('c3', 3, 1, 3, 20, 30), ent('c4', 4, 0, 3, 14, 33)]),
  ];

  const faseGrupos = (extra = {}) => normalizePhase({
    type: TOURNAMENT_STAGE_TYPE.GROUPS,
    division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
    group_count: 3,
    qualifiers_per_group: 2,
    ...extra,
  });
  const faseChave = normalizePhase({ type: TOURNAMENT_STAGE_TYPE.KNOCKOUT });

  it('sem repescagem, nada muda: só os classificados diretos avançam', () => {
    const r = buildNextPhaseEntrants(grupos, faseGrupos(), faseChave, { seed: 's' });
    expect(r.entrants).toHaveLength(6);
    expect(r.entrants.some((e) => e._wildcard)).toBe(false);
  });

  it('⭐ com 2 vagas, os dois melhores TERCEIROS entram e fecham a chave de 8', () => {
    const r = buildNextPhaseEntrants(grupos, faseGrupos({ wildcard_slots: 2 }), faseChave, { seed: 's' });
    expect(r.entrants).toHaveLength(8);
    const repescados = r.entrants.filter((e) => e._wildcard).map((e) => e.id);
    // b3 (saldo +7/3) e a3 (−3/3) passam; c3 (−10/3) fica de fora.
    expect(repescados.sort()).toEqual(['a3', 'b3']);
  });

  it('⭐ o repescado entra como ÚLTIMO classificado do grupo dele', () => {
    const r = buildNextPhaseEntrants(grupos, faseGrupos({ wildcard_slots: 2 }), faseChave, { seed: 's' });
    const a3 = r.entrants.find((e) => e.id === 'a3');
    expect(a3._seedRank).toBe(3);
    expect(a3._groupIndex).toBe(0);
  });

  it('⭐ um 4º colocado nunca é repescado', () => {
    const r = buildNextPhaseEntrants(grupos, faseGrupos({ wildcard_slots: 9 }), faseChave, { seed: 's' });
    expect(r.entrants.filter((e) => e._wildcard)).toHaveLength(3); // só os três 3ºs
    expect(r.entrants.some((e) => e.id.endsWith('4'))).toBe(false);
  });

  it('o campo é aditivo: fase gravada sem ele se comporta como antes', () => {
    expect(normalizePhase({ type: TOURNAMENT_STAGE_TYPE.GROUPS }).wildcard_slots).toBe(0);
    expect(normalizePhase({ type: TOURNAMENT_STAGE_TYPE.GROUPS, wildcard_slots: -3 }).wildcard_slots).toBe(0);
    expect(normalizePhase({ type: TOURNAMENT_STAGE_TYPE.GROUPS, wildcard_slots: '2' }).wildcard_slots).toBe(2);
  });
});

describe('⭐ ordem da chave: colocação primeiro, MÉRITO depois', () => {
  const g = (index, ranked) => ({ index, name: `Grupo ${String.fromCharCode(65 + index)}`, ranked });
  const ent = (id, rank, wins, played, pf, pa) => ({
    id, members: [id], label: id, rank,
    stats: { wins, played, points_for: pf, points_against: pa },
  });

  it('⭐ entre os 1ºs, quem foi melhor vem antes — não a letra do grupo', () => {
    // 🐞 Antes o desempate dentro da colocação era `_groupIndex`: o 1º do
    // grupo A era sempre cabeça sobre o 1º do grupo C, mesmo tendo ido pior.
    const grupos = [
      g(0, [ent('a1', 1, 2, 4, 40, 38), ent('a2', 2, 1, 4, 30, 40)]),
      g(1, [ent('b1', 1, 3, 3, 33, 15), ent('b2', 2, 1, 3, 25, 30)]),
    ];
    const fase = normalizePhase({
      type: TOURNAMENT_STAGE_TYPE.GROUPS,
      division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
      group_count: 2,
      qualifiers_per_group: 2,
    });
    const r = buildNextPhaseEntrants(grupos, fase, normalizePhase({ type: TOURNAMENT_STAGE_TYPE.KNOCKOUT }), { seed: 's' });
    // b1 (100% em 3) vem antes de a1 (50% em 4); os 2ºs depois dos 1ºs.
    expect(r.bracketOrder.map((e) => e.id)).toEqual(['b1', 'a1', 'b2', 'a2']);
  });

  it('todos os 1ºs vêm antes de qualquer 2º', () => {
    const grupos = [
      g(0, [ent('a1', 1, 1, 4, 30, 40), ent('a2', 2, 0, 4, 20, 44)]),
      g(1, [ent('b1', 1, 4, 4, 44, 20), ent('b2', 2, 3, 4, 40, 30)]),
    ];
    const fase = normalizePhase({
      type: TOURNAMENT_STAGE_TYPE.GROUPS,
      division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
      group_count: 2,
      qualifiers_per_group: 2,
    });
    const r = buildNextPhaseEntrants(grupos, fase, normalizePhase({ type: TOURNAMENT_STAGE_TYPE.KNOCKOUT }), { seed: 's' });
    expect(r.bracketOrder.slice(0, 2).map((e) => e._seedRank)).toEqual([1, 1]);
    expect(r.bracketOrder.slice(2).map((e) => e._seedRank)).toEqual([2, 2]);
  });
});

/* ------------------------------------------------------------------------ *
 * CONFIGURAÇÃO TOTAL DO ORGANIZADOR (Onda AT)
 * ------------------------------------------------------------------------ */
describe('⭐ o organizador manda nas regras', () => {
  const g = (index, ranked) => ({ index, name: `Grupo ${String.fromCharCode(65 + index)}`, ranked });
  const ent = (id, rank, wins, played, pf, pa) => ({
    id, members: [id], label: id, rank,
    stats: { wins, played, points_for: pf, points_against: pa },
  });
  const chave = normalizePhase({ type: TOURNAMENT_STAGE_TYPE.KNOCKOUT });

  it('⭐ classificados POR GRUPO: 2 do grupo de 5, 1 do de 3', () => {
    const grupos = [
      g(0, [ent('a1', 1, 4, 4, 44, 20), ent('a2', 2, 3, 4, 40, 30), ent('a3', 3, 2, 4, 35, 35)]),
      g(1, [ent('b1', 1, 2, 2, 22, 10), ent('b2', 2, 1, 2, 15, 18)]),
    ];
    const fase = normalizePhase({
      type: TOURNAMENT_STAGE_TYPE.GROUPS,
      division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
      group_count: 2,
      qualifiers_per_group: 2,
      qualifiers_by_group: [2, 1],
    });
    const r = buildNextPhaseEntrants(grupos, fase, chave, { seed: 's' });
    expect(r.entrants.map((e) => e.id).sort()).toEqual(['a1', 'a2', 'b1']);
  });

  it('⭐ a repescagem respeita o corte DE CADA grupo', () => {
    const grupos = [
      g(0, [ent('a1', 1, 3, 3, 33, 15), ent('a2', 2, 2, 3, 30, 22), ent('a3', 3, 1, 3, 28, 25)]),
      g(1, [ent('b1', 1, 3, 3, 33, 12), ent('b2', 2, 2, 3, 20, 30)]),
    ];
    const fase = normalizePhase({
      type: TOURNAMENT_STAGE_TYPE.GROUPS,
      division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
      group_count: 2,
      qualifiers_per_group: 2,
      qualifiers_by_group: [2, 1],
      wildcard_slots: 1,
    });
    const r = buildNextPhaseEntrants(grupos, fase, chave, { seed: 's' });
    // No grupo A o corte é 2 (concorre o 3º = a3); no B é 1 (concorre b2).
    // b2 tem 2/3 e saldo −10/3; a3 tem 1/3 e +3/3 → b2 ganha pelo aproveitamento.
    expect(r.entrants.filter((e) => e._wildcard).map((e) => e.id)).toEqual(['b2']);
  });

  it('⭐ repescar de uma colocação FIXA, escolhida pelo organizador', () => {
    const grupos = [
      g(0, [ent('a1', 1, 3, 3, 33, 10), ent('a2', 2, 2, 3, 30, 20), ent('a3', 3, 1, 3, 20, 30), ent('a4', 4, 0, 3, 12, 33)]),
      g(1, [ent('b1', 1, 3, 3, 33, 10), ent('b2', 2, 2, 3, 30, 20), ent('b3', 3, 1, 3, 20, 30), ent('b4', 4, 0, 3, 18, 33)]),
    ];
    const fase = normalizePhase({
      type: TOURNAMENT_STAGE_TYPE.GROUPS,
      division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
      group_count: 2,
      qualifiers_per_group: 2,
      wildcard_slots: 1,
      wildcard_from_position: 4, // repescar entre os QUARTOS, não os terceiros
    });
    const r = buildNextPhaseEntrants(grupos, fase, chave, { seed: 's' });
    expect(r.entrants.filter((e) => e._wildcard).map((e) => e.id)).toEqual(['b4']);
  });

  it('⭐ comparação ABSOLUTA muda quem passa, como o organizador pediu', () => {
    // a3: 3 vitórias em 5. b3: 2 em 2. No percentual b3 ganha; no absoluto, a3.
    const grupos = [
      g(0, [ent('a1', 1, 5, 5, 55, 20), ent('a2', 2, 4, 5, 50, 30), ent('a3', 3, 3, 5, 50, 45)]),
      g(1, [ent('b1', 1, 2, 2, 22, 10), ent('b2', 2, 2, 2, 22, 12), ent('b3', 3, 2, 2, 22, 14)]),
    ];
    const base = {
      type: TOURNAMENT_STAGE_TYPE.GROUPS,
      division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
      group_count: 2,
      qualifiers_per_group: 2,
      wildcard_slots: 1,
    };
    const porTaxa = buildNextPhaseEntrants(grupos, normalizePhase(base), chave, { seed: 's' });
    expect(porTaxa.entrants.filter((e) => e._wildcard).map((e) => e.id)).toEqual(['b3']);

    const porAbsoluto = buildNextPhaseEntrants(
      grupos, normalizePhase({ ...base, cross_group_method: 'absolute' }), chave, { seed: 's' },
    );
    expect(porAbsoluto.entrants.filter((e) => e._wildcard).map((e) => e.id)).toEqual(['a3']);
  });

  it('⭐ quem entra DIRETO chega como cabeça, à frente de todos os classificados', () => {
    const grupos = [
      g(0, [ent('a1', 1, 3, 3, 33, 15), ent('a2', 2, 2, 3, 30, 22)]),
      g(1, [ent('b1', 1, 3, 3, 33, 12), ent('b2', 2, 2, 3, 31, 20)]),
    ];
    const fase = normalizePhase({
      type: TOURNAMENT_STAGE_TYPE.GROUPS,
      division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
      group_count: 2,
      qualifiers_per_group: 2,
    });
    const diretos = [{ id: 'camp', members: ['camp'], label: 'Campeão' }];
    const r = buildNextPhaseEntrants(grupos, fase, chave, { seed: 's', directEntrants: diretos });
    expect(r.entrants).toHaveLength(5);
    expect(r.bracketOrder[0].id).toBe('camp');
    expect(r.bracketOrder[0]._directEntry).toBe(true);
    expect(r.bracketOrder[0]._seedRank).toBe(0);
  });

  it('⭐ sem entrada direta, nada muda (campo aditivo)', () => {
    const grupos = [g(0, [ent('a1', 1, 3, 3, 33, 15), ent('a2', 2, 2, 3, 30, 22)])];
    const fase = normalizePhase({
      type: TOURNAMENT_STAGE_TYPE.GROUPS, qualifiers_per_group: 2,
    });
    const r = buildNextPhaseEntrants(grupos, fase, chave, { seed: 's' });
    expect(r.entrants).toHaveLength(2);
    expect(r.directEntrants).toEqual([]);
  });

  it('⭐ numa próxima fase de GRUPOS, os diretos são espalhados, não amontoados', () => {
    const grupos = [
      g(0, [ent('a1', 1, 3, 3, 33, 15), ent('a2', 2, 2, 3, 30, 22)]),
      g(1, [ent('b1', 1, 3, 3, 33, 12), ent('b2', 2, 2, 3, 31, 20)]),
    ];
    const fase = normalizePhase({
      type: TOURNAMENT_STAGE_TYPE.GROUPS,
      division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
      group_count: 2,
      qualifiers_per_group: 2,
      feed_mode: PHASE_FEED_MODE.INHERIT_GROUPS,
    });
    const proxima = normalizePhase({
      type: TOURNAMENT_STAGE_TYPE.GROUPS,
      division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
      group_count: 2,
      feed_mode: PHASE_FEED_MODE.INHERIT_GROUPS,
    });
    const diretos = [
      { id: 'd1', members: ['d1'], label: 'D1' },
      { id: 'd2', members: ['d2'], label: 'D2' },
    ];
    const r = buildNextPhaseEntrants(grupos, fase, proxima, { seed: 's', directEntrants: diretos });
    expect(r.groups).toHaveLength(2);
    expect(r.groups[0].entrants.some((e) => e.id === 'd1')).toBe(true);
    expect(r.groups[1].entrants.some((e) => e.id === 'd2')).toBe(true);
  });

  it('⭐ a ordem dos critérios da fase chega à classificação do grupo', () => {
    const entrants = [entrant('x'), entrant('y')];
    const jogos = [match('Grupo A', 'y', 'x', 'a')]; // y ganhou de x
    // x com saldo geral melhor (só este jogo existe, então o saldo é de y).
    const comConfronto = rankEntrantsInGroup(entrants, jogos, CFG, {
      tiebreakOrder: ['head_to_head', 'wins'],
    });
    expect(comConfronto[0].id).toBe('y');
  });
});
