import { describe, it, expect } from 'vitest';
import {
  seededRng,
  shuffle,
  distributeGroups,
  buildGroupMatches,
  buildRoundRobinMatches,
  buildKnockoutBracket,
  nextPowerOfTwo,
  buildAmericanoRotation,
  generateDraw,
} from './draw.js';

describe('draw engine', () => {
  it('seededRng é determinístico', () => {
    const r1 = seededRng('abc');
    const r2 = seededRng('abc');
    expect(r1()).toBe(r2());
    expect(r1()).toBe(r2());
  });

  it('shuffle preserva todos os elementos', () => {
    const out = shuffle([1, 2, 3, 4, 5], seededRng('s'));
    expect(out.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('distributeGroups balanceia tamanhos', () => {
    const groups = distributeGroups(['a', 'b', 'c', 'd', 'e', 'f', 'g'], { groupCount: 3, seed: 't' });
    const sizes = groups.map((g) => g.participants.length).sort();
    expect(sizes).toEqual([2, 2, 3]);
  });

  it('buildGroupMatches gera todos contra todos', () => {
    const groups = [{ name: 'A', participants: ['p1', 'p2', 'p3'] }];
    const m = buildGroupMatches(groups);
    expect(m).toHaveLength(3);
  });

  it('round-robin com 4 jogadores → 3 rodadas, 6 jogos', () => {
    const m = buildRoundRobinMatches(['a', 'b', 'c', 'd']);
    expect(m).toHaveLength(6);
    const rounds = new Set(m.map((g) => g.round));
    expect(rounds.size).toBe(3);
  });

  it('round-robin com nº ímpar respeita BYE', () => {
    const m = buildRoundRobinMatches(['a', 'b', 'c']);
    expect(m.every((g) => g.side_a !== '__BYE__' && g.side_b !== '__BYE__')).toBe(true);
    // 3 rodadas; em cada rodada um descansa → 1 jogo por rodada → 3 jogos totais
    expect(m).toHaveLength(3);
  });

  it('nextPowerOfTwo', () => {
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(8)).toBe(8);
    expect(nextPowerOfTwo(1)).toBe(1);
  });

  it('buildKnockoutBracket preenche todos slots e gera matches', () => {
    const { slots, matches, totalRounds } = buildKnockoutBracket(['a', 'b', 'c', 'd', 'e'], { seed: 't', seedCount: 2 });
    expect(slots.length).toBe(8);
    expect(matches.length).toBe(4);
    expect(totalRounds).toBe(3);
    const flat = slots.filter(Boolean).sort();
    expect(flat).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('americano: cada par de jogadores joga junto exatamente uma vez (N=4)', () => {
    const matches = buildAmericanoRotation(['a', 'b', 'c', 'd'], { seed: 't' });
    const pairs = new Set();
    matches.forEach((m) => {
      pairs.add([...m.side_a].sort().join('|'));
      pairs.add([...m.side_b].sort().join('|'));
    });
    // C(4,2) = 6 pares possíveis
    expect(pairs.size).toBe(6);
  });

  it('generateDraw entrega estrutura conforme stageType', () => {
    const groupsDraw = generateDraw({ format: 'singles', stageType: 'groups', participants: ['a', 'b', 'c', 'd'], groupCount: 2 });
    expect(groupsDraw.groups).toHaveLength(2);
    expect(groupsDraw.matches.length).toBeGreaterThan(0);

    const koDraw = generateDraw({ format: 'singles', stageType: 'knockout', participants: ['a', 'b', 'c', 'd'] });
    expect(koDraw.bracket).toBeDefined();
    expect(koDraw.matches).toHaveLength(2);
  });
});
