import { describe, it, expect } from 'vitest';
import {
  TEAM_GENDER, TEAM_ETAPA_TYPE, TEAM_WIN_RULE, TEAM_SINGLES_MODE,
  normalizeTeamConfig, validateTeamRoster, validateConfrontationLineup,
  etapaWinner, etapaDecided, computeConfrontationResult,
  buildTeamStandings, buildTeamRanking, headToHeadWinner,
  buildConfrontationRankingMirror, etapaMirrorId,
  buildRosterSlots, assignMembersToSlots, membersFromSlots, rosterProgress,
  validateTeamAgainstExisting, uidsInOtherTeams, registrationIncludesUid,
  resolveEtapaScoring, computeEtapaResult, etapaScoreIssues, etapaLineupSlots,
  suggestSideLineup, buildEtapaDrafts, etapasToPayload,
  buildConfrontationStructure, buildTeamGroupTables, matchToConfrontation,
  isTeamConfrontation, confrontationLineupStatus, confrontationSnapshot,
} from './teamFormat.js';

const M = 'male';
const F = 'female';

// Config do exemplo do usuário: equipe de 4 (2M+2F), confronto de 5 etapas,
// melhor de 3 (dupla masc, dupla fem, mista 1, mista 2, simples).
function exampleConfig() {
  return normalizeTeamConfig({
    team_size: 4,
    gender: TEAM_GENDER.MIXED,
    win_rule: TEAM_WIN_RULE.BEST_OF,
    win_target: 3,
    singles_mode: TEAM_SINGLES_MODE.SINGLE,
    etapas: [
      { type: TEAM_ETAPA_TYPE.MENS_DOUBLES },
      { type: TEAM_ETAPA_TYPE.WOMENS_DOUBLES },
      { type: TEAM_ETAPA_TYPE.MIXED_DOUBLES },
      { type: TEAM_ETAPA_TYPE.MIXED_DOUBLES },
      { type: TEAM_ETAPA_TYPE.SINGLES },
    ],
  }).value;
}

describe('normalizeTeamConfig', () => {
  it('mista exige nº par e divide vagas igualmente', () => {
    const ok = normalizeTeamConfig({ team_size: 4, gender: TEAM_GENDER.MIXED, etapas: [{ type: 'singles' }] });
    expect(ok.valid).toBe(true);
    expect(ok.value.male_slots).toBe(2);
    expect(ok.value.female_slots).toBe(2);

    const odd = normalizeTeamConfig({ team_size: 3, gender: TEAM_GENDER.MIXED, etapas: [{ type: 'singles' }] });
    expect(odd.valid).toBe(false);
    expect(odd.errors.team_size).toBeTruthy();
  });

  it('masculina/feminina alocam todas as vagas no gênero', () => {
    const male = normalizeTeamConfig({ team_size: 3, gender: TEAM_GENDER.MALE, etapas: [{ type: 'mens_doubles' }] }).value;
    expect(male.male_slots).toBe(3);
    expect(male.female_slots).toBe(0);
  });

  it('rejeita etapa incompatível com o gênero da equipe', () => {
    const r = normalizeTeamConfig({ team_size: 2, gender: TEAM_GENDER.MALE, etapas: [{ type: 'womens_doubles' }] });
    expect(r.valid).toBe(false);
    expect(r.errors.etapas).toBeTruthy();
  });

  it('best_of default = maioria; all target = nº de etapas', () => {
    const bo = exampleConfig();
    expect(bo.win_rule).toBe('best_of');
    expect(bo.win_target).toBe(3);
    const all = normalizeTeamConfig({
      team_size: 4, gender: TEAM_GENDER.MIXED, win_rule: TEAM_WIN_RULE.ALL,
      etapas: [{ type: 'mens_doubles' }, { type: 'womens_doubles' }, { type: 'singles' }],
    }).value;
    expect(all.win_rule).toBe('all');
    expect(all.win_target).toBe(3);
  });

  it('exige ao menos uma etapa', () => {
    const r = normalizeTeamConfig({ team_size: 2, gender: TEAM_GENDER.MALE, etapas: [] });
    expect(r.valid).toBe(false);
    expect(r.errors.etapas).toBeTruthy();
  });
});

describe('validateTeamRoster', () => {
  const cfg = exampleConfig();
  it('aceita elenco com composição correta', () => {
    const members = [
      { user_id: 'a', gender: M }, { user_id: 'b', gender: M },
      { user_id: 'c', gender: F }, { user_id: 'd', gender: F },
    ];
    const r = validateTeamRoster(members, cfg);
    expect(r.valid).toBe(true);
    expect(r.males).toBe(2);
    expect(r.females).toBe(2);
  });

  it('rejeita composição de gênero errada e tamanho errado', () => {
    expect(validateTeamRoster([
      { user_id: 'a', gender: M }, { user_id: 'b', gender: M },
      { user_id: 'c', gender: M }, { user_id: 'd', gender: F },
    ], cfg).valid).toBe(false); // 3M/1F
    expect(validateTeamRoster([{ user_id: 'a', gender: M }], cfg).valid).toBe(false); // tamanho
  });

  it('rejeita atleta repetido no elenco', () => {
    const r = validateTeamRoster([
      { user_id: 'a', gender: M }, { user_id: 'a', gender: M },
      { user_id: 'c', gender: F }, { user_id: 'd', gender: F },
    ], cfg);
    expect(r.valid).toBe(false);
  });
});

