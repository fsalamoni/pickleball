import { describe, it, expect } from 'vitest';
import {
  normalizePhase,
  normalizePhases,
  validatePhases,
  supportsGroups,
  plannedGroupCount,
} from './phases.js';
import {
  MODALITY_FORMAT,
  TOURNAMENT_STAGE_TYPE,
  PHASE_DIVISION_MODE,
  PHASE_QUALIFIER_MODE,
  PHASE_PAIRING_MODE,
} from './constants.js';

describe('normalizePhase — retrocompatibilidade', () => {
  it('migra fase legada (group_count > 1) para divisão por nº de grupos', () => {
    const p = normalizePhase({ type: TOURNAMENT_STAGE_TYPE.GROUPS, group_count: 4 }, { isFirst: true });
    expect(p.division_mode).toBe(PHASE_DIVISION_MODE.GROUP_COUNT);
    expect(p.group_count).toBe(4);
  });

  it('formatos de chave não têm divisão em grupos', () => {
    const p = normalizePhase({ type: TOURNAMENT_STAGE_TYPE.KNOCKOUT, group_count: 4 });
    expect(p.division_mode).toBe(PHASE_DIVISION_MODE.SINGLE);
    expect(supportsGroups(p.type)).toBe(false);
  });
});

describe('normalizePhases', () => {
  it('garante ao menos uma fase', () => {
    expect(normalizePhases([])).toHaveLength(1);
    expect(normalizePhases(undefined)).toHaveLength(1);
  });
});

describe('validatePhases', () => {
  it('exige classificados nas fases não-finais', () => {
    const stages = [
      { type: TOURNAMENT_STAGE_TYPE.AMERICANO, division_mode: PHASE_DIVISION_MODE.GROUP_COUNT, group_count: 2, qualifiers_per_group: 0 },
      { type: TOURNAMENT_STAGE_TYPE.KNOCKOUT },
    ];
    const { valid, errors } = validatePhases(stages, MODALITY_FORMAT.SINGLES);
    expect(valid).toBe(false);
    expect(errors[0]).toMatch(/classificados/i);
  });

  it('dupla mista por grupo exige classificação por gênero', () => {
    const stages = [
      {
        type: TOURNAMENT_STAGE_TYPE.AMERICANO,
        division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
        group_count: 4,
        qualifiers_per_group: 1,
        qualifier_mode: PHASE_QUALIFIER_MODE.OVERALL,
        pairing_mode: PHASE_PAIRING_MODE.MIXED_BY_GROUP,
      },
      { type: TOURNAMENT_STAGE_TYPE.KNOCKOUT },
    ];
    const { valid, errors } = validatePhases(stages, MODALITY_FORMAT.SINGLES);
    expect(valid).toBe(false);
    expect(errors.some((e) => /gênero/i.test(e))).toBe(true);
  });

  it('rejeita americano em modalidade de duplas', () => {
    const stages = [{ type: TOURNAMENT_STAGE_TYPE.AMERICANO }];
    const { valid } = validatePhases(stages, MODALITY_FORMAT.DOUBLES);
    expect(valid).toBe(false);
  });

  it('aceita a configuração do Exemplo 1 (grupos → mata-mata misto)', () => {
    const stages = [
      {
        type: TOURNAMENT_STAGE_TYPE.AMERICANO,
        division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
        group_count: 4,
        qualifiers_per_group: 1,
        qualifier_mode: PHASE_QUALIFIER_MODE.BY_GENDER,
        pairing_mode: PHASE_PAIRING_MODE.MIXED_BY_GROUP,
      },
      { type: TOURNAMENT_STAGE_TYPE.KNOCKOUT },
    ];
    expect(validatePhases(stages, MODALITY_FORMAT.SINGLES).valid).toBe(true);
  });
});

describe('plannedGroupCount', () => {
  it('calcula nº de grupos por máximo por grupo', () => {
    const p = normalizePhase({
      type: TOURNAMENT_STAGE_TYPE.AMERICANO,
      division_mode: PHASE_DIVISION_MODE.MAX_PER_GROUP,
      max_per_group: 5,
    });
    expect(plannedGroupCount(p, 19)).toBe(4);
  });
});
