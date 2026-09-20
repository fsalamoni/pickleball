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

describe('⭐ todo modelo pronto é VÁLIDO', () => {
  // Um modelo que não passa na própria validação é uma armadilha: o
  // organizador escolhe, salva e só descobre no sorteio.
  TOURNAMENT_PRESETS.forEach((preset) => {
    preset.formats.forEach((formato) => {
      it(`${preset.id} (${formato})`, () => {
        const fases = buildPreset(preset.id, formato);
        expect(Array.isArray(fases), preset.id).toBe(true);
        expect(fases.length, preset.id).toBeGreaterThan(0);
        const v = validatePhases(fases, formato);
        expect(v.errors, `${preset.id}/${formato}`).toEqual([]);
        expect(v.valid).toBe(true);
      });
    });
  });

  it('todo modelo tem rótulo e descrição que explicam a escolha', () => {
    TOURNAMENT_PRESETS.forEach((p) => {
      expect(p.label, p.id).toBeTruthy();
      expect(p.description?.length, p.id).toBeGreaterThan(40);
      expect(p.formats.length, p.id).toBeGreaterThan(0);
    });
  });

  it('modelo inexistente devolve null', () => {
    expect(buildPreset('nao-existe', MODALITY_FORMAT.DOUBLES)).toBeNull();
  });
});

describe('⭐ os modelos para número incomum de inscritos', () => {
  const fases = (id) => normalizePhases(buildPreset(id, MODALITY_FORMAT.DOUBLES));

  it('⭐ "Grupos + repescagem" fecha a chave: 3×2 + 2 repescados = 8', () => {
    const f = fases('groups_wildcard');
    expect(f[0].group_count).toBe(3);
    expect(f[0].qualifiers_per_group).toBe(2);
    expect(f[0].wildcard_slots).toBe(2);
    expect(f[0].group_count * f[0].qualifiers_per_group + f[0].wildcard_slots).toBe(8);
  });

  it('⭐ "Qualificatória" põe os cabeças entrando direto na 2ª fase', () => {
    const f = fases('qualifier_main_draw');
    expect(f[1].direct_entry).toMatchObject({ mode: 'seeds', count: 4 });
    // ...e a 1ª fase NÃO tem entrada direta (todos já entram nela).
    expect(f[0].direct_entry.mode).toBe('none');
  });

  it('⭐ "Grupos pequenos" joga ida e volta', () => {
    expect(fases('small_groups_double_leg')[0].round_robin_legs).toBe(2);
  });
});
