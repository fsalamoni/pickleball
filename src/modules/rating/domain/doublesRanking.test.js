import { describe, it, expect } from 'vitest';
import { pairKey, computeDoublesRanking, compareDoublesRows } from './doublesRanking.js';

describe('pairKey', () => {
  it('é estável independente da ordem', () => {
    expect(pairKey('b', 'a')).toBe(pairKey('a', 'b'));
  });
});

describe('computeDoublesRanking', () => {
  const matches = [
    { side_a: ['a', 'b'], side_b: ['c', 'd'], winner: 'a', points_a: 21, points_b: 15 },
    { side_a: ['a', 'b'], side_b: ['e', 'f'], winner: 'a', points_a: 21, points_b: 10 },
    { side_a: ['c', 'd'], side_b: ['e', 'f'], winner: 'b', points_a: 18, points_b: 21 },
  ];

  it('agrega vitórias/derrotas por parceria', () => {
    const rk = computeDoublesRanking(matches);
    const ab = rk.find((r) => r.pair_key === pairKey('a', 'b'));
    expect(ab.games).toBe(2);
    expect(ab.wins).toBe(2);
    expect(ab.losses).toBe(0);
    expect(ab.win_rate).toBe(1);
    expect(ab.points_for).toBe(42);
    expect(ab.points_against).toBe(25);
    expect(ab.points_balance).toBe(17);
  });

  it('classifica por aproveitamento (dupla ab, 100%, em 1º)', () => {
    const rk = computeDoublesRanking(matches);
    expect(rk[0].pair_key).toBe(pairKey('a', 'b'));
    expect(rk[0].position).toBe(1);
  });

  it('grava a posição em cada linha, na ordem da classificação', () => {
    const rk = computeDoublesRanking(matches);
    expect(rk.map((r) => r.position)).toEqual([1, 2, 3]);
  });

  it('ignora jogos que não são de duplas (2x2)', () => {
    const rk = computeDoublesRanking([
      { side_a: ['a'], side_b: ['b'], winner: 'a' },
      { side_a: ['a', 'b', 'c'], side_b: ['d', 'e', 'f'], winner: 'b' },
    ]);
    expect(rk).toHaveLength(0);
  });

  it('ignora jogos sem vencedor', () => {
    const rk = computeDoublesRanking([{ side_a: ['a', 'b'], side_b: ['c', 'd'], winner: null }]);
    expect(rk).toHaveLength(0);
  });

  it('respeita minGames', () => {
    // ab, cd e ef têm 2 jogos cada; com minGames 3 ninguém passa.
    expect(computeDoublesRanking(matches, { minGames: 3 })).toHaveLength(0);
    const rk2 = computeDoublesRanking(matches, { minGames: 2 });
    expect(rk2).toHaveLength(3);
    expect(rk2[0].pair_key).toBe(pairKey('a', 'b'));
  });
});

/* ---------------------------------------------------------------------------
 * A ORDEM DA CLASSIFICAÇÃO, critério a critério
 *
 * Cada teste isola UM desempate: as duplas comparadas empatam em tudo o que
 * vem antes, para que só o critério em questão possa decidir. É a única forma
 * de provar a ORDEM dos critérios, e não apenas que o resultado "parece certo".
 * ------------------------------------------------------------------------- */
describe('compareDoublesRows — a ordem dos critérios', () => {
  const linha = (pair_key, { win_rate = 0.5, wins = 1, losses = 1, points_balance = 0 }) => ({
    pair_key, win_rate, wins, losses, points_balance,
  });
  /** Ordena e devolve só as chaves, para ler o resultado de relance. */
  const ordem = (linhas) => linhas.slice().sort(compareDoublesRows).map((r) => r.pair_key);

  it('1º critério — APROVEITAMENTO vem antes de tudo, inclusive de mais vitórias', () => {
    // 1 jogo / 1 vitória (100%) × 50 jogos / 45 vitórias (90%).
    const novata = linha('novata', { win_rate: 1, wins: 1, losses: 0, points_balance: 2 });
    const veterana = linha('veterana', { win_rate: 0.9, wins: 45, losses: 5, points_balance: 400 });
    expect(ordem([veterana, novata])).toEqual(['novata', 'veterana']);
  });

  it('2º critério — empate no aproveitamento: decide MAIS VITÓRIAS', () => {
    const poucas = linha('poucas', { win_rate: 0.75, wins: 3, losses: 1, points_balance: 99 });
    const muitas = linha('muitas', { win_rate: 0.75, wins: 30, losses: 10, points_balance: 1 });
    expect(ordem([poucas, muitas])).toEqual(['muitas', 'poucas']);
  });

  it('3º critério — empate em aproveitamento E vitórias: decide MENOS DERROTAS', () => {
    // Mesmo aproveitamento e mesmas vitórias com derrotas diferentes só é
    // possível se o aproveitamento vier de fora; aqui ele é dado, de propósito,
    // para isolar o critério.
    const maisDerrotas = linha('mais-derrotas', { win_rate: 0.6, wins: 6, losses: 4, points_balance: 50 });
    const menosDerrotas = linha('menos-derrotas', { win_rate: 0.6, wins: 6, losses: 2, points_balance: 0 });
    expect(ordem([maisDerrotas, menosDerrotas])).toEqual(['menos-derrotas', 'mais-derrotas']);
  });

  it('4º critério — empate nos três: decide o SALDO DE PONTOS', () => {
    const saldoBaixo = linha('saldo-baixo', { win_rate: 0.5, wins: 5, losses: 5, points_balance: 3 });
    const saldoAlto = linha('saldo-alto', { win_rate: 0.5, wins: 5, losses: 5, points_balance: 40 });
    expect(ordem([saldoBaixo, saldoAlto])).toEqual(['saldo-alto', 'saldo-baixo']);
  });

  it('empate absoluto: a ordem é ESTÁVEL (não muda entre recálculos)', () => {
    const a = linha('aaa', {});
    const b = linha('bbb', {});
    expect(ordem([a, b])).toEqual(['aaa', 'bbb']);
    expect(ordem([b, a])).toEqual(['aaa', 'bbb']);
  });

  it('⭐ o aproveitamento NÃO é mais o segundo critério (regressão da ordem antiga)', () => {
    // Na ordem antiga (vitórias primeiro) a veterana ficava em 1º. Se alguém
    // reverter o comparador sem querer, este teste acusa.
    const rk = computeDoublesRanking([
      // dupla ab: 1 jogo, 1 vitória → 100%
      { side_a: ['a', 'b'], side_b: ['x', 'y'], winner: 'a', points_a: 21, points_b: 19 },
      // dupla cd: 3 jogos, 2 vitórias → 67%, mas mais vitórias que ab
      { side_a: ['c', 'd'], side_b: ['x', 'y'], winner: 'a', points_a: 21, points_b: 5 },
      { side_a: ['c', 'd'], side_b: ['x', 'y'], winner: 'a', points_a: 21, points_b: 5 },
      { side_a: ['c', 'd'], side_b: ['x', 'y'], winner: 'b', points_a: 5, points_b: 21 },
    ]);
    expect(rk[0].pair_key).toBe(pairKey('a', 'b'));
    expect(rk[0].wins).toBe(1);
  });
});