describe('validateConfrontationLineup', () => {
  const cfg = exampleConfig();
  const rosterA = ['a1', 'a2', 'a3', 'a4'];
  const rosterB = ['b1', 'b2', 'b3', 'b4'];
  const genders = new Map([
    ['a1', M], ['a2', M], ['a3', F], ['a4', F],
    ['b1', M], ['b2', M], ['b3', F], ['b4', F],
  ]);
  const goodLineup = [
    { type: 'mens_doubles', side_a: ['a1', 'a2'], side_b: ['b1', 'b2'] },
    { type: 'womens_doubles', side_a: ['a3', 'a4'], side_b: ['b3', 'b4'] },
    { type: 'mixed_doubles', side_a: ['a1', 'a3'], side_b: ['b1', 'b3'] },
    { type: 'mixed_doubles', side_a: ['a2', 'a4'], side_b: ['b2', 'b4'] },
    { type: 'singles', side_a: ['a1'], side_b: ['b1'] },
  ];

  it('aceita escalação válida', () => {
    const r = validateConfrontationLineup(goodLineup, cfg, rosterA, rosterB, genders);
    expect(r.valid).toBe(true);
  });

  it('proíbe repetir jogador entre as duplas mistas do mesmo lado', () => {
    const bad = goodLineup.map((e) => ({ ...e }));
    // a1 usado nas duas mistas do lado A
    bad[3] = { type: 'mixed_doubles', side_a: ['a1', 'a4'], side_b: ['b2', 'b4'] };
    const r = validateConfrontationLineup(bad, cfg, rosterA, rosterB, genders);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/mistas do lado A/);
  });

  it('valida composição de gênero por etapa', () => {
    const bad = goodLineup.map((e) => ({ ...e }));
    bad[0] = { type: 'mens_doubles', side_a: ['a1', 'a3'], side_b: ['b1', 'b2'] }; // a3 é F
    const r = validateConfrontationLineup(bad, cfg, rosterA, rosterB, genders);
    expect(r.valid).toBe(false);
  });

  it('rejeita jogador fora do elenco', () => {
    const bad = goodLineup.map((e) => ({ ...e }));
    bad[4] = { type: 'singles', side_a: ['zz'], side_b: ['b1'] };
    const r = validateConfrontationLineup(bad, cfg, rosterA, rosterB, genders);
    expect(r.valid).toBe(false);
  });
});

describe('etapaWinner / etapaDecided / computeConfrontationResult', () => {
  const cfg = exampleConfig();
  it('etapaWinner segue o maior placar', () => {
    expect(etapaWinner({ score_a: 11, score_b: 7 })).toBe('a');
    expect(etapaWinner({ score_a: 9, score_b: 11 })).toBe('b');
    expect(etapaWinner({ score_a: 11, score_b: 11 })).toBeNull();
    expect(etapaDecided({ score_a: 11, score_b: null })).toBe(false);
  });

  it('best_of: primeira a 3 vence antes de jogar todas', () => {
    const conf = {
      team_a_id: 'A', team_b_id: 'B',
      etapas: [
        { type: 'mens_doubles', score_a: 11, score_b: 5 }, // A
        { type: 'womens_doubles', score_a: 7, score_b: 11 }, // B
        { type: 'mixed_doubles', score_a: 11, score_b: 9 }, // A
        { type: 'mixed_doubles', score_a: 11, score_b: 8 }, // A -> A chega a 3
        { type: 'singles', score_a: null, score_b: null }, // não jogada
      ],
    };
    const res = computeConfrontationResult(conf, cfg);
    expect(res.decided).toBe(true);
    expect(res.winner).toBe('a');
    expect(res.etapaWins).toEqual({ a: 3, b: 1 });
    expect(res.points.a).toBe(11 + 7 + 11 + 11); // soma dos placares lançados
  });

  it('best_of: ainda indeciso com 2×2', () => {
    const conf = {
      team_a_id: 'A', team_b_id: 'B',
      etapas: [
        { score_a: 11, score_b: 5 }, { score_a: 5, score_b: 11 },
        { score_a: 11, score_b: 9 }, { score_a: 9, score_b: 11 },
        { score_a: null, score_b: null },
      ],
    };
    const res = computeConfrontationResult(conf, cfg);
    expect(res.decided).toBe(false);
    expect(res.winner).toBeNull();
  });

  it('all: decide por maioria quando todas jogadas', () => {
    const allCfg = normalizeTeamConfig({
      team_size: 2, gender: TEAM_GENDER.MALE, win_rule: TEAM_WIN_RULE.ALL,
      etapas: [{ type: 'mens_doubles' }, { type: 'mens_doubles' }, { type: 'singles' }],
    }).value;
    const conf = { team_a_id: 'A', team_b_id: 'B', etapas: [
      { score_a: 11, score_b: 4 }, { score_a: 6, score_b: 11 }, { score_a: 11, score_b: 9 },
    ] };
    const res = computeConfrontationResult(conf, allCfg);
    expect(res.decided).toBe(true);
    expect(res.winner).toBe('a');
    expect(res.etapaWins).toEqual({ a: 2, b: 1 });
  });
});

