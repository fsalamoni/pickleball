import { describe, it, expect, beforeEach } from 'vitest';
import { CHAVE_VISITAS, deveConvidar, registrarVisita } from './conviteInstalar.js';

describe('deveConvidar', () => {
  it('⭐ nunca na 1ª visita; a partir da 2ª; "agora não" vale 30 dias', () => {
    const agora = Date.parse('2026-10-11T12:00:00Z');
    expect(deveConvidar({ visitas: 1, agora })).toBe(false);
    expect(deveConvidar({ visitas: 2, agora })).toBe(true);
    expect(deveConvidar({ visitas: 5, dispensadoEm: new Date(agora - 10 * 86400000).toISOString(), agora })).toBe(false);
    expect(deveConvidar({ visitas: 5, dispensadoEm: new Date(agora - 31 * 86400000).toISOString(), agora })).toBe(true);
    expect(deveConvidar({ visitas: undefined, agora })).toBe(false);
  });
});

describe('registrarVisita', () => {
  beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
  it('conta uma vez por aba; nova aba conta de novo', () => {
    expect(registrarVisita()).toBe(1);
    expect(registrarVisita()).toBe(1);
    window.sessionStorage.clear();
    expect(registrarVisita()).toBe(2);
    expect(window.localStorage.getItem(CHAVE_VISITAS)).toBe('2');
  });
  it('sem armazenamento, 0 (e o convite não aparece)', () => {
    const quebrado = { getItem() { throw new Error('privado'); }, setItem() {} };
    expect(registrarVisita(quebrado, quebrado)).toBe(0);
  });
});
