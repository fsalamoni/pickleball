import { describe, it, expect } from 'vitest';
import { buildAthletePublicProfile } from './publicProfile.js';
import { ATHLETE_GENDER } from './constants.js';

const REFERENCE_DATE = new Date('2026-06-15T12:00:00-03:00');

const baseProfile = {
  platform_name: 'Maria Silva',
  full_name: 'Maria da Silva',
  email: 'maria@example.com',
  birth_date: '1990-01-10',
  gender: ATHLETE_GENDER.FEMALE,
  city: '  São Paulo  ',
  state: 'sp',
  level: 'Intermediário (USAP 3.0)',
  leveling_level: 'intermediario',
  pickleball_experience: 'one_to_two_years',
  phone: '11999998888',
  address: 'Rua das Quadras, 100',
};

describe('buildAthletePublicProfile', () => {
  it('mantém contatos privados por padrão (telefone, e-mail e endereço vazios)', () => {
    const result = buildAthletePublicProfile('uid-1', baseProfile, [], { referenceDate: REFERENCE_DATE });

    expect(result.phone_public).toBe(false);
    expect(result.phone).toBe('');
    expect(result.email_public).toBe(false);
    expect(result.email).toBe('');
    expect(result.address_public).toBe(false);
    expect(result.address).toBe('');
  });

  it('publica apenas os contatos explicitamente marcados como públicos', () => {
    const result = buildAthletePublicProfile(
      'uid-1',
      { ...baseProfile, phone_public: true, email_public: false, address_public: true },
      [],
      { referenceDate: REFERENCE_DATE },
    );

    expect(result.phone_public).toBe(true);
    expect(result.phone).toBe('11999998888');
    // E-mail permanece privado mesmo existindo no perfil.
    expect(result.email_public).toBe(false);
    expect(result.email).toBe('');
    expect(result.address_public).toBe(true);
    expect(result.address).toBe('Rua das Quadras, 100');
  });

  it('nunca vaza dados privados, mesmo que existam no perfil', () => {
    const result = buildAthletePublicProfile('uid-1', baseProfile, [], { referenceDate: REFERENCE_DATE });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('11999998888');
    expect(serialized).not.toContain('maria@example.com');
    expect(serialized).not.toContain('Rua das Quadras');
  });

  it('expõe campos públicos (nome, idade, gênero, cidade, nível) corretamente', () => {
    const result = buildAthletePublicProfile('uid-1', baseProfile, [], { referenceDate: REFERENCE_DATE });

    expect(result.uid).toBe('uid-1');
    expect(result.platform_name).toBe('Maria Silva');
    expect(result.age).toBe(36);
    expect(result.gender).toBe(ATHLETE_GENDER.FEMALE);
    expect(result.city).toBe('São Paulo');
    expect(result.state).toBe('sp');
    expect(result.level).toBe('Intermediário (USAP 3.0)');
  });

  it('lista no diretório por padrão e respeita o opt-out', () => {
    expect(buildAthletePublicProfile('uid-1', baseProfile).directory_listed).toBe(true);
    expect(
      buildAthletePublicProfile('uid-1', { ...baseProfile, directory_listed: false }).directory_listed,
    ).toBe(false);
  });

  it('normaliza clubes e ignora entradas inválidas', () => {
    const result = buildAthletePublicProfile(
      'uid-1',
      baseProfile,
      [{ id: 'c1', name: 'Clube A' }, { id: null, name: 'Inválido' }, { name: 'Sem id' }],
      { referenceDate: REFERENCE_DATE },
    );

    expect(result.clubs).toEqual([{ id: 'c1', name: 'Clube A' }]);
    expect(result.club_ids).toEqual(['c1']);
  });

  it('usa fallbacks de nome quando platform_name está ausente', () => {
    expect(buildAthletePublicProfile('uid-1', { full_name: 'João' }).platform_name).toBe('João');
    expect(buildAthletePublicProfile('uid-1', { email: 'pedro@x.com' }).platform_name).toBe('pedro');
    expect(buildAthletePublicProfile('uid-1', {}).platform_name).toBe('Atleta');
  });

  it('trata data de nascimento ausente com idade nula', () => {
    const result = buildAthletePublicProfile('uid-1', { ...baseProfile, birth_date: '' }, []);
    expect(result.age).toBeNull();
  });

  it('não projeta dados de treinador quando o atleta não se declara treinador', () => {
    const result = buildAthletePublicProfile('uid-1', {
      ...baseProfile,
      coach_bio: 'Aulas de saque',
      coach_price: 'R$ 100',
    });
    expect(result.is_coach).toBe(false);
    expect(result.coach_bio).toBe('');
    expect(result.coach_price).toBe('');
    expect(result.coach_regions).toBe('');
  });

  it('projeta dados de treinador quando is_coach é verdadeiro', () => {
    const result = buildAthletePublicProfile('uid-1', {
      ...baseProfile,
      is_coach: true,
      coach_bio: '  Aulas para iniciantes  ',
      coach_price: 'R$ 80/aula',
      coach_regions: 'Zona Sul, online',
    });
    expect(result.is_coach).toBe(true);
    expect(result.coach_bio).toBe('Aulas para iniciantes');
    expect(result.coach_price).toBe('R$ 80/aula');
    expect(result.coach_regions).toBe('Zona Sul, online');
  });
});
