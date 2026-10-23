import { describe, it, expect } from 'vitest';
import { originOf, parseSsoMessage } from './duprSso';

const frame = {};
const ok = { ssoOrigin: 'https://uat.dupr.gg', frameWindow: frame };
const msg = (over = {}) => ({ origin: 'https://uat.dupr.gg', source: frame, data: { userToken: 'a', refreshToken: 'r', duprId: 'abc123' }, ...over });

describe('originOf', () => {
  it('devolve só a origem', () => {
    expect(originOf('https://uat.dupr.gg/login-external-app/xyz')).toBe('https://uat.dupr.gg');
    expect(originOf('lixo')).toBe('');
  });
});

describe('parseSsoMessage', () => {
  it('aceita a mensagem do DUPR vinda do nosso iframe', () => {
    expect(parseSsoMessage(msg(), ok)).toEqual({ accessToken: 'a', refreshToken: 'r', duprId: 'ABC123' });
  });
  it('aceita o corpo como texto JSON', () => {
    expect(parseSsoMessage(msg({ data: JSON.stringify({ userToken: 'a', refreshToken: 'r' }) }), ok)).toEqual({ accessToken: 'a', refreshToken: 'r', duprId: '' });
  });
  it('recusa outra origem e outra janela', () => {
    expect(parseSsoMessage(msg({ origin: 'https://evil.example' }), ok)).toBeNull();
    expect(parseSsoMessage(msg({ source: {} }), ok)).toBeNull();
  });
  it('recusa sem origem esperada, sem iframe ou sem tokens', () => {
    expect(parseSsoMessage(msg(), { ssoOrigin: '', frameWindow: frame })).toBeNull();
    expect(parseSsoMessage(msg(), { ssoOrigin: ok.ssoOrigin, frameWindow: null })).toBeNull();
    expect(parseSsoMessage(msg({ data: { userToken: 'a' } }), ok)).toBeNull();
    expect(parseSsoMessage(msg({ data: 'texto solto' }), ok)).toBeNull();
    expect(parseSsoMessage(msg({ data: null }), ok)).toBeNull();
  });
});
