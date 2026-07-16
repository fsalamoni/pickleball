import { describe, it, expect } from 'vitest';
import {
  placeholderLabel,
  neededPlaceholderCount,
  placeholderGenderFor,
  buildPlaceholderRegistrationFields,
} from './placeholders.js';
import {
  REGISTRATION_STATUS,
  MODALITY_FORMAT,
  GENDER_CATEGORY,
  COMPETITION_GENDER,
} from './constants.js';

describe('placeholderLabel', () => {
  it('formata "Atleta N"', () => {
    expect(placeholderLabel(8)).toBe('Atleta 8');
  });
});

describe('neededPlaceholderCount', () => {
  it('completa até o número exato', () => {
    expect(neededPlaceholderCount(7, 8)).toBe(1);
    expect(neededPlaceholderCount(0, 16)).toBe(16);
    expect(neededPlaceholderCount(16, 16)).toBe(0);
  });
  it('zero quando ilimitado/indefinido', () => {
    expect(neededPlaceholderCount(3, null)).toBe(0);
    expect(neededPlaceholderCount(3, undefined)).toBe(0);
    expect(neededPlaceholderCount(3, '')).toBe(0);
  });
  it('não retorna negativo', () => {
    expect(neededPlaceholderCount(20, 16)).toBe(0);
  });
});

describe('placeholderGenderFor', () => {
  it('herda o gênero da modalidade', () => {
    expect(placeholderGenderFor({ gender_category: GENDER_CATEGORY.MALE })).toBe(COMPETITION_GENDER.MALE);
    expect(placeholderGenderFor({ gender_category: GENDER_CATEGORY.FEMALE })).toBe(COMPETITION_GENDER.FEMALE);
    expect(placeholderGenderFor({ gender_category: GENDER_CATEGORY.OPEN })).toBeNull();
    expect(placeholderGenderFor({ gender_category: GENDER_CATEGORY.MIXED })).toBeNull();
  });
});

describe('buildPlaceholderRegistrationFields', () => {
  it('simples masculino: nível padrão + gênero da modalidade', () => {
    const modality = {
      format: MODALITY_FORMAT.SINGLES,
      gender_category: GENDER_CATEGORY.MALE,
      skill_level: 'intermediate',
    };
    const f = buildPlaceholderRegistrationFields(modality, 8);
    expect(f.is_placeholder).toBe(true);
    expect(f.status).toBe(REGISTRATION_STATUS.CONFIRMED);
    expect(f.user_id).toBeNull();
    expect(f.player_a_name).toBe('Atleta 8');
    expect(f.label).toBe('Atleta 8');
    expect(f.player_a_level).toBe('intermediate');
    expect(f.player_a_competition_gender).toBe(COMPETITION_GENDER.MALE);
    expect(f.player_b_name).toBe('');
  });

  it('duplas abertas: preenche o jogador B e sem gênero', () => {
    const modality = {
      format: MODALITY_FORMAT.DOUBLES,
      gender_category: GENDER_CATEGORY.OPEN,
      skill_level: 'advanced',
    };
    const f = buildPlaceholderRegistrationFields(modality, 3);
    expect(f.player_b_name).toBe('Atleta 3');
    expect(f.player_b_level).toBe('advanced');
    expect(f.player_a_competition_gender).toBeNull();
    expect(f.player_b_competition_gender).toBeNull();
  });
});
