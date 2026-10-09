import { describe, it, expect } from 'vitest';
import {
  SKILL_AREAS, SKILL_AREA_LABELS, SKILLS, isValidSkill, skillArea, skillLabel, skillOptions,
  ITEM_KINDS, ITEM_KIND_LABELS, ITEM_KIND_HINTS, PLACES, PLACE_LABELS, EQUIPMENT, EQUIPMENT_LABELS,
  MOTOR_ABILITIES, MOTOR_ABILITY_LABELS, BLOCK_TYPES, BLOCK_TYPE_LABELS, METRIC_TYPES, METRIC_TYPE_LABELS,
  STUDY_TYPES, STUDY_TYPE_LABELS, rpeLabel,
} from './taxonomy.js';
// Só aqui, no teste: o questionário tem 66 kB e não pode entrar no pacote do treino.
import { CATEGORY_KEYS } from '@/modules/leveling/domain/questionnaire.js';

describe('taxonomia — áreas', () => {
  it('as áreas são exatamente as categorias do nivelamento (paridade)', () => {
    expect([...SKILL_AREAS].sort()).toEqual([...Object.values(CATEGORY_KEYS)].sort());
  });

  it('toda área tem rótulo em pt-BR', () => {
    for (const a of SKILL_AREAS) expect(SKILL_AREA_LABELS[a]).toBeTruthy();
  });
});

describe('taxonomia — sub-habilidades', () => {
  it('toda chave é `area.slug` com uma área conhecida e rótulo', () => {
    for (const [k, label] of Object.entries(SKILLS)) {
      expect(k).toMatch(/^[a-z]+\.[a-z0-9_]+$/);
      expect(SKILL_AREAS).toContain(skillArea(k));
      expect(label).toBeTruthy();
    }
  });

  it('isValidSkill aceita área ou sub-habilidade e recusa o resto', () => {
    expect(isValidSkill('kitchen')).toBe(true);
    expect(isValidSkill('kitchen.dink_cruzado')).toBe(true);
    expect(isValidSkill(' net.reset ')).toBe(true);
    expect(isValidSkill('kitchen.inventado')).toBe(false);
    expect(isValidSkill('cozinha')).toBe(false);
    expect(isValidSkill('')).toBe(false);
    expect(isValidSkill(null)).toBe(false);
  });

  it('skillArea e skillLabel', () => {
    expect(skillArea('doubles.stacking')).toBe('doubles');
    expect(skillArea('mental')).toBe('mental');
    expect(skillLabel('doubles.stacking')).toBe('Stacking');
    expect(skillLabel('kitchen')).toBe(SKILL_AREA_LABELS.kitchen);
    expect(skillLabel('desconhecido')).toBe('desconhecido');
  });

  it('skillOptions lista as áreas em ordem, cada uma com as suas sub-habilidades', () => {
    const opts = skillOptions();
    expect(opts.map((o) => o.value)).toEqual([...SKILL_AREAS]);
    const total = opts.reduce((n, o) => n + o.children.length, 0);
    expect(total).toBe(Object.keys(SKILLS).length);
    for (const o of opts) for (const c of o.children) expect(skillArea(c.value)).toBe(o.value);
  });
});

describe('taxonomia — rótulos dos vocabulários', () => {
  it.each([
    ['ITEM_KINDS', ITEM_KINDS, ITEM_KIND_LABELS],
    ['ITEM_KINDS (dicas)', ITEM_KINDS, ITEM_KIND_HINTS],
    ['PLACES', PLACES, PLACE_LABELS],
    ['EQUIPMENT', EQUIPMENT, EQUIPMENT_LABELS],
    ['MOTOR_ABILITIES', MOTOR_ABILITIES, MOTOR_ABILITY_LABELS],
    ['BLOCK_TYPES', BLOCK_TYPES, BLOCK_TYPE_LABELS],
    ['METRIC_TYPES', METRIC_TYPES, METRIC_TYPE_LABELS],
    ['STUDY_TYPES', STUDY_TYPES, STUDY_TYPE_LABELS],
  ])('%s: todo valor tem rótulo e nenhum rótulo sobra', (_, values, labels) => {
    for (const v of values) expect(labels[v]).toBeTruthy();
    expect(Object.keys(labels).sort()).toEqual([...values].sort());
  });

  it('rpeLabel cobre 0–10 e devolve vazio fora da escala', () => {
    for (let i = 0; i <= 10; i += 1) expect(rpeLabel(i)).toBeTruthy();
    expect(rpeLabel(6.6)).toBe(rpeLabel(7));
    expect(rpeLabel(11)).toBe('');
    expect(rpeLabel(-1)).toBe('');
    expect(rpeLabel('x')).toBe('');
  });
});
