import { describe, it, expect } from 'vitest';
import {
  validateRequiredProfile, isRequiredProfileComplete,
  missingRegistrationFields, isRegistrationComplete,
  hasDeclaredLevel, parseDuprRating, REGISTRATION_FIELD_LABELS,
} from './profileValidation.js';

const fullProfile = {
  platform_name: 'Ana',
  birth_date: '1990-05-10',
  phone: '(11) 99999-9999',
  pickleball_experience: '1_2_anos',
  gender: 'female',
  city: 'São Paulo',
  state: 'SP',
  court_side: 'left',
  interests: ['play_tournaments'],
};

describe('validateRequiredProfile (essenciais)', () => {
  it('exige nome, nascimento, telefone e experiência', () => {
    expect(validateRequiredProfile({}).isValid).toBe(false);
    expect(validateRequiredProfile({
      platformName: 'Ana', birthDate: '1990-05-10', phone: '11999999999', pickleballExperience: 'x',
    }).isValid).toBe(true);
  });
});

describe('isRegistrationComplete / missingRegistrationFields', () => {
  it('perfil completo passa', () => {
    expect(isRegistrationComplete(fullProfile)).toBe(true);
    expect(missingRegistrationFields(fullProfile)).toEqual([]);
  });

  it('detecta cada campo faltante do cadastro completo', () => {
    expect(missingRegistrationFields({ ...fullProfile, gender: '' })).toEqual(['gender']);
    expect(missingRegistrationFields({ ...fullProfile, city: '' })).toEqual(['city']);
    expect(missingRegistrationFields({ ...fullProfile, state: '' })).toEqual(['state']);
    expect(missingRegistrationFields({ ...fullProfile, court_side: '' })).toEqual(['court_side']);
    expect(missingRegistrationFields({ ...fullProfile, interests: [] })).toEqual(['interests']);
  });

  it('essenciais ausentes também entram em missing', () => {
    const m = missingRegistrationFields({ ...fullProfile, platform_name: '', phone: '' });
    expect(m).toContain('platform_name');
    expect(m).toContain('phone');
  });

  it('essenciais completos mas cadastro incompleto: isRequiredProfileComplete true, isRegistrationComplete false', () => {
    const essentialsOnly = {
      platform_name: 'Ana', birth_date: '1990-05-10', phone: '11999999999', pickleball_experience: 'x',
    };
    expect(isRequiredProfileComplete(essentialsOnly)).toBe(true);
    expect(isRegistrationComplete(essentialsOnly)).toBe(false);
  });
});

describe('cadastro essencial (flag essential_profile)', () => {
  const essencial = { essencial: true };

  it('⭐ sem a flag, nada muda: categoria e nível continuam opcionais', () => {
    expect(missingRegistrationFields(fullProfile)).toEqual([]);
    expect(isRegistrationComplete({ ...fullProfile, state: 'São' })).toBe(true); // UF solta, como sempre
  });

  it('⭐ com a flag, exige a categoria em que joga e o nível', () => {
    expect(missingRegistrationFields(fullProfile, essencial)).toEqual(['competition_gender', 'level']);
    const pronto = { ...fullProfile, competition_gender: 'female', leveling_level: 'intermediate' };
    expect(isRegistrationComplete(pronto, essencial)).toBe(true);
  });

  it('a categoria precisa ser masculina ou feminina (não serve "Prefiro não informar")', () => {
    const base = { ...fullProfile, leveling_level: 'x' };
    expect(missingRegistrationFields({ ...base, competition_gender: 'prefer_not_to_say' }, essencial)).toEqual(['competition_gender']);
    expect(missingRegistrationFields({ ...base, competition_gender: 'male' }, essencial)).toEqual([]);
  });

  it('o nível vale pela autoindicação, pelo teste ou por um rating DUPR válido', () => {
    const base = { ...fullProfile, competition_gender: 'male' };
    expect(isRegistrationComplete({ ...base, leveling_level: 'beginner' }, essencial)).toBe(true);
    expect(isRegistrationComplete({ ...base, dupr_rating: 3.5 }, essencial)).toBe(true);
    expect(isRegistrationComplete({ ...base, dupr_rating: 9 }, essencial)).toBe(false);
    expect(isRegistrationComplete({ ...base, dupr_rating: '' }, essencial)).toBe(false);
    expect(isRegistrationComplete({ ...base, leveling_level: '   ' }, essencial)).toBe(false);
  });

  it('⭐ com a flag, a UF tem de ser uma UF de verdade (aceita minúscula)', () => {
    const base = { ...fullProfile, competition_gender: 'male', leveling_level: 'x' };
    expect(missingRegistrationFields({ ...base, state: 'XX' }, essencial)).toEqual(['state']);
    expect(missingRegistrationFields({ ...base, state: 'sp' }, essencial)).toEqual([]);
  });

  it('todo campo que pode faltar tem nome para a tela', () => {
    const todos = missingRegistrationFields({ interests: [] }, essencial);
    for (const campo of todos) expect(REGISTRATION_FIELD_LABELS[campo]).toBeTruthy();
  });

  it('hasDeclaredLevel e parseDuprRating', () => {
    expect(hasDeclaredLevel({})).toBe(false);
    expect(hasDeclaredLevel({ leveling_level: 'advanced' })).toBe(true);
    expect(parseDuprRating('3,5')).toBe(3.5);
    expect(parseDuprRating('')).toBeNull();
    expect(parseDuprRating('abc')).toBeNull();
    expect(parseDuprRating('12')).toBe(8);
  });
});
