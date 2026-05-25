import { describe, it, expect } from 'vitest';
import {
  classifyHit,
  computeMatchPoints,
  computeSpecialBetPoints,
  compareForGeneralRanking,
  compareForBuchaRanking,
  defaultBet,
  HIT_TYPES,
} from './scoringEngine.js';

const groupTier = {
  stage_code: 'group',
  exact_score: 25,
  winner_plus_diff: 18,
  winner_plus_team_goals: 15,
  winner_only: 12,
  team_goals_only: 5,
  penalty_winner: 0,
};

const r16Tier = {
  stage_code: 'r16',
  exact_score: 50,
  winner_plus_diff: 35,
  winner_plus_team_goals: 30,
  winner_only: 25,
  team_goals_only: 10,
  penalty_winner: 25,
};

const finalTier = {
  stage_code: 'final',
  exact_score: 500,
  winner_plus_diff: 350,
  winner_plus_team_goals: 300,
  winner_only: 250,
  team_goals_only: 100,
  penalty_winner: 250,
};

const baseMatch = {
  home_team_id: 'BRA',
  away_team_id: 'ARG',
  official_home_score: 2,
  official_away_score: 0,
};

// =================== classifyHit ===================
describe('classifyHit', () => {
  it('placar exato → EXACT_SCORE (bucha)', () => {
    expect(classifyHit({ predicted_home: 2, predicted_away: 0 }, baseMatch)).toBe(HIT_TYPES.EXACT_SCORE);
  });

  it('exemplo da planilha: palpite 2x0, resultado 3x1 → vencedor + diferença', () => {
    const m = { ...baseMatch, official_home_score: 3, official_away_score: 1 };
    expect(classifyHit({ predicted_home: 2, predicted_away: 0 }, m)).toBe(HIT_TYPES.WINNER_PLUS_DIFF);
  });

  it('exemplo da planilha: palpite 4x0, resultado 4x1 → vencedor + nº gols de um time', () => {
    const m = { ...baseMatch, official_home_score: 4, official_away_score: 1 };
    expect(classifyHit({ predicted_home: 4, predicted_away: 0 }, m)).toBe(HIT_TYPES.WINNER_PLUS_TEAM_GOALS);
  });

  it('exemplo da planilha: palpite 3x1, resultado 1x0 → apenas vencedor', () => {
    const m = { ...baseMatch, official_home_score: 1, official_away_score: 0 };
    expect(classifyHit({ predicted_home: 3, predicted_away: 1 }, m)).toBe(HIT_TYPES.WINNER_ONLY);
  });

  it('exemplo da planilha: palpite 2x0, resultado 0x0 → nº gols de um time', () => {
    const m = { ...baseMatch, official_home_score: 0, official_away_score: 0 };
    expect(classifyHit({ predicted_home: 2, predicted_away: 0 }, m)).toBe(HIT_TYPES.TEAM_GOALS_ONLY);
  });

  it('errou tudo: palpite 0x3, resultado 2x0 → NONE', () => {
    expect(classifyHit({ predicted_home: 0, predicted_away: 3 }, baseMatch)).toBe(HIT_TYPES.NONE);
  });

  it('empate sem bucha pontua como winner_plus_diff (1x1 vs 2x2)', () => {
    const m = { ...baseMatch, official_home_score: 2, official_away_score: 2 };
    expect(classifyHit({ predicted_home: 1, predicted_away: 1 }, m)).toBe(HIT_TYPES.WINNER_PLUS_DIFF);
  });

  it('empate exato = bucha', () => {
    const m = { ...baseMatch, official_home_score: 1, official_away_score: 1 };
    expect(classifyHit({ predicted_home: 1, predicted_away: 1 }, m)).toBe(HIT_TYPES.EXACT_SCORE);
  });

  it('palpitou empate, deu vitória home → NONE', () => {
    expect(classifyHit({ predicted_home: 1, predicted_away: 1 }, baseMatch)).toBe(HIT_TYPES.NONE);
  });

  it('palpitou home win, deu empate, sem acerto de placar parcial → NONE', () => {
    const m = { ...baseMatch, official_home_score: 1, official_away_score: 1 };
    expect(classifyHit({ predicted_home: 3, predicted_away: 0 }, m)).toBe(HIT_TYPES.NONE);
  });
});

