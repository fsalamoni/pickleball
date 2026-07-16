import { describe, it, expect } from 'vitest';
import {
  platformUserDisplayName,
  platformUserToPlayerFields,
  filterPlatformAthletes,
} from './adminAthleteRegistration.js';

describe('platformUserDisplayName', () => {
  it('prefere platform_name', () => {
    expect(platformUserDisplayName({ platform_name: 'Ana Lima', full_name: 'Ana', email: 'a@x.com' }))
      .toBe('Ana Lima');
  });

  it('cai para full_name e depois para o usuário do e-mail', () => {
    expect(platformUserDisplayName({ full_name: 'Bruno' })).toBe('Bruno');
    expect(platformUserDisplayName({ email: 'carlos@x.com' })).toBe('carlos');
  });

  it('retorna Atleta quando não há nome nem e-mail', () => {
    expect(platformUserDisplayName({})).toBe('Atleta');
  });
});

describe('platformUserToPlayerFields', () => {
  it('mapeia os campos vinculando o user_id da conta', () => {
    const fields = platformUserToPlayerFields({
      uid: 'u1',
      platform_name: 'Ana Lima',
      email: 'ana@x.com',
      leveling_level: '3.5',
      competition_gender: 'female',
      photo_url: 'http://img/ana.png',
    });
    expect(fields).toEqual({
      user_id: 'u1',
      name: 'Ana Lima',
      email: 'ana@x.com',
      level: '3.5',
      gender: 'female',
      photo_url: 'http://img/ana.png',
    });
  });

  it('deixa nível e gênero vazios quando o perfil está incompleto', () => {
    const fields = platformUserToPlayerFields({ uid: 'u2', platform_name: 'Beto' });
    expect(fields.level).toBe('');
    expect(fields.gender).toBe('');
    expect(fields.user_id).toBe('u2');
  });
});

describe('filterPlatformAthletes', () => {
  const users = [
    { uid: '1', platform_name: 'Ana Lima', email: 'ana@x.com' },
    { uid: '2', platform_name: 'Bruno Souza', email: 'bruno@x.com' },
    { uid: '3', platform_name: 'Ána Costa', email: 'anac@x.com' },
  ];

  it('retorna todos ordenados por nome quando o termo é vazio', () => {
    const out = filterPlatformAthletes(users, '');
    // Ordem alfabética (acento-insensível): "Ána Costa" < "Ana Lima" < "Bruno Souza".
    expect(out.map((u) => u.uid)).toEqual(['3', '1', '2']);
  });

  it('filtra por nome ignorando acentos e caixa', () => {
    const out = filterPlatformAthletes(users, 'ana');
    expect(out.map((u) => u.uid).sort()).toEqual(['1', '3']);
  });

  it('também casa por e-mail', () => {
    const out = filterPlatformAthletes(users, 'bruno@');
    expect(out.map((u) => u.uid)).toEqual(['2']);
  });

  it('respeita o limite informado', () => {
    const out = filterPlatformAthletes(users, '', { limit: 1 });
    expect(out).toHaveLength(1);
  });

  it('não vaza o campo interno _displayName', () => {
    const out = filterPlatformAthletes(users, 'ana');
    expect(out[0]).not.toHaveProperty('_displayName');
  });
});
