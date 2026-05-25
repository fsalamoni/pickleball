import { describe, expect, it } from 'vitest';
import { buildSourceStageKey, type ImportedCompetition } from './competitionImportProviders';
import { normalizeImportedSettings } from './importOfficialCompetitionToPool';

describe('official competition import settings', () => {
  it('creates stable stage keys from official labels', () => {
    expect(buildSourceStageKey('Group Stage')).toBe('group_stage');
    expect(buildSourceStageKey('Quarter-finals')).toBe('quarter_finals');
  });

  it('merges imported stages into pool settings while preserving existing codes', () => {
    const importedCompetition: ImportedCompetition = {
      provider: 'fifa',
      provider_label: 'FIFA',
      competition_id: '17',
      competition_name: 'Copa Teste',
      sport_code: 'soccer',
      source_url: 'https://example.com',
      competitors: [],
      matches: [],
      stages: [
        {
          source_stage_key: 'group_stage',
          label: 'Fase de grupos',
          phase_type: 'groups',
          section_label: 'Grupo',
          allows_tiebreaker: false,
          sort_order: 1,
        },
        {
          source_stage_key: 'quarter_finals',
          label: 'Quartas de final',
          phase_type: 'knockout',
          section_label: 'Chave',
          allows_tiebreaker: true,
          sort_order: 2,
        },
      ],
    };

    const settings = normalizeImportedSettings(
      {
        custom_stages: [
          {
            code: 'fase_grupos',
            label: 'Fase de grupos',
            source_stage_key: 'group_stage',
            phase_type: 'groups',
            section_label: 'Grupo',
            allows_tiebreaker: false,
          },
        ],
        scoring_overrides: {
          fase_grupos: {
            label: 'Fase de grupos',
            exact_score: 9,
            winner_plus_diff: 7,
            winner_plus_team_goals: 5,
            winner_only: 4,
            team_goals_only: 2,
            penalty_winner: 0,
          },
        },
        deadline_overrides: {
          fase_grupos: null,
        },
        sport_config: {
          code: 'custom',
          label: 'Outro',
          supports_penalties: false,
        },
      },
      importedCompetition,
    );

    expect(settings.custom_stages).toHaveLength(2);
    expect(settings.custom_stages[0]).toMatchObject({ code: 'fase_grupos', source_stage_key: 'group_stage' });
    expect(settings.custom_stages[1]).toMatchObject({ label: 'Quartas de final', allows_tiebreaker: true });
    expect(settings.scoring_overrides.fase_grupos.exact_score).toBe(9);
    expect(settings.sport_config).toMatchObject({ code: 'soccer', supports_penalties: true });
  });
});