// =================== computeMatchPoints — basic tiers ===================
describe('computeMatchPoints — pontuação por fase', () => {
  it('Bucha na fase de grupos = 25', () => {
    const r = computeMatchPoints({ predicted_home: 2, predicted_away: 0 }, baseMatch, groupTier);
    expect(r.total_points).toBe(25);
    expect(r.is_bucha).toBe(true);
    expect(r.is_super_bucha).toBe(false);
  });

  it('Bucha na final = 500', () => {
    const r = computeMatchPoints({ predicted_home: 2, predicted_away: 0 }, baseMatch, finalTier);
    expect(r.total_points).toBe(500);
  });

  it('Apenas vencedor na fase de grupos = 12', () => {
    const m = { ...baseMatch, official_home_score: 1, official_away_score: 0 };
    const r = computeMatchPoints({ predicted_home: 3, predicted_away: 1 }, m, groupTier);
    expect(r.total_points).toBe(12);
    expect(r.hit_type).toBe(HIT_TYPES.WINNER_ONLY);
  });

  it('Vencedor + diferença nas semis = 210', () => {
    const m = { ...baseMatch, official_home_score: 3, official_away_score: 1 };
    const r = computeMatchPoints(
      { predicted_home: 2, predicted_away: 0 },
      m,
      { ...finalTier, exact_score: 300, winner_plus_diff: 210, winner_plus_team_goals: 180, winner_only: 150, team_goals_only: 60, penalty_winner: 150 },
    );
    expect(r.total_points).toBe(210);
  });

  it('Errou tudo = 0 pontos', () => {
    const r = computeMatchPoints({ predicted_home: 0, predicted_away: 3 }, baseMatch, groupTier);
    expect(r.total_points).toBe(0);
    expect(r.hit_type).toBe(HIT_TYPES.NONE);
  });

  it('Falha quando match não tem placar oficial', () => {
    expect(() =>
      computeMatchPoints({ predicted_home: 1, predicted_away: 0 }, { home_team_id: 'BRA', away_team_id: 'ARG' }, groupTier),
    ).toThrow();
  });
});

// =================== Zebras ===================
describe('computeMatchPoints — Zebras', () => {
  const zebraMatch = {
    home_team_id: 'NZL',
    away_team_id: 'BEL',
    official_home_score: 1,
    official_away_score: 0,
    zebra_team_id: 'NZL',
    zebra_multiplier: 3,
  };

  it('Zebra venceu e o usuário palpitou na vitória da zebra: multiplica pontos', () => {
    const r = computeMatchPoints({ predicted_home: 1, predicted_away: 0 }, zebraMatch, groupTier);
    // bucha 25 * 3 = 75
    expect(r.total_points).toBe(75);
    expect(r.zebra_applied).toBe(true);
    expect(r.is_super_bucha).toBe(true); // bucha + zebra = super bucha
  });

  it('Zebra venceu mas usuário palpitou na vitória do favorito: sem multiplicador', () => {
    const r = computeMatchPoints({ predicted_home: 0, predicted_away: 1 }, zebraMatch, groupTier);
    expect(r.zebra_applied).toBe(false);
    expect(r.total_points).toBe(0); // errou o vencedor; nem placar parcial bate
  });

  it('Zebra perdeu: multiplicador não aplica mesmo se o palpite foi na zebra', () => {
    const m = { ...zebraMatch, official_home_score: 0, official_away_score: 2 };
    const r = computeMatchPoints({ predicted_home: 1, predicted_away: 0 }, m, groupTier);
    expect(r.zebra_applied).toBe(false);
    expect(r.total_points).toBe(0);
  });

  it('Zebra venceu, palpite acertou apenas o vencedor: 12 * 4 = 48 (multiplicador 4x)', () => {
    const m = { ...zebraMatch, zebra_multiplier: 4, official_home_score: 2, official_away_score: 0 };
    const r = computeMatchPoints({ predicted_home: 3, predicted_away: 2 }, m, groupTier);
    expect(r.hit_type).toBe(HIT_TYPES.WINNER_ONLY);
    expect(r.total_points).toBe(48);
    expect(r.is_bucha).toBe(false);
  });

  it('Zebra venceu, palpite acertou vencedor e diferença: 18 * 4 = 72 (multiplicador 4x)', () => {
    const m = { ...zebraMatch, zebra_multiplier: 4, official_home_score: 2, official_away_score: 0 };
    const r = computeMatchPoints({ predicted_home: 3, predicted_away: 1 }, m, groupTier);
    expect(r.hit_type).toBe(HIT_TYPES.WINNER_PLUS_DIFF);
    expect(r.total_points).toBe(72);
    expect(r.is_bucha).toBe(false);
  });

  it('Zebra é o time da casa (mando), palpite favorito ao mandante: aplica zebra', () => {
    // Palpite 2x0, resultado 2x0, zebra=home, mult=2 → 25 * 2 = 50
    const r = computeMatchPoints({ predicted_home: 2, predicted_away: 0 }, { ...zebraMatch, zebra_multiplier: 2, official_home_score: 2 }, groupTier);
    expect(r.total_points).toBe(50);
  });

  it('Sem zebra na partida: jogo normal', () => {
    const r = computeMatchPoints({ predicted_home: 2, predicted_away: 0 }, baseMatch, groupTier);
    expect(r.zebra_applied).toBe(false);
    expect(r.total_points).toBe(25);
  });
});

