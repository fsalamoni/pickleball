import { describe, it, expect } from 'vitest';
import { TOURNAMENT_PRESETS, presetsForFormat, buildPreset } from './tournamentPresets.js';
import { validatePhases, normalizePhases } from './phases.js';
import { MODALITY_FORMAT } from './constants.js';

describe('catálogo de modelos de torneio', () => {
  it('todo modelo gera uma configuração de fases VÁLIDA para cada formato suportado', () => {
    TOURNAMENT_PRESETS.forEach((preset) => {
      preset.formats.forEach((format) => {
        const stages = preset.build(format);
        const { valid, errors } = validatePhases(stages, format);
        expect(valid, `${preset.id}/${format}: ${errors.join(' | ')}`).toBe(true);
      });
    });
  });

  it('ids únicos', () => {
    const ids = TOURNAMENT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('presetsForFormat filtra por formato (americano/mexicano só em simples)', () => {
    const doubles = presetsForFormat(MODALITY_FORMAT.DOUBLES).map((p) => p.id);
    expect(doubles).not.toContain('americano');
    expect(doubles).not.toContain('mexicano');
    expect(doubles).toContain('groups_ko');
  });

  it('o modelo do Exemplo 1 forma duplas mistas e mata-mata cruzado', () => {
    const stages = normalizePhases(buildPreset('americano_groups_mixed_final', MODALITY_FORMAT.SINGLES));
    expect(stages[0].type).toBe('americano');
    expect(stages[0].pairing_mode).toBe('mixed_by_group');
    expect(stages[0].qualifier_mode).toBe('by_gender');
    expect(stages[1].type).toBe('knockout');
    expect(stages[1].bracket_seeding).toBe('adjacent');
  });

  it('o modelo do Exemplo 2 tem 3 fases com fusão de grupos', () => {
    const stages = normalizePhases(buildPreset('americano_three_phase', MODALITY_FORMAT.SINGLES));
    expect(stages).toHaveLength(3);
    expect(stages[1].feed_mode).toBe('merge_groups');
    expect(stages[1].pairing_mode).toBe('pair_top_two');
  });
});