describe('buildTeamStandings / rankTeamStandings', () => {
  const cfg = normalizeTeamConfig({
    team_size: 2, gender: TEAM_GENDER.MALE, win_rule: TEAM_WIN_RULE.BEST_OF, win_target: 2,
    etapas: [{ type: 'mens_doubles' }, { type: 'mens_doubles' }, { type: 'singles' }],
  }).value;

  it('conta 1 vitória por confronto, independentemente das etapas', () => {
    const confrontations = [
      // A vence B por 2x0 (confronto decidido, best of 2)
      { team_a_id: 'A', team_b_id: 'B', etapas: [{ score_a: 11, score_b: 1 }, { score_a: 11, score_b: 2 }] },
    ];
    const st = buildTeamStandings(confrontations, ['A', 'B'], cfg);
    const a = st.find((s) => s.team_id === 'A');
    expect(a.confrontation_wins).toBe(1);
    expect(a.etapa_wins).toBe(2);
    expect(a.etapa_losses).toBe(0);
  });

  it('desempate: 1º confrontos; 2º saldo de etapas; 3º saldo de pontos', () => {
    // A e B com 1 vitória de confronto cada; A tem melhor saldo de etapas.
    const confrontations = [
      { team_a_id: 'A', team_b_id: 'C', etapas: [{ score_a: 11, score_b: 0 }, { score_a: 11, score_b: 0 }] }, // A 2-0 (saldo +2)
      { team_a_id: 'B', team_b_id: 'C', etapas: [{ score_a: 11, score_b: 9 }, { score_a: 8, score_b: 11 }, { score_a: 11, score_b: 9 }] }, // B 2-1 (saldo +1)
    ];
    const ranked = buildTeamRanking(confrontations, ['A', 'B', 'C'], cfg);
    expect(ranked[0].team_id).toBe('A');
    expect(ranked[1].team_id).toBe('B');
    expect(ranked[2].team_id).toBe('C');
  });

  it('saldo de etapas: mais vitórias mesmo com 1 derrota supera invicto com menos vitórias', () => {
    // Y: 5V-1D (saldo +4); X: 3V-0D (saldo +3). Mesmas vitórias de confronto (1).
    // Pela regra "saldo simples", Y fica à frente de X.
    const bigCfg = normalizeTeamConfig({
      team_size: 2, gender: TEAM_GENDER.MALE, win_rule: TEAM_WIN_RULE.BEST_OF, win_target: 3,
      etapas: Array.from({ length: 6 }, () => ({ type: 'mens_doubles' })),
    }).value;
    const confrontations = [
      // X vence Z por 3-0 (saldo +3, 0 derrotas)
      { team_a_id: 'X', team_b_id: 'Z', etapas: [{ score_a: 11, score_b: 1 }, { score_a: 11, score_b: 2 }, { score_a: 11, score_b: 3 }] },
      // Y vence W por 5-1 (saldo +4, 1 derrota) — best_of 3 decide, mas todas lançadas contam etapas
      { team_a_id: 'Y', team_b_id: 'W', etapas: [
        { score_a: 11, score_b: 1 }, { score_a: 2, score_b: 11 }, { score_a: 11, score_b: 3 },
        { score_a: 11, score_b: 4 }, { score_a: 11, score_b: 5 }, { score_a: 11, score_b: 6 },
      ] },
    ];
    const ranked = buildTeamRanking(confrontations, ['X', 'Y', 'Z', 'W'], bigCfg);
    const x = ranked.find((r) => r.team_id === 'X');
    const y = ranked.find((r) => r.team_id === 'Y');
    expect(y.position).toBeLessThan(x.position); // Y (saldo +4) à frente de X (saldo +3)
  });

  it('buildConfrontationRankingMirror espelha etapas decididas com uids reais', () => {
    const etapas = [
      { id: 'e1', type: 'mens_doubles', side_a: ['u1', 'u2'], side_b: ['u3', 'u4'], score_a: 11, score_b: 7 }, // dupla
      { id: 'e2', type: 'singles', side_a: ['u1'], side_b: ['u3'], score_a: 9, score_b: 11 }, // simples
      { id: 'e3', type: 'mixed_doubles', side_a: ['u1', 'g0'], side_b: ['u3', 'u4'], score_a: 11, score_b: 5 }, // g0 é convidado (sem conta)
      { id: 'e4', type: 'singles', side_a: ['u2'], side_b: ['u4'], score_a: null, score_b: null }, // indecidida
    ];
    const validUids = ['u1', 'u2', 'u3', 'u4'];
    const { toWrite, toRemove } = buildConfrontationRankingMirror({
      matchId: 'm1', tournamentId: 't1', modalityId: 'mod1', eventTitle: 'Torneio X', etapas, validUids,
    });
    // e1 (doubles) e e2 (singles) espelhadas; e3 (convidado) e e4 (indecidida) não.
    expect(toWrite.map((w) => w.id)).toEqual([etapaMirrorId('m1', 'e1'), etapaMirrorId('m1', 'e2')]);
    expect(toWrite[0].payload.kind).toBe('doubles');
    expect(toWrite[0].payload.side_a_ids).toEqual(['u1', 'u2']);
    expect(toWrite[0].payload.winner_side).toBe('a');
    expect(toWrite[1].payload.kind).toBe('singles');
    expect(toWrite[1].payload.winner_side).toBe('b');
    // e3 e e4 vão para remoção (idempotência).
    expect(toRemove).toEqual([etapaMirrorId('m1', 'e3'), etapaMirrorId('m1', 'e4')]);
  });

  it('simples com responsável único (single_player) é espelhado', () => {
    const config = normalizeTeamConfig({
      team_size: 2, gender: TEAM_GENDER.MALE, singles_mode: TEAM_SINGLES_MODE.SINGLE,
      etapas: [{ type: TEAM_ETAPA_TYPE.SINGLES }],
    }).value;
    const etapas = [
      { id: 's1', type: TEAM_ETAPA_TYPE.SINGLES, side_a: ['u1'], side_b: ['u3'], score_a: 11, score_b: 6 },
    ];
    const { toWrite, toRemove } = buildConfrontationRankingMirror({
      matchId: 'm1', tournamentId: 't1', modalityId: 'mod1', etapas, validUids: ['u1', 'u3'], config,
    });
    expect(toWrite).toHaveLength(1);
    expect(toWrite[0].payload.kind).toBe('singles');
    expect(toRemove).toEqual([]);
  });

  it('simples em rodízio por pontos (rotating_points) NÃO é espelhado — nem com lados de 1', () => {
    const config = normalizeTeamConfig({
      team_size: 2, gender: TEAM_GENDER.MALE, singles_mode: TEAM_SINGLES_MODE.ROTATING,
      etapas: [{ type: TEAM_ETAPA_TYPE.SINGLES }],
    }).value;
    // Mesmo que a etapa de simples tenha chegado com apenas 1 jogador por lado
    // (elenco pequeno), o rodízio exclui o simples do ranking individual.
    const etapas = [
      { id: 's1', type: TEAM_ETAPA_TYPE.SINGLES, side_a: ['u1'], side_b: ['u3'], score_a: 11, score_b: 6 },
    ];
    const { toWrite, toRemove } = buildConfrontationRankingMirror({
      matchId: 'm1', tournamentId: 't1', modalityId: 'mod1', etapas, validUids: ['u1', 'u3'], config,
    });
    expect(toWrite).toEqual([]);
    expect(toRemove).toEqual([etapaMirrorId('m1', 's1')]);
  });

  it('no rodízio, as DUPLAS seguem espelhadas — só o simples é excluído', () => {
    const config = normalizeTeamConfig({
      team_size: 2, gender: TEAM_GENDER.MALE, singles_mode: TEAM_SINGLES_MODE.ROTATING,
      etapas: [{ type: TEAM_ETAPA_TYPE.MENS_DOUBLES }, { type: TEAM_ETAPA_TYPE.SINGLES }],
    }).value;
    const etapas = [
      { id: 'd1', type: TEAM_ETAPA_TYPE.MENS_DOUBLES, side_a: ['u1', 'u2'], side_b: ['u3', 'u4'], score_a: 11, score_b: 8 },
      { id: 's1', type: TEAM_ETAPA_TYPE.SINGLES, side_a: ['u1', 'u2'], side_b: ['u3', 'u4'], score_a: 11, score_b: 6 },
    ];
    const { toWrite, toRemove } = buildConfrontationRankingMirror({
      matchId: 'm1', tournamentId: 't1', modalityId: 'mod1', etapas, validUids: ['u1', 'u2', 'u3', 'u4'], config,
    });
    expect(toWrite.map((w) => w.id)).toEqual([etapaMirrorId('m1', 'd1')]);
    expect(toWrite[0].payload.kind).toBe('doubles');
    expect(toRemove).toEqual([etapaMirrorId('m1', 's1')]);
  });

  it('confronto direto desempata quando tudo o mais é igual', () => {
    // Dois times idênticos nos números, mas um venceu o confronto direto.
    const confrontations = [
      { team_a_id: 'A', team_b_id: 'B', etapas: [{ score_a: 11, score_b: 9 }, { score_a: 11, score_b: 9 }] }, // A venceu B
      // Ambos vencem C com o mesmo placar para igualar os números:
      { team_a_id: 'A', team_b_id: 'C', etapas: [{ score_a: 11, score_b: 9 }, { score_a: 9, score_b: 11 }, { score_a: 11, score_b: 9 }] },
      { team_a_id: 'B', team_b_id: 'C', etapas: [{ score_a: 11, score_b: 9 }, { score_a: 9, score_b: 11 }, { score_a: 11, score_b: 9 }] },
    ];
    const h2h = headToHeadWinner(confrontations, 'A', 'B', cfg);
    expect(h2h).toBe('A');
  });
});