// =================== Pênaltis ===================
describe('computeMatchPoints — Pênaltis (mata-mata)', () => {
  const koMatch = {
    home_team_id: 'BRA',
    away_team_id: 'ARG',
    official_home_score: 1,
    official_away_score: 1,
    penalty_winner_team_id: 'BRA',
  };

  it('Acerto do vencedor dos pênaltis nas oitavas = 25 extras', () => {
    const r = computeMatchPoints(
      { predicted_home: 1, predicted_away: 1, predicted_home_penalties: 4, predicted_away_penalties: 2 },
      { ...koMatch, official_home_penalties: 4, official_away_penalties: 2 },
      r16Tier,
    );
    // bucha 50 + bucha de pênaltis 50 = 100
    expect(r.total_points).toBe(100);
    expect(r.penalty_points).toBe(50);
    expect(r.penalty_hit_type).toBe(HIT_TYPES.EXACT_SCORE);
    expect(r.bucha_count).toBe(2);
    expect(r.is_super_bucha).toBe(true); // bucha + pênaltis acertados
  });

  it('Pênaltis como jogo extra: vencedor + diferença pontua como extra da fase', () => {
    const r = computeMatchPoints(
      { predicted_home: 3, predicted_away: 0, predicted_home_penalties: 5, predicted_away_penalties: 3 },
      { ...koMatch, official_home_penalties: 4, official_away_penalties: 2 },
      r16Tier,
    );
    expect(r.hit_type).toBe(HIT_TYPES.NONE);
    expect(r.penalty_hit_type).toBe(HIT_TYPES.WINNER_PLUS_DIFF);
    expect(r.base_points).toBe(0);
    expect(r.penalty_points).toBe(35);
    expect(r.total_points).toBe(35);
  });

  it('Pênaltis como jogo extra: acerta vencedor e placar de um lado', () => {
    const r = computeMatchPoints(
      { predicted_home: 0, predicted_away: 2, predicted_home_penalties: 4, predicted_away_penalties: 3 },
      { ...koMatch, official_home_penalties: 4, official_away_penalties: 2 },
      r16Tier,
    );
    expect(r.penalty_hit_type).toBe(HIT_TYPES.WINNER_PLUS_TEAM_GOALS);
    expect(r.penalty_points).toBe(30);
  });

  it('Pênaltis como jogo extra: palpite do desempate independe do palpite normal não empatado', () => {
    const r = computeMatchPoints(
      { predicted_home: 2, predicted_away: 0, predicted_home_penalties: 4, predicted_away_penalties: 2 },
      { ...koMatch, official_home_penalties: 4, official_away_penalties: 2 },
      r16Tier,
    );
    expect(r.base_points).toBe(0);
    expect(r.penalty_points).toBe(50);
    expect(r.total_points).toBe(50);
  });

  it('Errou pênaltis = sem extras', () => {
    const r = computeMatchPoints(
      { predicted_home: 1, predicted_away: 1, predicted_home_penalties: 2, predicted_away_penalties: 4 },
      { ...koMatch, official_home_penalties: 4, official_away_penalties: 2 },
      r16Tier,
    );
    expect(r.penalty_points).toBe(0);
    expect(r.total_points).toBe(50); // apenas a bucha
  });

  it('Não palpitou pênaltis = sem extras (mas palpite normal pontua)', () => {
    const r = computeMatchPoints({ predicted_home: 1, predicted_away: 1 }, { ...koMatch, official_home_penalties: 4, official_away_penalties: 2 }, r16Tier);
    expect(r.penalty_points).toBe(0);
    expect(r.total_points).toBe(50);
  });

  it('Fase de grupos não tem extras de pênaltis (tier.penalty_winner=0)', () => {
    const r = computeMatchPoints(
      { predicted_home: 2, predicted_away: 0, penalty_winner_team_id: 'BRA' },
      { ...baseMatch, official_home_penalties: 4, official_away_penalties: 2, penalty_winner_team_id: 'BRA' },
      groupTier,
    );
    expect(r.penalty_points).toBe(0);
  });

  it('Pênaltis na final = 250 extras', () => {
    const r = computeMatchPoints(
      { predicted_home: 2, predicted_away: 2, predicted_home_penalties: 4, predicted_away_penalties: 2 },
      { ...koMatch, official_home_score: 2, official_away_score: 2, official_home_penalties: 4, official_away_penalties: 2 },
      finalTier,
    );
    expect(r.total_points).toBe(500 + 500);
  });

  it('Mata-mata sem pênaltis oficiais zera o extra mesmo se o usuário palpitou pênaltis', () => {
    const r = computeMatchPoints(
      { predicted_home: 2, predicted_away: 1, penalty_winner_team_id: 'BRA' },
      { ...baseMatch, official_home_score: 2, official_away_score: 1, penalty_winner_team_id: null },
      r16Tier,
    );
    expect(r.base_points).toBe(50);
    expect(r.penalty_points).toBe(0);
    expect(r.total_points).toBe(50);
  });

  it('Zebra que avança nos pênaltis multiplica pontos do jogo e pontos dos pênaltis', () => {
    const r = computeMatchPoints(
      { predicted_home: 1, predicted_away: 1, predicted_home_penalties: 1, predicted_away_penalties: 2, penalty_winner_team_id: 'ARG' },
      {
        ...koMatch,
        official_home_score: 1,
        official_away_score: 1,
        official_home_penalties: 2,
        official_away_penalties: 4,
        penalty_winner_team_id: 'ARG',
        zebra_team_id: 'ARG',
        zebra_multiplier: 3,
      },
      r16Tier,
    );
    expect(r.zebra_applied).toBe(true);
    expect(r.base_points).toBe(50 * 3);
    expect(r.penalty_points).toBe(25 * 3);
    expect(r.total_points).toBe(225);
  });
});

