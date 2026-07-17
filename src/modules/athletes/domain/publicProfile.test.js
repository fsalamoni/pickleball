import { describe, it, expect } from 'vitest';
import { buildAthletePublicProfile, filterEmptyStringFields } from './publicProfile.js';

describe('filterEmptyStringFields', () => {
  it('remove strings vazias', () => {
    expect(filterEmptyStringFields({ a: 'x', b: '', c: 'y' })).toEqual({ a: 'x', c: 'y' });
  });

  it('remove undefined (mantém null, false, 0)', () => {
    expect(filterEmptyStringFields({ a: 0, b: false, c: null, d: undefined, e: '' }))
      .toEqual({ a: 0, b: false, c: null });
  });

  it('retorna {} para payload vazio ou inválido', () => {
    expect(filterEmptyStringFields({})).toEqual({});
    expect(filterEmptyStringFields(null)).toEqual({});
    expect(filterEmptyStringFields(undefined)).toEqual({});
  });

  it('preserva chaves com valor 0 (não confunde com ausente)', () => {
    const out = filterEmptyStringFields({ age: 0, name: '' });
    expect(out).toEqual({ age: 0 });
  });

  it('preserva arrays e objetos aninhados', () => {
    const out = filterEmptyStringFields({ clubs: [], meta: { x: 1 }, name: '' });
    expect(out).toEqual({ clubs: [], meta: { x: 1 } });
  });
});

describe('buildAthletePublicProfile — regressão de campos vazios', () => {
  // Regressão: o syncAthleteProfile NÃO pode sobrescrever a foto do atleta
  // com string vazia. O `buildAthletePublicProfile` pode retornar '' para
  // sinalizar "ausência", mas o `sync` filtra antes do setDoc.
  it('photo_url vazia quando profile.photo_url é undefined (caso do bug)', () => {
    const out = buildAthletePublicProfile('uid-1', { platform_name: 'Fulano' });
    expect(out.photo_url).toBe('');
    expect(out.platform_name).toBe('Fulano');
  });

  it('photo_url preservado quando profile.photo_url é string válida', () => {
    const url = 'https://example.com/photo.png';
    const out = buildAthletePublicProfile('uid-1', { photo_url: url });
    expect(out.photo_url).toBe(url);
  });

  it('platform_name cai pro email quando tudo é vazio (UX fallback)', () => {
    const out = buildAthletePublicProfile('uid-1', { email: 'fulano@example.com' });
    expect(out.platform_name).toBe('fulano'); // parte antes do @
  });

  it('platform_name cai pro "Atleta" quando não há nada', () => {
    const out = buildAthletePublicProfile('uid-1', {});
    expect(out.platform_name).toBe('Atleta');
  });

  it('campos de privacidade (phone/email/address) só saem com opt-in explícito', () => {
    const out = buildAthletePublicProfile('uid-1', {
      platform_name: 'Fulano',
      phone: '51999999999',
      email: 'fulano@example.com',
      address: 'Rua X',
    });
    // Por padrão, opt-out: campos vazios
    expect(out.phone).toBe('');
    expect(out.email).toBe('');
    expect(out.address).toBe('');
    expect(out.phone_public).toBe(false);
    expect(out.email_public).toBe(false);
    expect(out.address_public).toBe(false);
  });

  it('campos de privacidade saem com opt-in', () => {
    const out = buildAthletePublicProfile('uid-1', {
      platform_name: 'Fulano',
      phone: '51999999999',
      email: 'fulano@example.com',
      address: 'Rua X',
      phone_public: true,
      email_public: true,
      address_public: true,
    });
    expect(out.phone).toBe('51999999999');
    expect(out.email).toBe('fulano@example.com');
    expect(out.address).toBe('Rua X');
  });
});
