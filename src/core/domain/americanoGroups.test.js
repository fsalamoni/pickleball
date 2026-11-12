import { describe, it, expect } from 'vitest';
import { AMERICANO_COURT_ROUNDS, americanoCourtMatches, americanoFecha, americanoGroupSizes, splitIntoGroups } from './americanoGroups.js';

const par = (a, b) => [a, b].sort().join('-');

describe('grupos do Americano (núcleo)', () => {
  it('quadra de 4 e de 5: cada um forma dupla com cada outro exatamente uma vez', () => {
    [4, 5].forEach((n) => {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const jogos = americanoCourtMatches(ids);
      const duplas = jogos.flatMap((m) => [par(...m.team_a), par(...m.team_b)]);
      expect(new Set(duplas).size).toBe((n * (n - 1)) / 2);
      expect(duplas).toHaveLength((n * (n - 1)) / 2);
      ids.forEach((id) => {
        const jogou = jogos.filter((m) => [...m.team_a, ...m.team_b].includes(id)).length;
        expect(jogou).toBe(n - 1);
      });
      jogos.forEach((m) => expect(new Set([...m.team_a, ...m.team_b]).size).toBe(4));
    });
    expect(AMERICANO_COURT_ROUNDS[5]).toHaveLength(5);
    expect(americanoCourtMatches(['a', 'b', 'c'])).toEqual([]);
  });

  it('divide pelos tamanhos que fecham, maiores primeiro; 6, 7 e 11 não fecham', () => {
    expect(americanoFecha(9)).toBe(true);
    expect(americanoFecha(6)).toBe(false);
    expect(americanoGroupSizes(8)).toEqual([4, 4]);
    expect(americanoGroupSizes(9)).toEqual([5, 4]);
    expect(americanoGroupSizes(13)).toEqual([5, 4, 4]);
    [3, 6, 7, 11].forEach((n) => expect(americanoGroupSizes(n)).toBeNull());
  });

  it('a conta genérica serve a grupos de 3 a 5 (escada de duplas)', () => {
    expect(splitIntoGroups(7, { sizes: [3, 4, 5], target: 4 })).toEqual([4, 3]);
    expect(splitIntoGroups(5, { sizes: [3, 4, 5], target: 4 })).toEqual([5]);
    expect(splitIntoGroups(2, { sizes: [3, 4, 5], target: 4 })).toBeNull();
  });
});