// =================== Default 0x0 ===================
describe('defaultBet — usuários sem palpite', () => {
  it('palpite-padrão é 0x0 sem pênaltis', () => {
    expect(defaultBet()).toEqual({
      predicted_home: 0,
      predicted_away: 0,
      penalty_winner_team_id: null,
      predicted_home_penalties: null,
      predicted_away_penalties: null,
    });
  });

  it('default 0x0 vs resultado 0x0 = bucha', () => {
    const m = { ...baseMatch, official_home_score: 0, official_away_score: 0 };
    const r = computeMatchPoints(defaultBet(), m, groupTier);
    expect(r.total_points).toBe(25);
    expect(r.is_bucha).toBe(true);
  });

  it('default 0x0 vs vitória home pontua nº de gols (away=0)', () => {
    const r = computeMatchPoints(defaultBet(), baseMatch, groupTier);
    // palpite 0x0, real 2x0, vencedor errado (bet=draw, real=home), away=0 confere
    expect(r.hit_type).toBe(HIT_TYPES.TEAM_GOALS_ONLY);
    expect(r.total_points).toBe(5);
  });
});

// =================== Special Bets ===================
describe('computeSpecialBetPoints', () => {
  const points = { champion: 300, top_scorer: 150 };

  it('Acerto do campeão = 300 + super bucha', () => {
    const r = computeSpecialBetPoints(
      { type: 'champion', team_id: 'BRA' },
      { champion_team_id: 'BRA' },
      points,
    );
    expect(r.points).toBe(300);
    expect(r.hit).toBe(true);
    expect(r.is_super_bucha).toBe(true);
  });

  it('Errou campeão = 0', () => {
    const r = computeSpecialBetPoints(
      { type: 'champion', team_id: 'BRA' },
      { champion_team_id: 'ARG' },
      points,
    );
    expect(r.points).toBe(0);
    expect(r.is_super_bucha).toBe(false);
  });

  it('Acerto do artilheiro = 150 (case insensitive + acentos)', () => {
    const r = computeSpecialBetPoints(
      { type: 'top_scorer', player_name: 'KYLIAN MBAPPÉ' },
      { top_scorer_player_name: 'Kylian Mbappe' },
      points,
    );
    expect(r.points).toBe(150);
    expect(r.hit).toBe(true);
    expect(r.is_super_bucha).toBe(false);
  });

  it('Tipo desconhecido = 0', () => {
    const r = computeSpecialBetPoints(
      { type: 'foo' },
      { champion_team_id: 'BRA' },
      points,
    );
    expect(r.points).toBe(0);
  });
});