describe('buildRosterSlots', () => {
  it('equipe mista: vagas masculinas e femininas conforme a modalidade', () => {
    const slots = buildRosterSlots(exampleConfig());
    expect(slots).toHaveLength(4);
    expect(slots.map((s) => s.gender)).toEqual([M, M, F, F]);
    expect(slots.map((s) => s.label)).toEqual([
      'Atleta masculino 1', 'Atleta masculino 2', 'Atleta feminina 1', 'Atleta feminina 2',
    ]);
  });

  it('equipe de gênero único: todas as vagas do mesmo gênero, sem rótulo de gênero', () => {
    const cfg = normalizeTeamConfig({
      team_size: 3, gender: TEAM_GENDER.MALE, etapas: [{ type: TEAM_ETAPA_TYPE.MENS_DOUBLES }],
    }).value;
    const slots = buildRosterSlots(cfg);
    expect(slots).toHaveLength(3);
    expect(slots.every((s) => s.gender === M)).toBe(true);
    expect(slots[2].label).toBe('Atleta 3');
  });

  it('sem configuração não gera vagas', () => {
    expect(buildRosterSlots({})).toEqual([]);
  });
});

describe('assignMembersToSlots', () => {
  it('coloca cada atleta na vaga do seu gênero, mesmo fora de ordem', () => {
    const cfg = exampleConfig();
    const members = [
      { user_id: 'f1', name: 'Ana', gender: F },
      { user_id: 'm1', name: 'Bruno', gender: M },
      { user_id: 'f2', name: 'Carla', gender: F },
      { user_id: 'm2', name: 'Diego', gender: M },
    ];
    const { filled, extras } = assignMembersToSlots(members, cfg);
    expect(filled.map((m) => m?.name)).toEqual(['Bruno', 'Diego', 'Ana', 'Carla']);
    expect(extras).toEqual([]);
  });

  it('devolve em extras quem não cabe na composição atual', () => {
    const cfg = exampleConfig(); // 2M + 2F
    const members = [
      { user_id: 'm1', name: 'Bruno', gender: M },
      { user_id: 'm2', name: 'Diego', gender: M },
      { user_id: 'm3', name: 'Elias', gender: M },
    ];
    const { filled, extras } = assignMembersToSlots(members, cfg);
    // O terceiro homem não ocupa vaga feminina — sobra para o usuário decidir.
    expect(filled.map((m) => m?.name ?? null)).toEqual(['Bruno', 'Diego', null, null]);
    expect(extras.map((m) => m.name)).toEqual(['Elias']);
  });

  it('atleta sem gênero declarado ocupa a primeira vaga livre', () => {
    const cfg = exampleConfig();
    const { filled } = assignMembersToSlots([{ name: 'Sem gênero' }], cfg);
    expect(filled[0]).toMatchObject({ name: 'Sem gênero', gender: M });
  });

  it('elenco vazio devolve todas as vagas livres', () => {
    expect(assignMembersToSlots([], exampleConfig()).filled).toEqual([null, null, null, null]);
  });
});

describe('membersFromSlots', () => {
  it('grava o gênero da vaga e descarta vagas vazias', () => {
    const cfg = exampleConfig();
    const values = [
      { user_id: 'm1', name: ' Bruno ', gender: F, photo_url: 'p.jpg', level: '3.0' },
      null,
      { user_id: null, name: 'Ana' },
      { name: '   ' },
    ];
    expect(membersFromSlots(values, cfg)).toEqual([
      { user_id: 'm1', name: 'Bruno', gender: M, photo_url: 'p.jpg', level: '3.0' },
      { user_id: null, name: 'Ana', gender: F, photo_url: null, level: null },
    ]);
  });

  it('o elenco completo passa na validação da modalidade', () => {
    const cfg = exampleConfig();
    const values = [
      { user_id: 'm1', name: 'Bruno' }, { user_id: 'm2', name: 'Diego' },
      { user_id: 'f1', name: 'Ana' }, { user_id: 'f2', name: 'Carla' },
    ];
    expect(validateTeamRoster(membersFromSlots(values, cfg), cfg).valid).toBe(true);
  });
});

describe('rosterProgress', () => {
  it('conta o que falta por gênero', () => {
    const cfg = exampleConfig();
    const p = rosterProgress([{ name: 'Bruno' }, null, { name: 'Ana' }, null], cfg);
    expect(p).toMatchObject({
      required: 4, filled: 2, missing: 2, missingMale: 1, missingFemale: 1, complete: false,
    });
  });

  it('completo quando todas as vagas têm nome', () => {
    const cfg = exampleConfig();
    const p = rosterProgress([{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }], cfg);
    expect(p.complete).toBe(true);
    expect(p.missing).toBe(0);
  });
});

