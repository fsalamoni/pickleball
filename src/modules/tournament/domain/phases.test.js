import { describe, it, expect } from 'vitest';
import {
  normalizePhase,
  normalizePhases,
  validatePhases,
  supportsGroups,
  plannedGroupCount,
  matchesWithStaleSingleGroup,
  groupDocsInSingleGroupStages,
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

describe('normalizePhase — classificados padrão', () => {
  it('usa 2 classificados por grupo quando não informado', () => {
    const p = normalizePhase({ type: TOURNAMENT_STAGE_TYPE.GROUPS, group_count: 2 });
    expect(p.qualifiers_per_group).toBe(2);
  });
  it('preserva um valor explícito (inclusive 0)', () => {
    expect(normalizePhase({ type: TOURNAMENT_STAGE_TYPE.GROUPS, qualifiers_per_group: 0 }).qualifiers_per_group).toBe(0);
    expect(normalizePhase({ type: TOURNAMENT_STAGE_TYPE.GROUPS, qualifiers_per_group: 3 }).qualifiers_per_group).toBe(3);
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

describe('matchesWithStaleSingleGroup', () => {
  const single = { type: 'groups', division_mode: PHASE_DIVISION_MODE.SINGLE };

  it('lista os jogos com m.group numa fase de grupo único', () => {
    const matches = [
      { id: 'm1', stage_index: 0, group: 'Grupo A' },
      { id: 'm2', stage_index: 0, group: 'Grupo B' },
      { id: 'm3', stage_index: 0, group: null },
    ];
    expect(matchesWithStaleSingleGroup(matches, [single])).toEqual(['m1', 'm2']);
  });

  it('não toca em fases de grupos reais (nº de grupos)', () => {
    const matches = [{ id: 'm1', stage_index: 0, group: 'Grupo A' }];
    const stages = [{ type: 'groups', division_mode: PHASE_DIVISION_MODE.GROUP_COUNT }];
    expect(matchesWithStaleSingleGroup(matches, stages)).toEqual([]);
  });

  it('não toca numa fase de grupos legada sem division_mode', () => {
    const matches = [{ id: 'm1', stage_index: 0, group: 'Grupo A' }];
    expect(matchesWithStaleSingleGroup(matches, [{ type: 'groups' }])).toEqual([]);
  });

  it('respeita o stage_index de cada jogo', () => {
    const matches = [
      { id: 'm1', stage_index: 0, group: 'Grupo A' }, // fase de grupos reais
      { id: 'm2', stage_index: 1, group: 'Grupo A' }, // fase de grupo único
    ];
    const stages = [
      { type: 'groups', division_mode: PHASE_DIVISION_MODE.GROUP_COUNT },
      { type: 'groups', division_mode: PHASE_DIVISION_MODE.SINGLE },
    ];
    expect(matchesWithStaleSingleGroup(matches, stages)).toEqual(['m2']);
  });

  it('sem marcadores obsoletos, devolve lista vazia (idempotente)', () => {
    const matches = [{ id: 'm1', stage_index: 0, group: null }];
    expect(matchesWithStaleSingleGroup(matches, [single])).toEqual([]);
    expect(matchesWithStaleSingleGroup([], [single])).toEqual([]);
  });
});

describe('groupDocsInSingleGroupStages', () => {
  const single = { type: 'groups', division_mode: PHASE_DIVISION_MODE.SINGLE };

  it('lista os docs de grupo numa fase de grupo único', () => {
    const docs = [
      { id: 'g1', stage_index: 0, name: 'Grupo A' },
      { id: 'g2', stage_index: 0, name: 'Grupo B' },
    ];
    expect(groupDocsInSingleGroupStages(docs, [single])).toEqual(['g1', 'g2']);
  });

  it('não toca em docs de fases de grupos reais (nº de grupos)', () => {
    const docs = [{ id: 'g1', stage_index: 0, name: 'Grupo A' }];
    const stages = [{ type: 'groups', division_mode: PHASE_DIVISION_MODE.GROUP_COUNT }];
    expect(groupDocsInSingleGroupStages(docs, stages)).toEqual([]);
  });

  it('não toca em docs de fase de grupos legada sem division_mode', () => {
    const docs = [{ id: 'g1', stage_index: 0, name: 'Grupo A' }];
    expect(groupDocsInSingleGroupStages(docs, [{ type: 'groups' }])).toEqual([]);
  });

  it('respeita o stage_index de cada doc', () => {
    const docs = [
      { id: 'g1', stage_index: 0, name: 'Grupo A' }, // fase de grupos reais
      { id: 'g2', stage_index: 1, name: 'Grupo A' }, // fase de grupo único
    ];
    const stages = [
      { type: 'groups', division_mode: PHASE_DIVISION_MODE.GROUP_COUNT },
      { type: 'groups', division_mode: PHASE_DIVISION_MODE.SINGLE },
    ];
    expect(groupDocsInSingleGroupStages(docs, stages)).toEqual(['g2']);
  });

  it('sem docs ou sem id, devolve lista vazia (idempotente)', () => {
    expect(groupDocsInSingleGroupStages([], [single])).toEqual([]);
    expect(groupDocsInSingleGroupStages([{ stage_index: 0 }], [single])).toEqual([]);
  });
});