// =================== Desempates ===================
describe('Desempates - compareForGeneralRanking', () => {
  it('ordena por pontos primeiro', () => {
    const arr = [
      { points: 100, buchas: 0, super_buchas: 0, group_stage_position: 5 },
      { points: 200, buchas: 0, super_buchas: 0, group_stage_position: 10 },
    ].sort(compareForGeneralRanking);
    expect(arr[0].points).toBe(200);
  });

  it('empate em pontos: nº de buchas decide', () => {
    const arr = [
      { points: 100, buchas: 1, super_buchas: 0, group_stage_position: 1 },
      { points: 100, buchas: 3, super_buchas: 0, group_stage_position: 5 },
    ].sort(compareForGeneralRanking);
    expect(arr[0].buchas).toBe(3);
  });

  it('empate em pontos e buchas: super buchas decide', () => {
    const arr = [
      { points: 100, buchas: 2, super_buchas: 0, group_stage_position: 1 },
      { points: 100, buchas: 2, super_buchas: 1, group_stage_position: 5 },
    ].sort(compareForGeneralRanking);
    expect(arr[0].super_buchas).toBe(1);
  });

  it('triplo empate: melhor colocação na 1ª fase decide (menor é melhor)', () => {
    const arr = [
      { points: 100, buchas: 2, super_buchas: 1, group_stage_position: 5 },
      { points: 100, buchas: 2, super_buchas: 1, group_stage_position: 2 },
    ].sort(compareForGeneralRanking);
    expect(arr[0].group_stage_position).toBe(2);
  });
});

describe('Desempates - compareForBuchaRanking', () => {
  it('ordena por buchas, depois super_buchas', () => {
    const arr = [
      { buchas: 5, super_buchas: 1, general_ranking_position: 1 },
      { buchas: 5, super_buchas: 3, general_ranking_position: 10 },
    ].sort(compareForBuchaRanking);
    expect(arr[0].super_buchas).toBe(3);
  });

  it('empate buchas+super_buchas: pior colocação geral vence', () => {
    const arr = [
      { buchas: 5, super_buchas: 2, general_ranking_position: 1 },
      { buchas: 5, super_buchas: 2, general_ranking_position: 20 },
    ].sort(compareForBuchaRanking);
    expect(arr[0].general_ranking_position).toBe(20);
  });
});
