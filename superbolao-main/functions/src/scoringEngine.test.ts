import { describe, it, expect } from 'vitest';
import { computeMatchPoints, classifyHit, HIT_TYPES, defaultBet } from './scoringEngine';

const groupTier = {
  exact_score: 25,
  winner_plus_diff: 18,
  winner_plus_team_goals: 15,
  winner_only: 12,
  team_goals_only: 5,
  penalty_winner: 0,
};

const r16Tier = {
  exact_score: 50,
  winner_plus_diff: 35,
  winner_plus_team_goals: 30,
  winner_only: 25,
  team_goals_only: 10,
  penalty_winner: 25,
};

const baseMatch = {
  home_team_id: 'BRA',
  away_team_id: 'ARG',
  official_home_score: 2,
  official_away_score: 0,
};

describe('TS scoringEngine — paridade com a implementação JS do front', () => {
  it('bucha grupos = 25', () => {
    expect(computeMatchPoints({ predicted_home: 2, predicted_away: 0 }, baseMatch, groupTier).total_points).toBe(25);
  });
  it('palpite 2x0 res 3x1 = winner_plus_diff = 18', () => {
    expect(
      computeMatchPoints({ predicted_home: 2, predicted_away: 0 }, { ...baseMatch, official_home_score: 3, official_away_score: 1 }, groupTier).total_points,
    ).toBe(18);
  });
  it('palpite 4x0 res 4x1 = winner_plus_team_goals = 15', () => {
    const r = computeMatchPoints(
      { predicted_home: 4, predicted_away: 0 },
      { ...baseMatch, official_home_score: 4, official_away_score: 1 },
      groupTier,
    );
    expect(r.hit_type).toBe(HIT_TYPES.WINNER_PLUS_TEAM_GOALS);
    expect(r.total_points).toBe(15);
  });
  it('zebra 3x bucha 1x0 = 75 + super_bucha', () => {
    const r = computeMatchPoints(
      { predicted_home: 1, predicted_away: 0 },
      {
        home_team_id: 'NZL',
        away_team_id: 'BEL',
        official_home_score: 1,
        official_away_score: 0,
        zebra_team_id: 'NZL',
        zebra_multiplier: 3,
      },
      groupTier,
    );
    expect(r.total_points).toBe(75);
    expect(r.is_super_bucha).toBe(true);
  });
  it('pênaltis nas oitavas = 25 extras', () => {
    const r = computeMatchPoints(
      { predicted_home: 1, predicted_away: 1, predicted_home_penalties: 4, predicted_away_penalties: 2 },
      { ...baseMatch, official_home_score: 1, official_away_score: 1, official_home_penalties: 4, official_away_penalties: 2, penalty_winner_team_id: 'BRA' },
      r16Tier,
    );
    expect(r.total_points).toBe(50 + 50);
    expect(r.penalty_hit_type).toBe(HIT_TYPES.EXACT_SCORE);
    expect(r.bucha_count).toBe(2);
    expect(r.is_super_bucha).toBe(true);
  });
  it('pênaltis são pontuados como jogo extra independente do palpite normal', () => {
    const r = computeMatchPoints(
      { predicted_home: 2, predicted_away: 0, predicted_home_penalties: 5, predicted_away_penalties: 3 },
      { ...baseMatch, official_home_score: 1, official_away_score: 1, official_home_penalties: 4, official_away_penalties: 2 },
      r16Tier,
    );
    expect(r.base_points).toBe(0);
    expect(r.penalty_hit_type).toBe(HIT_TYPES.WINNER_PLUS_DIFF);
    expect(r.penalty_points).toBe(35);
    expect(r.total_points).toBe(35);
  });
  it('mata-mata sem pênaltis oficiais zera o extra mesmo se houve palpite de pênaltis', () => {
    const r = computeMatchPoints(
      { predicted_home: 2, predicted_away: 1, penalty_winner_team_id: 'BRA' },
      { ...baseMatch, official_home_score: 2, official_away_score: 1, penalty_winner_team_id: null },
      r16Tier,
    );
    expect(r.base_points).toBe(50);
    expect(r.penalty_points).toBe(0);
    expect(r.total_points).toBe(50);
  });
  it('zebra que avança nos pênaltis multiplica pontos do jogo e pontos dos pênaltis', () => {
    const r = computeMatchPoints(
      { predicted_home: 1, predicted_away: 1, predicted_home_penalties: 1, predicted_away_penalties: 2, penalty_winner_team_id: 'ARG' },
      {
        ...baseMatch,
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
  it('default 0x0 vs 0x0 = bucha 25', () => {
    const r = computeMatchPoints(defaultBet(), { ...baseMatch, official_home_score: 0, official_away_score: 0 }, groupTier);
    expect(r.total_points).toBe(25);
  });
  it('errou tudo = 0', () => {
    expect(classifyHit({ predicted_home: 0, predicted_away: 3 }, baseMatch)).toBe(HIT_TYPES.NONE);
  });
});
