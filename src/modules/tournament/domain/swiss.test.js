import { describe, it, expect } from 'vitest';
import { pairSwissRound, recommendedSwissRounds } from './swiss.js';

describe('swiss pairing', () => {
  it('recomenda log2(N) rodadas', () => {
    expect(recommendedSwissRounds(8)).toBe(3);
    expect(recommendedSwissRounds(16)).toBe(4);
    expect(recommendedSwissRounds(20)).toBe(5);
  });

  it('rodada 1: pareia participantes em pares com seed determinística', () => {
    const standings = Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, points: 0 }));
    const a = pairSwissRound(standings, [], { round: 1, seed: 's' });
    const b = pairSwissRound(standings, [], { round: 1, seed: 's' });
    expect(a.pairings).toEqual(b.pairings);
    expect(a.pairings.length).toBe(4);
    expect(a.byeId).toBeNull();
  });

  it('atribui BYE ao último colocado quando número é ímpar', () => {
    const standings = [
      { id: 'a', points: 3 },
      { id: 'b', points: 2 },
      { id: 'c', points: 2 },
      { id: 'd', points: 1 },
      { id: 'e', points: 0 },
    ];
    const r = pairSwissRound(standings, [], { round: 2 });
    expect(r.byeId).toBe('e');
    expect(r.pairings.find((p) => p.bye)).toBeDefined();
  });

  it('evita repetir confrontos anteriores', () => {
    const standings = Array.from({ length: 4 }, (_, i) => ({ id: `p${i + 1}`, points: i }));
    const past = [['p1', 'p2'], ['p3', 'p4']];
    const r = pairSwissRound(standings, past, { round: 2 });
    const sides = r.pairings.map((p) => [p.side_a, p.side_b].sort().join('|'));
    expect(sides).not.toContain('p1|p2');
    expect(sides).not.toContain('p3|p4');
  });

  it('agrupa por pontuação ao parear (rounds > 1)', () => {
    const standings = [
      { id: 'a', points: 2 },
      { id: 'b', points: 2 },
      { id: 'c', points: 1 },
      { id: 'd', points: 1 },
      { id: 'e', points: 0 },
      { id: 'f', points: 0 },
    ];
    const r = pairSwissRound(standings, [], { round: 2 });
    // Espera-se que pares respeitem score groups quando possível.
    const pair0 = [r.pairings[0].side_a, r.pairings[0].side_b].sort();
    expect(pair0).toEqual(['a', 'b']);
  });
});