describe('validateTeamAgainstExisting', () => {
  const existing = [
    { id: 't1', team_name: 'Águia Dourada', member_uids: ['u1', 'u2'] },
    { id: 't2', team_name: 'Furacão', members: [{ user_id: 'u3' }] },
  ];

  it('recusa nome repetido (ignorando acento e caixa)', () => {
    const r = validateTeamAgainstExisting({ teamName: 'aguia dourada', members: [], existingTeams: existing });
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/mesmo nome|esse nome/i);
  });

  it('recusa atleta que já está em outra equipe', () => {
    const r = validateTeamAgainstExisting({
      teamName: 'Nova', members: [{ user_id: 'u3', name: 'Carla' }], existingTeams: existing,
    });
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toContain('Carla');
    expect(r.errors[0]).toContain('Furacão');
  });

  it('na edição, a própria equipe não conflita consigo mesma', () => {
    const r = validateTeamAgainstExisting({
      teamName: 'Águia Dourada',
      members: [{ user_id: 'u1', name: 'Bruno' }],
      existingTeams: existing,
      currentTeamId: 't1',
    });
    expect(r.valid).toBe(true);
  });

  it('convidados sem conta nunca conflitam', () => {
    const r = validateTeamAgainstExisting({
      teamName: 'Nova', members: [{ user_id: null, name: 'Visitante' }], existingTeams: existing,
    });
    expect(r.valid).toBe(true);
  });
});

describe('uidsInOtherTeams', () => {
  it('junta os uids das demais equipes (por member_uids ou members)', () => {
    const teams = [
      { id: 't1', member_uids: ['u1', 'u2'] },
      { id: 't2', members: [{ user_id: 'u3' }, { user_id: null }] },
    ];
    expect(uidsInOtherTeams(teams).sort()).toEqual(['u1', 'u2', 'u3']);
    expect(uidsInOtherTeams(teams, 't1')).toEqual(['u3']);
  });
});

describe('registrationIncludesUid', () => {
  it('reconhece individual, dupla e elenco de equipe', () => {
    expect(registrationIncludesUid({ user_id: 'u1' }, 'u1')).toBe(true);
    expect(registrationIncludesUid({ player_b_user_id: 'u2' }, 'u2')).toBe(true);
    expect(registrationIncludesUid({ member_uids: ['u3', 'u4'] }, 'u4')).toBe(true);
    expect(registrationIncludesUid({ members: [{ user_id: 'u5' }] }, 'u5')).toBe(true);
  });

  it('falso sem uid, sem inscrição ou quando não participa', () => {
    expect(registrationIncludesUid(null, 'u1')).toBe(false);
    expect(registrationIncludesUid({ user_id: 'u1' }, null)).toBe(false);
    expect(registrationIncludesUid({ member_uids: ['u1'] }, 'u9')).toBe(false);
  });
});

/* ------------------ placar por etapa: games (sets) ou único ---------------- */

describe('resolveEtapaScoring', () => {
  it('usa o padrão da modalidade e aceita override por etapa', () => {
    const cfg = normalizeTeamConfig({
      team_size: 4, gender: TEAM_GENDER.MIXED, sets_per_etapa: 3, target_score: 15,
      etapas: [
        { type: TEAM_ETAPA_TYPE.MENS_DOUBLES },
        { type: TEAM_ETAPA_TYPE.SINGLES, sets_per_match: 1, target_score: 21 },
      ],
    }).value;
    expect(resolveEtapaScoring(cfg, cfg.etapas[0])).toMatchObject({ sets_per_match: 3, target_score: 15 });
    expect(resolveEtapaScoring(cfg, cfg.etapas[1])).toMatchObject({ sets_per_match: 1, target_score: 21 });
    // Por id e por índice também resolvem.
    expect(resolveEtapaScoring(cfg, 'etapa_2').sets_per_match).toBe(1);
    expect(resolveEtapaScoring(cfg, 0).sets_per_match).toBe(3);
  });

  it('valores inválidos caem no padrão da plataforma (11 pontos, game único)', () => {
    const cfg = normalizeTeamConfig({
      team_size: 2, gender: TEAM_GENDER.MALE, sets_per_etapa: 4, target_score: 13,
      etapas: [{ type: TEAM_ETAPA_TYPE.MENS_DOUBLES }],
    }).value;
    expect(cfg.sets_per_etapa).toBe(1);
    expect(cfg.target_score).toBe(11);
    expect(resolveEtapaScoring(cfg, cfg.etapas[0])).toMatchObject({ sets_per_match: 1, target_score: 11 });
  });
});

describe('computeEtapaResult', () => {
  const single = normalizeTeamConfig({
    team_size: 2, gender: TEAM_GENDER.MALE, etapas: [{ type: TEAM_ETAPA_TYPE.MENS_DOUBLES }],
  }).value;
  const bestOf3 = normalizeTeamConfig({
    team_size: 2, gender: TEAM_GENDER.MALE, sets_per_etapa: 3,
    etapas: [{ type: TEAM_ETAPA_TYPE.MENS_DOUBLES }],
  }).value;

  it('game único: vence quem fez mais pontos', () => {
    const r = computeEtapaResult({ id: 'etapa_1', games: [{ a: 11, b: 7 }] }, single);
    expect(r).toMatchObject({ winner: 'a', decided: true, sets_a: 1, sets_b: 0, points_a: 11, points_b: 7 });
  });

  it('melhor de 3: decide em 2 games e soma os pontos de todos', () => {
    const parcial = computeEtapaResult({ id: 'etapa_1', games: [{ a: 11, b: 7 }] }, bestOf3);
    expect(parcial.decided).toBe(false);
    const r = computeEtapaResult({ id: 'etapa_1', games: [{ a: 11, b: 7 }, { a: 5, b: 11 }, { a: 11, b: 9 }] }, bestOf3);
    expect(r).toMatchObject({ winner: 'a', decided: true, sets_a: 2, sets_b: 1 });
    expect(r.points_a).toBe(27);
    expect(r.points_b).toBe(27);
  });

  it('games em branco não contam', () => {
    const r = computeEtapaResult({ id: 'etapa_1', games: [{ a: 11, b: 7 }, { a: '', b: '' }] }, bestOf3);
    expect(r.games).toHaveLength(1);
    expect(r.decided).toBe(false);
  });

  it('lê o formato antigo (score_a/score_b) como um game só', () => {
    const r = computeEtapaResult({ id: 'etapa_1', score_a: 11, score_b: 9 }, single);
    expect(r).toMatchObject({ winner: 'a', decided: true, points_a: 11, points_b: 9 });
  });
});

