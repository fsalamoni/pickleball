/**
 * Onde moram as escolhas das dicas — o que protege:
 *  1. ⭐ por USUÁRIO: duas pessoas no mesmo navegador não se misturam;
 *  2. ⭐ as dicas nascem DESLIGADAS;
 *  3. o guia em andamento fica na SESSÃO (recarregar continua; é por conta);
 *  4. listas sem repetição; texto ilegível não quebra;
 *  5. o retrato é o mesmo objeto enquanto nada muda;
 *  6. quem assina é avisado (nesta aba e em outra).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DICAS_PREF, dicasSnapshot, marcarGuiaFeito, marcarPontoVisto, parseGuiaAtivo, parseLista, recomecarPontos,
  setDicasLigadas, setGuiaAtivo, subscribeDicas,
} from './dicasPreference.js';

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('as escolhas', () => {
  it('⭐ nascem desligadas, sem guia, sem nada visto', () => {
    expect(dicasSnapshot('ana')).toEqual({ ligadas: false, feitos: [], vistos: [], guia: null });
  });

  it('⭐ ligar vale só para a conta de quem ligou', () => {
    setDicasLigadas('ana', true);
    expect(dicasSnapshot('ana').ligadas).toBe(true);
    expect(dicasSnapshot('bia').ligadas).toBe(false);
    expect(window.localStorage.getItem(`v2:view:ana:${DICAS_PREF.LIGADAS}`)).toBe('1');
    setDicasLigadas('ana', false);
    expect(dicasSnapshot('ana').ligadas).toBe(false);
  });

  it('guias feitos e pontos vistos acumulam sem repetir; recomeçar esquece os vistos', () => {
    marcarGuiaFeito('ana', 'criar-dia-de-jogo');
    marcarGuiaFeito('ana', 'criar-dia-de-jogo');
    marcarPontoVisto('ana', 'p1');
    marcarPontoVisto('ana', 'p2');
    expect(dicasSnapshot('ana')).toMatchObject({ feitos: ['criar-dia-de-jogo'], vistos: ['p1', 'p2'] });
    recomecarPontos('ana');
    expect(dicasSnapshot('ana')).toMatchObject({ feitos: ['criar-dia-de-jogo'], vistos: [] });
  });

  it('⭐ o guia em andamento fica na sessão, por conta', () => {
    setGuiaAtivo('ana', { id: 'reservar-quadra', passo: 2 });
    expect(dicasSnapshot('ana').guia).toEqual({ id: 'reservar-quadra', passo: 2 });
    expect(dicasSnapshot('bia').guia).toBeNull();
    expect(window.localStorage.length).toBe(0);
    setGuiaAtivo('ana', null);
    expect(dicasSnapshot('ana').guia).toBeNull();
  });

  it('texto ilegível não quebra', () => {
    expect(parseLista('{x')).toEqual([]);
    expect(parseLista('["a","a",3,"b"]')).toEqual(['a', 'b']);
    expect(parseGuiaAtivo('{"id":""}')).toBeNull();
    expect(parseGuiaAtivo('{"id":"g","passo":-2}')).toEqual({ id: 'g', passo: 0 });
    expect(parseGuiaAtivo('nada')).toBeNull();
  });

  it('o retrato é o mesmo objeto enquanto nada muda', () => {
    const a = dicasSnapshot('ana');
    expect(dicasSnapshot('ana')).toBe(a);
    setDicasLigadas('ana', true);
    expect(dicasSnapshot('ana')).not.toBe(a);
  });

  it('armazenamento bloqueado não lança', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('cota'); });
    expect(() => setDicasLigadas('ana', true)).not.toThrow();
    expect(() => setGuiaAtivo('ana', { id: 'g', passo: 1 })).not.toThrow();
  });
});

describe('quem assina é avisado', () => {
  it('nesta aba e quando outra aba muda uma escolha das dicas', () => {
    const fn = vi.fn();
    const sair = subscribeDicas(fn);
    setDicasLigadas('ana', true);
    setGuiaAtivo('ana', { id: 'g' });
    expect(fn).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new StorageEvent('storage', { key: `v2:view:ana:${DICAS_PREF.VISTOS}` }));
    expect(fn).toHaveBeenCalledTimes(3);
    window.dispatchEvent(new StorageEvent('storage', { key: 'v2:view:ana:outra' }));
    expect(fn).toHaveBeenCalledTimes(3);
    sair();
  });
});
