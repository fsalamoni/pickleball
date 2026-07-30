import { describe, it, expect } from 'vitest';
import {
  validateRequiredProfile, isRequiredProfileComplete,
  missingRegistrationFields, isRegistrationComplete,
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