describe('etapaScoreIssues', () => {
  const cfg = normalizeTeamConfig({
    team_size: 2, gender: TEAM_GENDER.MALE, target_score: 11,
    etapas: [{ type: TEAM_ETAPA_TYPE.MENS_DOUBLES }],
  }).value;

  it('aponta game abaixo do alvo e sem vantagem de 2', () => {
    expect(etapaScoreIssues({ id: 'etapa_1', games: [{ a: 9, b: 7 }] }, cfg)[0]).toMatch(/11 pontos/);
    expect(etapaScoreIssues({ id: 'etapa_1', games: [{ a: 11, b: 10 }] }, cfg)[0]).toMatch(/2 pontos/);
    expect(etapaScoreIssues({ id: 'etapa_1', games: [{ a: 11, b: 9 }] }, cfg)).toEqual([]);
  });
});

describe('computeConfrontationResult com games', () => {
  it('conta etapas por sets e soma os pontos de todos os games', () => {
    const cfg = normalizeTeamConfig({
      team_size: 4, gender: TEAM_GENDER.MIXED, sets_per_etapa: 3,
      win_rule: TEAM_WIN_RULE.ALL,
      etapas: [{ type: TEAM_ETAPA_TYPE.MENS_DOUBLES }, { type: TEAM_ETAPA_TYPE.WOMENS_DOUBLES }],
    }).value;
    const res = computeConfrontationResult({
      etapas: [
        { id: 'etapa_1', games: [{ a: 11, b: 5 }, { a: 11, b: 8 }] },
        { id: 'etapa_2', games: [{ a: 6, b: 11 }, { a: 9, b: 11 }] },
      ],
    }, cfg);
    expect(res.etapaWins).toEqual({ a: 1, b: 1 });
    expect(res.sets).toEqual({ a: 2, b: 2 });
    expect(res.points).toEqual({ a: 37, b: 35 });
    expect(res.decided).toBe(true);
    expect(res.winner).toBeNull(); // 1–1 em etapas
  });
});

/* -------------------------- escalação do confronto ------------------------ */

describe('etapaLineupSlots', () => {
  const cfg = exampleConfig();

  it('dupla mista tem uma vaga masculina e uma feminina, nessa ordem', () => {
    const slots = etapaLineupSlots({ type: TEAM_ETAPA_TYPE.MIXED_DOUBLES }, cfg);
    expect(slots.map((s) => s.gender)).toEqual([M, F]);
  });

  it('duplas masculina e feminina têm duas vagas do mesmo gênero', () => {
    expect(etapaLineupSlots({ type: TEAM_ETAPA_TYPE.MENS_DOUBLES }, cfg).map((s) => s.gender)).toEqual([M, M]);
    expect(etapaLineupSlots({ type: TEAM_ETAPA_TYPE.WOMENS_DOUBLES }, cfg).map((s) => s.gender)).toEqual([F, F]);
  });

  it('simples: 1 vaga livre; no rodízio, uma vaga por atleta na ordem de entrada', () => {
    expect(etapaLineupSlots({ type: TEAM_ETAPA_TYPE.SINGLES }, cfg)).toHaveLength(1);
    const rot = { ...cfg, singles_mode: TEAM_SINGLES_MODE.ROTATING };
    const slots = etapaLineupSlots({ type: TEAM_ETAPA_TYPE.SINGLES }, rot, 4);
    expect(slots).toHaveLength(4);
    expect(slots[0].label).toBe('1º a jogar');
    expect(slots[3].label).toBe('4º a jogar');
  });
});

describe('suggestSideLineup', () => {
  const roster = [
    { id: 'm1', gender: M }, { id: 'm2', gender: M },
    { id: 'f1', gender: F }, { id: 'f2', gender: F },
  ];

  it('monta uma escalação válida para todas as etapas do exemplo', () => {
    const cfg = exampleConfig(); // masc, fem, mista, mista, simples
    const lineup = suggestSideLineup(cfg, roster);
    expect(lineup[0]).toEqual(['m1', 'm2']);
    expect(lineup[1]).toEqual(['f1', 'f2']);
    // Mistas não repetem jogador entre si (do mesmo lado).
    const mistas = [...lineup[2], ...lineup[3]];
    expect(new Set(mistas).size).toBe(mistas.length);
    expect(lineup[4]).toHaveLength(1);
  });

  it('a escalação sugerida passa na validação de escalação', () => {
    const cfg = exampleConfig();
    const lineup = suggestSideLineup(cfg, roster);
    const etapas = cfg.etapas.map((spec, i) => ({
      type: spec.type, side_a: lineup[i], side_b: lineup[i],
    }));
    const genderById = new Map(roster.map((p) => [p.id, p.gender]));
    const ids = roster.map((p) => p.id);
    const v = validateConfrontationLineup(etapas, cfg, ids, ids, genderById);
    expect(v.valid).toBe(true);
  });

  it('no rodízio do simples, a ordem é o elenco inteiro', () => {
    const cfg = { ...exampleConfig(), singles_mode: TEAM_SINGLES_MODE.ROTATING };
    const lineup = suggestSideLineup(cfg, roster);
    expect(lineup[4]).toEqual(['m1', 'm2', 'f1', 'f2']);
  });
});

describe('buildEtapaDrafts / etapasToPayload', () => {
  const cfg = normalizeTeamConfig({
    team_size: 2, gender: TEAM_GENDER.MALE, sets_per_etapa: 3,
    etapas: [{ type: TEAM_ETAPA_TYPE.MENS_DOUBLES }, { type: TEAM_ETAPA_TYPE.SINGLES, sets_per_match: 1 }],
  }).value;

  it('cria um rascunho por etapa com o nº de games da regra dela', () => {
    const drafts = buildEtapaDrafts(cfg);
    expect(drafts).toHaveLength(2);
    expect(drafts[0].games).toHaveLength(3);
    expect(drafts[1].games).toHaveLength(1);
    expect(drafts[0].scoring).toMatchObject({ sets_per_match: 3, target_score: 11 });
  });

  it('reaproveita escalação e placares já salvos', () => {
    const match = {
      etapas: [{ id: 'etapa_1', side_a: ['x'], side_b: ['y'], games: [{ a: 11, b: 5 }] }],
    };
    const drafts = buildEtapaDrafts(cfg, match);
    expect(drafts[0].side_a).toEqual(['x']);
    expect(drafts[0].games[0]).toEqual({ a: 11, b: 5 });
    expect(drafts[0].games[1]).toEqual({ a: '', b: '' });
  });

  it('o payload descarta games em branco e agrega pontos/sets/vencedor', () => {
    const drafts = buildEtapaDrafts(cfg);
    drafts[0].games = [{ a: 11, b: 5 }, { a: 11, b: 7 }, { a: '', b: '' }];
    drafts[0].side_a = ['m1', 'm2'];
    const payload = etapasToPayload(drafts, cfg);
    expect(payload[0]).toMatchObject({
      id: 'etapa_1', sets_a: 2, sets_b: 0, score_a: 22, score_b: 12, winner_side: 'a',
    });
    expect(payload[0].games).toEqual([{ a: 11, b: 5 }, { a: 11, b: 7 }]);
    expect(payload[1]).toMatchObject({ score_a: null, score_b: null, winner_side: null });
  });
});

