/**
 * Onde mora a escolha dos cards — o que protege:
 *
 *  1. ⭐ por USUÁRIO: duas pessoas no mesmo navegador não se misturam;
 *  2. a lista vazia é gravada (escolha), e "restaurar" apaga (volta ao padrão);
 *  3. texto ilegível ou de outra versão não quebra nada — vira "nunca escolheu";
 *  4. o retrato é o MESMO objeto enquanto nada muda (exigência do
 *     `useSyncExternalStore`, senão a tela renderiza em laço);
 *  5. quem assina é avisado — nesta aba e quando OUTRA aba muda a escolha;
 *  6. armazenamento bloqueado não lança.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  HOME_CARDS_PREF_ID, homeCardsSnapshot, parseHomeCards, resetHomeCards, saveHomeCards, subscribeHomeCards,
} from './homeCardsPreference.js';

const chave = (uid) => `v2:view:${uid}:${HOME_CARDS_PREF_ID}`;

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('guardar e ler', () => {
  it('grava a lista, na ordem, e lê de volta', () => {
    saveHomeCards('ana', ['ranking', 'jogar']);
    expect(JSON.parse(window.localStorage.getItem(chave('ana')))).toEqual({ v: 1, cards: ['ranking', 'jogar'] });
    expect(homeCardsSnapshot('ana').salvo).toEqual(['ranking', 'jogar']);
  });

  it('⭐ duas pessoas no MESMO navegador não se misturam', () => {
    saveHomeCards('ana', ['ranking']);
    saveHomeCards('bia', ['agenda', 'jogar']);
    expect(homeCardsSnapshot('ana').salvo).toEqual(['ranking']);
    expect(homeCardsSnapshot('bia').salvo).toEqual(['agenda', 'jogar']);
    expect(homeCardsSnapshot('caio').salvo).toBeNull();
  });

  it('⭐ a lista vazia é gravada; restaurar apaga', () => {
    saveHomeCards('ana', []);
    expect(homeCardsSnapshot('ana').salvo).toEqual([]);
    resetHomeCards('ana');
    expect(window.localStorage.getItem(chave('ana'))).toBeNull();
    expect(homeCardsSnapshot('ana').salvo).toBeNull();
  });

  it('texto ilegível, de outra versão ou com card desconhecido não quebra', () => {
    expect(parseHomeCards('{quebrado')).toBeNull();
    expect(parseHomeCards('{"v":9}')).toBeNull();
    expect(parseHomeCards('')).toBeNull();
    expect(parseHomeCards('{"v":1,"cards":["ranking","sumiu"]}')).toEqual(['ranking']);
  });

  it('⭐ o retrato é o mesmo objeto enquanto nada muda', () => {
    saveHomeCards('ana', ['jogar']);
    const a = homeCardsSnapshot('ana');
    expect(homeCardsSnapshot('ana')).toBe(a);
    saveHomeCards('ana', ['ranking']);
    expect(homeCardsSnapshot('ana')).not.toBe(a);
  });

  it('armazenamento bloqueado não lança', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('cota'); });
    expect(() => saveHomeCards('ana', ['jogar'])).not.toThrow();
    expect(saveHomeCards('ana', ['jogar'])).toBe(false);
  });
});

describe('quem assina é avisado', () => {
  it('ao gravar e ao restaurar, nesta aba', () => {
    const fn = vi.fn();
    const sair = subscribeHomeCards(fn);
    saveHomeCards('ana', ['jogar']);
    resetHomeCards('ana');
    expect(fn).toHaveBeenCalledTimes(2);
    sair();
    saveHomeCards('ana', ['ranking']);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('quando OUTRA aba muda a escolha (evento storage)', () => {
    const fn = vi.fn();
    const sair = subscribeHomeCards(fn);
    window.dispatchEvent(new StorageEvent('storage', { key: chave('ana') }));
    expect(fn).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new StorageEvent('storage', { key: 'v2:view:ana:outra-coisa' }));
    expect(fn).toHaveBeenCalledTimes(1);
    sair();
  });

  it('um assinante com defeito não impede os outros', () => {
    const ruim = subscribeHomeCards(() => { throw new Error('defeito'); });
    const fn = vi.fn();
    const sair = subscribeHomeCards(fn);
    saveHomeCards('ana', ['jogar']);
    expect(fn).toHaveBeenCalledTimes(1);
    ruim();
    sair();
  });
});
