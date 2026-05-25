import { describe, expect, it } from 'vitest';
import {
  buildDefaultPoolSettings,
  CUSTOM_STAGE_TYPES,
  getPoolStage,
  getPoolScoringTiers,
  getStageSectionTitle,
  getScoringExplanationRows,
  getSportParameterRows,
  getPoolStages,
  normalizeScoreValue,
  POOL_TEMPLATE_CODES,
  SPORT_PRESETS,
  stageAllowsTiebreaker,
  stageUsesSections,
  validateSportScorePair,
} from './poolSettings';

describe('custom pool settings', () => {
  it('builds isolated defaults for custom sports pools', () => {
    const settings = buildDefaultPoolSettings(POOL_TEMPLATE_CODES.custom, { sport_code: 'volleyball' });

    expect(settings.sport_config).toMatchObject(SPORT_PRESETS.volleyball);
    expect(settings.deadline_overrides).toEqual({});
    expect(settings.special_bet_points).toEqual({ champion: 0, top_scorer: 0 });
    expect(settings.custom_stages.length).toBeGreaterThan(0);
    expect(settings.scoring_overrides.regular.exact_score).toBeGreaterThan(settings.scoring_overrides.regular.winner_only);
  });

  it('returns custom stages and scoring tiers without mutating World Cup stages', () => {
    const pool = {
      template_code: POOL_TEMPLATE_CODES.custom,
      settings: buildDefaultPoolSettings(POOL_TEMPLATE_CODES.custom, { sport_code: 'basketball' }),
    };

    const stages = getPoolStages(pool);
    const tiers = getPoolScoringTiers(pool);

    expect(stages.map((stage) => stage.code)).toContain('regular');
    expect(stages.map((stage) => stage.code)).not.toContain('group');
    expect(stages[0]).toMatchObject({ phase_type: CUSTOM_STAGE_TYPES.league, section_label: 'Rodada/Grupo' });
    expect(tiers.map((tier) => tier.stage_code)).toEqual(stages.map((stage) => stage.code));
  });

  it('documents every scoring hypothesis shown in the rules tab', () => {
    const rows = getScoringExplanationRows({
      template_code: POOL_TEMPLATE_CODES.custom,
      settings: buildDefaultPoolSettings(POOL_TEMPLATE_CODES.custom, { sport_code: 'soccer' }),
    });

    expect(rows.map((row) => row.key)).toEqual([
      'exact_score',
      'winner_plus_diff',
      'winner_plus_team_goals',
      'winner_only',
      'team_goals_only',
      'penalty_winner',
      'zebra',
      'default_bet',
      'super_bucha',
      'ranking_tiebreakers',
    ]);
    rows.forEach((row) => {
      expect(row.title).toBeTruthy();
      expect(row.short).toBeTruthy();
      expect(row.example).toContain(' ');
      expect(row.caveat).toContain(' ');
    });
  });

  it('exposes sport-specific parameters and validates score constraints', () => {
    const settings = buildDefaultPoolSettings(POOL_TEMPLATE_CODES.custom, { sport_code: 'volleyball' });
    const parameterRows = Object.fromEntries(getSportParameterRows(settings));

    expect(parameterRows['Empate no placar']).toBe('bloqueado');
    expect(validateSportScorePair(2, 2, settings.sport_config)).toMatchObject({ ok: false });
    expect(validateSportScorePair(3, 1, settings.sport_config)).toMatchObject({ ok: true, home: 3, away: 1 });
  });

  it('supports decimal score steps for chess-style draws', () => {
    const settings = buildDefaultPoolSettings(POOL_TEMPLATE_CODES.custom, { sport_code: 'chess' });

    expect(settings.sport_config.score_step).toBe(0.5);
    expect(normalizeScoreValue(0.6, settings.sport_config)).toBe(0.5);
    expect(validateSportScorePair(0.5, 0.5, settings.sport_config)).toMatchObject({ ok: true });
  });

  it('keeps rich stage metadata for grouping and tiebreakers', () => {
    const pool = {
      template_code: POOL_TEMPLATE_CODES.custom,
      settings: {
        ...buildDefaultPoolSettings(POOL_TEMPLATE_CODES.custom, { sport_code: 'soccer' }),
        custom_stages: [
          {
            code: 'turno',
            label: '1º Turno',
            phase_type: 'league',
            section_label: 'Rodada',
            allows_tiebreaker: false,
          },
          {
            code: 'grupos_finais',
            label: 'Fase Final',
            phase_type: 'groups',
            section_label: 'Grupo',
            allows_tiebreaker: false,
          },
          {
            code: 'mata_mata',
            label: 'Mata-mata',
            phase_type: 'knockout',
            section_label: 'Chave',
            allows_tiebreaker: true,
          },
        ],
      },
    };

    const leagueStage = getPoolStage(pool, 'turno');
    const knockoutStage = getPoolStage(pool, 'mata_mata');

    expect(stageAllowsTiebreaker(leagueStage, SPORT_PRESETS.soccer)).toBe(false);
    expect(stageAllowsTiebreaker(knockoutStage, SPORT_PRESETS.soccer)).toBe(true);
    expect(stageUsesSections(leagueStage, [{ group_code: '1' }])).toBe(true);
    expect(getStageSectionTitle(leagueStage, '1')).toBe('Rodada 1');
    expect(getStageSectionTitle(knockoutStage, 'A')).toBe('Chave A');
  });
});