/* ------------------ estrutura: grupos, rodadas e tabelas ------------------ */

describe('buildConfrontationStructure', () => {
  it('separa por fase e por grupo quando há grupos', () => {
    const matches = [
      { id: '1', stage_index: 0, stage_type: 'groups', group: 'Grupo A', round: 1, position: 1, side_a_ids: ['t1'], side_b_ids: ['t2'] },
      { id: '2', stage_index: 0, stage_type: 'groups', group: 'Grupo B', round: 1, position: 1, side_a_ids: ['t3'], side_b_ids: ['t4'] },
      { id: '3', stage_index: 1, stage_type: 'knockout', round: 1, position: 1, side_a_ids: ['t1'], side_b_ids: ['t3'] },
    ];
    const struct = buildConfrontationStructure(matches);
    expect(struct).toHaveLength(2);
    expect(struct[0].sections.map((s) => s.name)).toEqual(['Grupo A', 'Grupo B']);
    expect(struct[0].isBracket).toBe(false);
    expect(struct[1].isBracket).toBe(true);
    expect(struct[1].sections[0].name).toBe('Final');
  });

  it('em chave, nomeia as rodadas finais de trás para frente', () => {
    const mk = (round, position) => ({
      id: `${round}-${position}`, stage_index: 0, stage_type: 'knockout', round, position,
      side_a_ids: ['a'], side_b_ids: ['b'],
    });
    const struct = buildConfrontationStructure([mk(1, 1), mk(1, 2), mk(2, 1)]);
    expect(struct[0].sections.map((s) => s.name)).toEqual(['Semifinais', 'Final']);
  });

  it('sem grupo e sem chave, usa "Rodada N"', () => {
    const matches = [
      { id: '1', stage_index: 0, stage_type: 'round_robin', round: 1, position: 1, side_a_ids: ['a'], side_b_ids: ['b'] },
      { id: '2', stage_index: 0, stage_type: 'round_robin', round: 2, position: 1, side_a_ids: ['a'], side_b_ids: ['c'] },
    ];
    const struct = buildConfrontationStructure(matches);
    expect(struct[0].sections.map((s) => s.name)).toEqual(['Rodada 1', 'Rodada 2']);
  });
});

describe('buildTeamGroupTables', () => {
  const cfg = normalizeTeamConfig({
    team_size: 2, gender: TEAM_GENDER.MALE, win_rule: TEAM_WIN_RULE.ALL,
    etapas: [{ type: TEAM_ETAPA_TYPE.MENS_DOUBLES }],
  }).value;
  const teams = [
    { id: 't1', team_name: 'Alfa' }, { id: 't2', team_name: 'Beta' },
    { id: 't3', team_name: 'Gama' }, { id: 't4', team_name: 'Delta' },
  ];
  const win = (a, b, group) => ({
    id: `${a}${b}`, group, side_a_ids: [a], side_b_ids: [b],
    etapas: [{ id: 'etapa_1', games: [{ a: 11, b: 4 }] }],
  });

  it('uma tabela por grupo, com o nome da equipe e a posição', () => {
    const tables = buildTeamGroupTables({
      matches: [win('t1', 't2', 'Grupo A'), win('t3', 't4', 'Grupo B')],
      teamRegistrations: teams,
      config: cfg,
    });
    expect(tables.map((t) => t.name)).toEqual(['Grupo A', 'Grupo B']);
    expect(tables[0].rows[0]).toMatchObject({ position: 1, team_name: 'Alfa', confrontation_wins: 1 });
    expect(tables[0].rows[1]).toMatchObject({ position: 2, team_name: 'Beta', confrontation_losses: 1 });
    expect(tables[1].rows.map((r) => r.team_name)).toEqual(['Gama', 'Delta']);
  });

  it('sem grupos, devolve uma tabela única (grupo único / pontos corridos)', () => {
    const tables = buildTeamGroupTables({
      matches: [win('t1', 't2', null), win('t1', 't3', null)],
      teamRegistrations: teams,
      config: cfg,
    });
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBeNull();
    expect(tables[0].rows[0]).toMatchObject({ team_name: 'Alfa', confrontation_wins: 2 });
  });

  it('singleGroup=true funde uma tabela só, ainda que os jogos tragam m.group', () => {
    const tables = buildTeamGroupTables({
      matches: [win('t1', 't2', 'Grupo A'), win('t3', 't4', 'Grupo B'), win('t1', 't3', 'Grupo A')],
      teamRegistrations: teams,
      config: cfg,
      singleGroup: true,
    });
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBeNull();
    // Todas as equipes numa única classificação; t1 (2 vitórias) na frente.
    expect(tables[0].rows.map((r) => r.team_name)).toContain('Gama');
    expect(tables[0].rows[0]).toMatchObject({ team_name: 'Alfa', confrontation_wins: 2 });
  });
});

describe('matchToConfrontation / isTeamConfrontation', () => {
  it('reconhece um jogo com os dois lados e extrai as equipes', () => {
    const m = { id: 'm1', side_a_ids: ['t1'], side_b_ids: ['t2'], etapas: [{ id: 'e' }] };
    expect(isTeamConfrontation(m)).toBe(true);
    expect(matchToConfrontation(m)).toMatchObject({ match_id: 'm1', team_a_id: 't1', team_b_id: 't2' });
  });

  it('bye (um lado só) não é confronto', () => {
    expect(isTeamConfrontation({ side_a_ids: ['t1'], side_b_ids: [] })).toBe(false);
  });
});

