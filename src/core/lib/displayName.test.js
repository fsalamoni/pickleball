import { describe, it, expect } from 'vitest';
import { publicDisplayName, emailLocalPart } from './displayName.js';

describe('emailLocalPart', () => {
  it('devolve a parte antes do @', () => {
    expect(emailLocalPart('fernando.salamoni@gmail.com')).toBe('fernando.salamoni');
  });
  it('devolve string vazia para entrada vazia ou nula', () => {
    expect(emailLocalPart('')).toBe('');
    expect(emailLocalPart(null)).toBe('');
    expect(emailLocalPart(undefined)).toBe('');
  });
  it('tolera string sem @', () => {
    expect(emailLocalPart('semarroba')).toBe('semarroba');
  });
  it('remove espaços em volta', () => {
    expect(emailLocalPart('  fulano@x.com ')).toBe('fulano');
  });
  it('limita o tamanho', () => {
    expect(emailLocalPart(`${'a'.repeat(100)}@x.com`)).toHaveLength(60);
  });
});

describe('publicDisplayName', () => {
  it('prefere o nome da plataforma', () => {
    expect(publicDisplayName({
      platformName: 'Fernando S.', fullName: 'Fernando Salamoni',
      displayName: 'F', email: 'fernando@gmail.com',
    })).toBe('Fernando S.');
  });
  it('cai para o nome completo', () => {
    expect(publicDisplayName({ fullName: 'Fernando Salamoni', email: 'f@x.com' }))
      .toBe('Fernando Salamoni');
  });
  it('cai para o displayName do provedor', () => {
    expect(publicDisplayName({ displayName: 'Fernando', email: 'f@x.com' }))
      .toBe('Fernando');
  });
  it('🔴 NUNCA devolve o e-mail completo — só a parte local', () => {
    const out = publicDisplayName({ email: 'fernando.salamoni@gmail.com' });
    expect(out).toBe('fernando.salamoni');
    expect(out).not.toContain('@');
    expect(out).not.toContain('gmail.com');
  });
  it('🔴 nem quando todos os nomes são string vazia', () => {
    const out = publicDisplayName({
      platformName: '', fullName: '   ', displayName: '',
      email: 'alguem@dominio.com.br',
    });
    expect(out).toBe('alguem');
    expect(out).not.toContain('@');
  });
  it('usa o rótulo final quando não há nada', () => {
    expect(publicDisplayName({})).toBe('Atleta');
    expect(publicDisplayName({ email: '' })).toBe('Atleta');
  });
  it('aceita rótulo final personalizado', () => {
    expect(publicDisplayName({ fallback: 'Organizador' })).toBe('Organizador');
  });
  it('ignora espaços em branco nos candidatos', () => {
    expect(publicDisplayName({ platformName: '   ', fullName: 'Ana' })).toBe('Ana');
  });
  it('não quebra sem argumento', () => {
    expect(publicDisplayName()).toBe('Atleta');
  });
});
