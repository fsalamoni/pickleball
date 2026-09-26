/**
 * Os formatos que se pode ESCOLHER (Onda CE).
 *
 * O que protege:
 *  1. ⭐ Mexicano e Rei da Quadra só aparecem com a PRÓPRIA flag — um sem o
 *     outro;
 *  2. ⭐ o formato que o dia JÁ TEM entra sempre, mesmo com a flag desligada
 *     (senão o seletor de um dia existente mostraria outro formato e salvar
 *     trocaria o dia);
 *  3. o seletor de SORTEIO só oferece formatos de grade — e o `current` só
 *     entra nele se também for de grade;
 *  4. a ordem é uma só, em toda tela.
 */
import { describe, it, expect } from 'vitest';
import {
  GAME_DAY_FORMAT as F, gameDayFormatChoices, isFormatChoosable,
} from './gameDayFormats.js';

const TUDO = { mexicano: true, kingOfCourt: true, americanoLive: true };

describe('⭐ as flags decidem o que se pode escolher', () => {
  it('tudo desligado: Americano e Play', () => {
    expect(gameDayFormatChoices()).toEqual([F.AMERICANO, F.PLAY]);
  });

  it('tudo ligado: os cinco, sempre na mesma ordem', () => {
    expect(gameDayFormatChoices({ flags: TUDO })).toEqual([
      F.AMERICANO, F.MEXICANO, F.KING_OF_COURT, F.PLAY, F.AMERICANO_LIVE,
    ]);
  });

  it('⭐ uma flag não arrasta a outra', () => {
    expect(gameDayFormatChoices({ flags: { mexicano: true } })).toEqual([F.AMERICANO, F.MEXICANO, F.PLAY]);
    expect(gameDayFormatChoices({ flags: { kingOfCourt: true } })).toEqual([F.AMERICANO, F.KING_OF_COURT, F.PLAY]);
  });

  it('só `true` liga — "sim", 1 ou undefined não', () => {
    expect(gameDayFormatChoices({ flags: { mexicano: 'sim', kingOfCourt: 1 } })).toEqual([F.AMERICANO, F.PLAY]);
  });
});

describe('⭐ o formato gravado nunca some do seletor do próprio dia', () => {
  it('um dia Mexicano com a flag desligada ainda vê Mexicano', () => {
    expect(gameDayFormatChoices({ current: F.MEXICANO })).toEqual([F.AMERICANO, F.MEXICANO, F.PLAY]);
  });

  it('um dia Rei da Quadra com a flag desligada ainda vê Rei da Quadra', () => {
    expect(gameDayFormatChoices({ current: F.KING_OF_COURT })).toContain(F.KING_OF_COURT);
  });

  it('um dia Americano aprimorado com a flag desligada ainda vê o formato', () => {
    expect(gameDayFormatChoices({ current: F.AMERICANO_LIVE })).toContain(F.AMERICANO_LIVE);
  });

  it('o gravado não duplica quando a flag está ligada', () => {
    const lista = gameDayFormatChoices({ current: F.MEXICANO, flags: TUDO });
    expect(lista.filter((f) => f === F.MEXICANO)).toHaveLength(1);
  });

  it('formato desconhecido gravado não inventa opção', () => {
    expect(gameDayFormatChoices({ current: 'xadrez' })).toEqual([F.AMERICANO, F.PLAY]);
  });
});

describe('o seletor do SORTEIO (só grade)', () => {
  it('sem flags, só o Americano', () => {
    expect(gameDayFormatChoices({ scope: 'draw' })).toEqual([F.AMERICANO]);
  });

  it('com as flags, os três de grade — nunca Play nem Americano aprimorado', () => {
    expect(gameDayFormatChoices({ scope: 'draw', flags: TUDO })).toEqual([F.AMERICANO, F.MEXICANO, F.KING_OF_COURT]);
  });

  it('o dia gravado em Mexicano sorteia em Mexicano mesmo com a flag desligada', () => {
    expect(gameDayFormatChoices({ scope: 'draw', current: F.MEXICANO })).toEqual([F.AMERICANO, F.MEXICANO]);
  });

  it('um `current` que não é de grade não entra no sorteio', () => {
    expect(gameDayFormatChoices({ scope: 'draw', current: F.PLAY })).toEqual([F.AMERICANO]);
  });
});

describe('isFormatChoosable (para quem valida entrada)', () => {
  it('respeita as flags e ignora o gravado', () => {
    expect(isFormatChoosable(F.MEXICANO)).toBe(false);
    expect(isFormatChoosable(F.MEXICANO, { flags: { mexicano: true } })).toBe(true);
    expect(isFormatChoosable(F.AMERICANO)).toBe(true);
  });
});