describe('validateConfrontationLineup — lançamento parcial', () => {
  const cfg = exampleConfig();
  const rosterA = ['a1', 'a2', 'a3', 'a4'];
  const rosterB = ['b1', 'b2', 'b3', 'b4'];
  const genders = new Map([
    ['a1', M], ['a2', M], ['a3', F], ['a4', F],
    ['b1', M], ['b2', M], ['b3', F], ['b4', F],
  ]);

  it('etapa ainda intocada (sem escalação e sem placar) não é erro', () => {
    const parcial = [
      { id: 'etapa_1', type: 'mens_doubles', side_a: ['a1', 'a2'], side_b: ['b1', 'b2'], games: [{ a: 11, b: 5 }] },
      { id: 'etapa_2', type: 'womens_doubles', side_a: [], side_b: [], games: [] },
    ];
    expect(validateConfrontationLineup(parcial, cfg, rosterA, rosterB, genders).valid).toBe(true);
  });

  it('mas etapa com placar e sem escalação continua sendo apontada', () => {
    const bad = [
      { id: 'etapa_1', type: 'mens_doubles', side_a: [], side_b: [], games: [{ a: 11, b: 5 }] },
    ];
    const r = validateConfrontationLineup(bad, cfg, rosterA, rosterB, genders);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/precisa de 2 jogador/);
  });

  it('rodízio do simples exige ordem com ao menos 2 atletas', () => {
    const rot = { ...cfg, singles_mode: TEAM_SINGLES_MODE.ROTATING };
    const bad = [{ id: 'e', type: 'singles', side_a: ['a1'], side_b: ['b1'] }];
    const r = validateConfrontationLineup(bad, rot, rosterA, rosterB, genders);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/rodízio/);
    const ok = [{ id: 'e', type: 'singles', side_a: ['a1', 'a2'], side_b: ['b1', 'b2'] }];
    expect(validateConfrontationLineup(ok, rot, rosterA, rosterB, genders).valid).toBe(true);
  });
});

describe('buildConfrontationStructure — chave vs pontos corridos', () => {
  const mk = (stageType, round, position) => ({
    id: `${stageType}-${round}-${position}`, stage_index: 0, stage_type: stageType,
    round, position, side_a_ids: ['a'], side_b_ids: ['b'],
  });

  it('pontos corridos tem rodadas, mas NÃO é chave (classifica por tabela)', () => {
    const struct = buildConfrontationStructure([mk('round_robin', 1, 1), mk('round_robin', 2, 1)]);
    expect(struct[0].isBracket).toBe(false);
  });

  it('mata-mata e dupla eliminação são chave', () => {
    expect(buildConfrontationStructure([mk('knockout', 1, 1)])[0].isBracket).toBe(true);
    expect(buildConfrontationStructure([mk('double_knockout', 1, 1)])[0].isBracket).toBe(true);
  });

  it('fase de grupos não é chave', () => {
    const m = { ...mk('groups', 1, 1), group: 'Grupo A' };
    expect(buildConfrontationStructure([m])[0].isBracket).toBe(false);
  });
});

describe('confrontationLineupStatus / confrontationSnapshot', () => {
  const cfg = normalizeTeamConfig({
    team_size: 2, gender: TEAM_GENDER.MALE, win_rule: TEAM_WIN_RULE.ALL,
    etapas: [{ type: TEAM_ETAPA_TYPE.MENS_DOUBLES }, { type: TEAM_ETAPA_TYPE.SINGLES }],
  }).value;

  const escalada = (games = []) => ({
    etapas: [
      { id: 'etapa_1', side_a: ['a1', 'a2'], side_b: ['b1', 'b2'], games: games[0] || [] },
      { id: 'etapa_2', side_a: ['a1'], side_b: ['b1'], games: games[1] || [] },
    ],
  });

  it('confronto sem etapas: nada escalado', () => {
    const st = confrontationLineupStatus({ etapas: [] }, cfg);
    expect(st).toMatchObject({ total: 2, escaladas: 0, pendentes: 2, completa: false, iniciada: false });
    expect(confrontationSnapshot({ etapas: [] }, cfg)).toMatchObject({
      stage: 'pendente', label: 'Aguardando escalação',
    });
  });

  it('escalação parcial conta o que falta', () => {
    const match = { etapas: [{ id: 'etapa_1', side_a: ['a1', 'a2'], side_b: ['b1', 'b2'] }] };
    const st = confrontationLineupStatus(match, cfg);
    expect(st).toMatchObject({ escaladas: 1, pendentes: 1, completa: false, iniciada: true });
  });

  it('escalação completa sem placar: partida iniciada', () => {
    expect(confrontationSnapshot(escalada(), cfg)).toMatchObject({ stage: 'escalado' });
    expect(confrontationLineupStatus(escalada(), cfg).completa).toBe(true);
  });

  it('uma etapa decidida: em andamento; todas: encerrado', () => {
    const parcial = escalada([[{ a: 11, b: 5 }]]);
    expect(confrontationSnapshot(parcial, cfg)).toMatchObject({ stage: 'em_andamento' });
    expect(confrontationSnapshot(parcial, cfg).label).toContain('1/2');

    const total = escalada([[{ a: 11, b: 5 }], [{ a: 11, b: 7 }]]);
    const snap = confrontationSnapshot(total, cfg);
    expect(snap.stage).toBe('encerrado');
    expect(snap.result.winner).toBe('a');
  });

  it('empate em etapas aparece no rótulo', () => {
    const empate = escalada([[{ a: 11, b: 5 }], [{ a: 6, b: 11 }]]);
    const snap = confrontationSnapshot(empate, cfg);
    expect(snap.stage).toBe('encerrado');
    expect(snap.label).toContain('empate');
  });

  it('no simples em rodízio, a ordem completa depende do tamanho do elenco', () => {
    const rot = normalizeTeamConfig({
      team_size: 4, gender: TEAM_GENDER.MIXED,
      singles_mode: TEAM_SINGLES_MODE.ROTATING, win_rule: TEAM_WIN_RULE.ALL,
      etapas: [{ type: TEAM_ETAPA_TYPE.SINGLES }],
    }).value;
    const match = { etapas: [{ id: 'etapa_1', side_a: ['a1', 'a2'], side_b: ['b1', 'b2'] }] };
    expect(confrontationLineupStatus(match, rot, { rosterASize: 4, rosterBSize: 4 }).completa).toBe(false);
    expect(confrontationLineupStatus(
      { etapas: [{ id: 'etapa_1', side_a: ['a1', 'a2'], side_b: ['b1', 'b2'] }] },
      rot,
      { rosterASize: 2, rosterBSize: 2 },
    ).completa).toBe(true);
  });
});
