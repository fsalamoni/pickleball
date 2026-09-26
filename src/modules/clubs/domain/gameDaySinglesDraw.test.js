/**
 * O Americano de SIMPLES — sorteio de grade 1 × 1 (Onda CF).
 *
 * O que protege:
 *  1. ⭐ todo jogo é 1 × 1 e ninguém joga duas vezes na mesma rodada;
 *  2. ⭐ participação equilibrada: quem menos jogou entra primeiro;
 *  3. ⭐ todos contra todos antes de repetir adversário (n par, sem limite);
 *  4. quadras limitam os jogos por rodada;
 *  5. o sorteio aditivo evita repetir o confronto que já aconteceu;
 *  6. determinístico pela semente; exige 2.
 */
import { describe, it, expect } from 'vitest';
import {
  generateSinglesGames, suggestSinglesRounds, buildDrawHistory,
} from './gameDayDraw.js';

const ids = (n) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const chave = (a, b) => [a, b].sort().join('|');

describe('⭐ generateSinglesGames', () => {
  it('todo jogo é 1 × 1 e ninguém joga duas vezes na mesma rodada', () => {
    const jogos = generateSinglesGames(ids(7), { rounds: 5, seed: 's' });
    jogos.forEach((g) => {
      expect(g.side_a).toHaveLength(1);
      expect(g.side_b).toHaveLength(1);
      expect(g.side_a[0]).not.toBe(g.side_b[0]);
    });
    for (let r = 1; r <= 5; r += 1) {
      const naRodada = jogos.filter((g) => g.round === r).flatMap((g) => [...g.side_a, ...g.side_b]);
      expect(new Set(naRodada).size).toBe(naRodada.length);
    }
  });

  it('⭐ participação equilibrada: a diferença de jogos é no máximo 1', () => {
    const jogos = generateSinglesGames(ids(7), { rounds: 7, seed: 'eq' });
    const conta = new Map();
    jogos.forEach((g) => [...g.side_a, ...g.side_b].forEach((id) => conta.set(id, (conta.get(id) || 0) + 1)));
    const valores = [...conta.values()];
    expect(Math.max(...valores) - Math.min(...valores)).toBeLessThanOrEqual(1);
  });

  it('⭐ com n par e n − 1 rodadas, ninguém repete adversário', () => {
    const jogos = generateSinglesGames(ids(6), { rounds: 5, seed: 'rr' });
    const vistos = new Set(jogos.map((g) => chave(g.side_a[0], g.side_b[0])));
    expect(jogos).toHaveLength(15);
    expect(vistos.size).toBe(15);
  });

  it('quadras limitam os jogos por rodada', () => {
    const jogos = generateSinglesGames(ids(8), { rounds: 3, courts: 2, seed: 'q' });
    for (let r = 1; r <= 3; r += 1) expect(jogos.filter((g) => g.round === r)).toHaveLength(2);
  });

  it('o sorteio aditivo evita o confronto que já aconteceu', () => {
    const jaJogado = [{ side_a: [{ id: 'p1' }], side_b: [{ id: 'p2' }], round: 1, score_a: 11, score_b: 3 }];
    const history = buildDrawHistory(jaJogado, ids(4), { formationGames: jaJogado });
    const jogos = generateSinglesGames(ids(4), { rounds: 1, seed: 'a', history });
    const confrontos = jogos.map((g) => chave(g.side_a[0], g.side_b[0]));
    expect(confrontos).not.toContain('p1|p2');
  });

  it('prefere nível parecido quando não há repetição em jogo', () => {
    const levels = { p1: 5.0, p2: 5.1, p3: 2.5, p4: 2.6 };
    const jogos = generateSinglesGames(ids(4), { rounds: 1, seed: 'n', levels });
    expect(jogos.map((g) => chave(g.side_a[0], g.side_b[0])).sort()).toEqual(['p1|p2', 'p3|p4']);
  });

  it('determinístico pela semente; exige 2 participantes', () => {
    expect(generateSinglesGames(ids(5), { rounds: 3, seed: 'x' })).toEqual(generateSinglesGames(ids(5), { rounds: 3, seed: 'x' }));
    expect(() => generateSinglesGames(['p1'])).toThrow(/no mínimo 2/);
    expect(generateSinglesGames(ids(2), { rounds: 1, seed: 'd' })).toHaveLength(1);
  });
});

describe('suggestSinglesRounds', () => {
  it('n − 1 rodadas (todos contra todos), com piso 3 e teto 12', () => {
    expect(suggestSinglesRounds(1)).toBe(0);
    expect(suggestSinglesRounds(2)).toBe(3);
    expect(suggestSinglesRounds(6)).toBe(5);
    expect(suggestSinglesRounds(20)).toBe(12);
  });

  it('com quadras a menos, escala para manter a média de jogos', () => {
    expect(suggestSinglesRounds(8, 2)).toBeGreaterThan(suggestSinglesRounds(8));
    expect(suggestSinglesRounds(8, 4)).toBe(suggestSinglesRounds(8));
  });
});
