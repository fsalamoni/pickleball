import { describe, it, expect } from 'vitest';
import { generateGameDayGames, suggestRounds } from './gameDayDraw.js';

function counts(games) {
  const played = new Map();
  const partners = new Map();
  const opps = new Map();
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const g of games) {
    [...g.side_a, ...g.side_b].forEach((p) => played.set(p, (played.get(p) || 0) + 1));
    partners.set(key(...g.side_a), (partners.get(key(...g.side_a)) || 0) + 1);
    partners.set(key(...g.side_b), (partners.get(key(...g.side_b)) || 0) + 1);
    for (const x of g.side_a) for (const y of g.side_b) opps.set(key(x, y), (opps.get(key(x, y)) || 0) + 1);
  }
  return { played, partners, opps };
}

describe('gameDayDraw', () => {
  it('exige no mínimo 4 participantes', () => {
    expect(() => generateGameDayGames(['a', 'b', 'c'])).toThrow();
  });

  it('é determinístico para a mesma seed', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const g1 = generateGameDayGames(ids, { rounds: 5, seed: 's1' });
    const g2 = generateGameDayGames(ids, { rounds: 5, seed: 's1' });
    expect(g1).toEqual(g2);
  });

  it('gera 4 jogadores distintos por jogo', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const games = generateGameDayGames(ids, { rounds: 6, seed: 'x' });
    for (const g of games) {
      const players = [...g.side_a, ...g.side_b];
      expect(new Set(players).size).toBe(4);
    }
  });

  it('funciona com N não múltiplo/condizente do Americano (ex.: 7) equilibrando participação', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const games = generateGameDayGames(ids, { rounds: 7, seed: 'z' });
    const { played } = counts(games);
    const values = ids.map((id) => played.get(id) || 0);
    // Equilíbrio: diferença entre quem mais e quem menos jogou é pequena.
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(2);
  });

  it('prioriza parcerias inéditas antes de repetir (8 jogadores, 7 rodadas)', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `p${i}`);
    const games = generateGameDayGames(ids, { rounds: 7, seed: 'k' });
    const { partners } = counts(games);
    // Com 8 jogadores há 28 duplas possíveis e 7*2 = 14 duplas usadas: deve
    // ser possível não repetir nenhuma dupla.
    const maxPartner = Math.max(...Array.from(partners.values()));
    expect(maxPartner).toBe(1);
  });

  it('suggestRounds retorna valor prático', () => {
    expect(suggestRounds(3)).toBe(0);
    expect(suggestRounds(8)).toBeGreaterThanOrEqual(3);
    expect(suggestRounds(100)).toBeLessThanOrEqual(12);
  });
});
