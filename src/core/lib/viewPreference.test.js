import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ANON_SCOPE, viewPreferenceKey, readViewPreference, writeViewPreference,
  readNumericPreference,
} from './viewPreference.js';

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('viewPreferenceKey', () => {
  it('inclui o uid no escopo', () => {
    expect(viewPreferenceKey('u1', 'ranking:duplas:min-jogos'))
      .toBe('v2:view:u1:ranking:duplas:min-jogos');
  });

  it('⭐ sem uid, cai no escopo anônimo — nunca numa chave global', () => {
    // Num navegador compartilhado, chave global faria uma pessoa herdar a
    // preferência da outra.
    [null, undefined, '', 0].forEach((uid) => {
      expect(viewPreferenceKey(uid, 'x')).toBe(`v2:view:${ANON_SCOPE}:x`);
    });
  });

  it('sem id não há o que guardar', () => {
    expect(viewPreferenceKey('u1', '')).toBeNull();
    expect(viewPreferenceKey('u1', null)).toBeNull();
    expect(viewPreferenceKey('u1', 42)).toBeNull();
  });

  it('⭐ dois usuários no MESMO navegador não se misturam', () => {
    writeViewPreference('ana', 'min', '10');
    writeViewPreference('bia', 'min', '3');
    expect(readViewPreference('ana', 'min')).toBe('10');
    expect(readViewPreference('bia', 'min')).toBe('3');
  });
});

describe('read/writeViewPreference', () => {
  it('guarda e devolve', () => {
    expect(writeViewPreference('u1', 'min', 10)).toBe(true);
    expect(readViewPreference('u1', 'min')).toBe('10');
  });

  it('nunca salva devolve null (quem chama usa o próprio padrão)', () => {
    expect(readViewPreference('u1', 'nunca-salva')).toBeNull();
  });

  it('⭐ valor vazio APAGA a escolha em vez de gravar vazio', () => {
    writeViewPreference('u1', 'min', 10);
    writeViewPreference('u1', 'min', null);
    expect(readViewPreference('u1', 'min')).toBeNull();
    expect(window.localStorage.getItem('v2:view:u1:min')).toBeNull();
  });

  // ATENÇÃO ao espionar o localStorage: no jsdom ele é um Proxy, e
  // `vi.spyOn(window.localStorage, 'getItem')` NÃO troca o método — grava uma
  // chave chamada "getItem". O teste passa sem exercitar nada. É preciso
  // espionar `Storage.prototype`.
  it('⭐ localStorage indisponível não derruba a tela (leitura)', () => {
    writeViewPreference('u1', 'min', 10); // há valor salvo: só a exceção explica o null
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage bloqueado');
    });
    expect(() => readViewPreference('u1', 'min')).not.toThrow();
    expect(readViewPreference('u1', 'min')).toBeNull();
    expect(spy).toHaveBeenCalled(); // prova que a exceção foi mesmo exercitada
    spy.mockRestore();
  });

  it('⭐ localStorage indisponível não derruba a tela (escrita)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cota estourada');
    });
    expect(() => writeViewPreference('u1', 'min', 10)).not.toThrow();
    expect(writeViewPreference('u1', 'min', 10)).toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('⭐ localStorage indisponível não derruba a tela (apagar)', () => {
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage bloqueado');
    });
    expect(() => writeViewPreference('u1', 'min', null)).not.toThrow();
    expect(writeViewPreference('u1', 'min', null)).toBe(false);
    spy.mockRestore();
  });
});

describe('readNumericPreference', () => {
  const OPCOES = [1, 3, 5, 10, 20];

  it('devolve a escolha salva quando ela é uma das oferecidas', () => {
    writeViewPreference('u1', 'min', 10);
    expect(readNumericPreference('u1', 'min', OPCOES, 1)).toBe(10);
  });

  it('sem escolha salva, devolve o padrão', () => {
    expect(readNumericPreference('u1', 'min', OPCOES, 1)).toBe(1);
  });

  it('⭐ escolha antiga que não é mais oferecida cai no padrão', () => {
    // Uma versão anterior oferecia "7+"; hoje não. O valor guardado não pode
    // ressuscitar como algo que a tela não sabe desenhar.
    writeViewPreference('u1', 'min', 7);
    expect(readNumericPreference('u1', 'min', OPCOES, 1)).toBe(1);
  });

  it('lixo no storage cai no padrão', () => {
    ['abc', '', '{}', 'NaN', '-3', '1e999'].forEach((v) => {
      window.localStorage.setItem('v2:view:u1:min', v);
      expect(readNumericPreference('u1', 'min', OPCOES, 1)).toBe(1);
    });
  });
});
