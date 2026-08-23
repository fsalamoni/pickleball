import { describe, it, expect } from 'vitest';
import {
  TEAM_GENDER, TEAM_ETAPA_TYPE, TEAM_WIN_RULE, TEAM_SINGLES_MODE,
  normalizeTeamConfig, validateTeamRoster, validateConfrontationLineup,
  etapaWinner, etapaDecided, computeConfrontationResult,
  buildTeamStandings, buildTeamRanking, headToHeadWinner,
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
