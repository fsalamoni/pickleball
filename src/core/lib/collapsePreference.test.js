import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  collapseStorageKey, readCollapsePreference, writeCollapsePreference, ANON_SCOPE,
} from './collapsePreference.js';

const UID = 'uid-ana';
const OUTRO = 'uid-bruno';

describe('collapseStorageKey', () => {
  it('separa a preferência por usuário', () => {
    expect(collapseStorageKey(UID, 'gameday:games'))
      .not.toBe(collapseStorageKey(OUTRO, 'gameday:games'));
  });

  it('usa o escopo anônimo quando não há usuário', () => {
    expect(collapseStorageKey(null, 'x')).toContain(ANON_SCOPE);
    expect(collapseStorageKey(undefined, 'x')).toBe(collapseStorageKey(null, 'x'));
    expect(collapseStorageKey('', 'x')).toBe(collapseStorageKey(null, 'x'));
  });

  it('sem seção não há o que guardar', () => {
    expect(collapseStorageKey(UID, '')).toBeNull();
    expect(collapseStorageKey(UID, null)).toBeNull();
    expect(collapseStorageKey(UID, undefined)).toBeNull();
  });

  it('é estável entre chamadas (a preferência sobrevive ao recarregar)', () => {
    expect(collapseStorageKey(UID, 'gameday:games')).toBe(collapseStorageKey(UID, 'gameday:games'));
  });
});

describe('ler e salvar', () => {
  beforeEach(() => { window.localStorage.clear(); });

  it('devolve null quando nunca foi salva — quem chama usa o próprio padrão', () => {
    expect(readCollapsePreference(UID, 'gameday:games')).toBeNull();
  });

  it('guarda e devolve os dois estados', () => {
    expect(writeCollapsePreference(UID, 'gameday:games', true)).toBe(true);
    expect(readCollapsePreference(UID, 'gameday:games')).toBe(true);
    writeCollapsePreference(UID, 'gameday:games', false);
    expect(readCollapsePreference(UID, 'gameday:games')).toBe(false);
  });

  it('um usuário não enxerga a preferência do outro no mesmo navegador', () => {
    writeCollapsePreference(UID, 'gameday:games', true);
    expect(readCollapsePreference(OUTRO, 'gameday:games')).toBeNull();
    writeCollapsePreference(OUTRO, 'gameday:games', false);
    expect(readCollapsePreference(UID, 'gameday:games')).toBe(true);
    expect(readCollapsePreference(OUTRO, 'gameday:games')).toBe(false);
  });

  it('seções diferentes do mesmo usuário são independentes', () => {
    writeCollapsePreference(UID, 'gameday:games', true);
    writeCollapsePreference(UID, 'gameday:participants', false);
    expect(readCollapsePreference(UID, 'gameday:games')).toBe(true);
    expect(readCollapsePreference(UID, 'gameday:participants')).toBe(false);
  });

  it('ignora valor corrompido no storage', () => {
    window.localStorage.setItem(collapseStorageKey(UID, 'gameday:games'), 'talvez');
    expect(readCollapsePreference(UID, 'gameday:games')).toBeNull();
  });

  it('sem seção, não grava nada', () => {
    expect(writeCollapsePreference(UID, null, true)).toBe(false);
    expect(window.localStorage.length).toBe(0);
  });
});

describe('storage indisponível (aba anônima, política do navegador)', () => {
  // O `localStorage` do jsdom é um Proxy: espionar a instância não intercepta
  // nada (o teste passaria por acidente). O ponto certo é o protótipo.
  afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

  it('leitura que LANÇA não derruba a tela', () => {
    window.localStorage.setItem(collapseStorageKey(UID, 'gameday:games'), '1');
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readCollapsePreference(UID, 'gameday:games')).toBeNull();
    expect(spy).toHaveBeenCalled();
  });

  it('escrita que LANÇA (cota estourada) não derruba o clique', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(writeCollapsePreference(UID, 'gameday:games', true)).toBe(false);
    expect(spy).toHaveBeenCalled();
  });
});
