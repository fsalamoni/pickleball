/**
 * PARIDADE cliente × servidor do PLAYOFF da liga: o tamanho da chave, os
 * cruzamentos da 1ª fase e, fase a fase, quem avança — a tela mostra a chave
 * com que o servidor gera a próxima fase.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import {
  PLAYOFF_SIZES, playoffFirstRound, playoffSize, playoffState,
} from '@/modules/leagues/domain/leaguePlayoff.js';

const require = createRequire(import.meta.url);
const s = require('./leaguePlayoff.js');

/** Joga a chave inteira com placares fixos, comparando os dois lados a cada fase. */
function jogaTudo(ids, size, thirdPlace, sorte) {
  let jogos = playoffFirstRound(ids, size).map((m, i) => ({ ...m, id: `r1-${i}`, phase: 'playoff' }));
  expect(s.playoffFirstRound(ids, size)).toEqual(playoffFirstRound(ids, size));
  for (let volta = 0; volta < 6; volta += 1) {
    jogos = jogos.map((m) => (m.games ? m : { ...m, games: [sorte(m) ? { a: 11, b: 6 } : { a: 7, b: 11 }] }));
    const c = playoffState(jogos, { thirdPlace });
    expect(s.playoffState(jogos, { thirdPlace })).toEqual(c);
    if (c.stage !== 'ready') return c;
    jogos = [...jogos, ...c.next.map((m, i) => ({ ...m, id: `r${m.round}-${i}`, phase: 'playoff' }))];
  }
  throw new Error('a chave não terminou');
}

describe('paridade do playoff', () => {
  it('tamanhos', () => {
    expect(s.PLAYOFF_SIZES).toEqual([...PLAYOFF_SIZES]);
    for (const pedido of [0, 1, 2, 3, 4, 5, 8, 9]) {
      for (let n = 0; n < 12; n += 1) expect(s.playoffSize(pedido, n)).toBe(playoffSize(pedido, n));
    }
  });

  it('a chave inteira, com e sem 3º lugar', () => {
    for (const size of PLAYOFF_SIZES) {
      for (const third of [false, true]) {
        const ids = Array.from({ length: size + 1 }, (_, i) => `e${i + 1}`);
        const fim = jogaTudo(ids, size, third, (m) => (m.seed_a || 0) % 2 === 1 || m.slot === 0);
        expect(fim.stage).toBe('done');
        expect(fim.third != null).toBe(third && size >= 4);
      }
    }
  });

  it('o DreamBreaker decide o vencedor do confronto de equipes nos dois lados', () => {
    const m = { phase: 'playoff', round: 1, slot: 0, side_a: 'x', side_b: 'y', games: [{ a: 21, b: 1 }, { a: 1, b: 21 }], dreambreaker: { a: 15, b: 21 } };
    expect(s.matchWinner(m)).toBe('b');
    expect(s.playoffState([m])).toEqual(playoffState([m]));
    expect(playoffState([m]).champion).toBe('y');
  });
});
