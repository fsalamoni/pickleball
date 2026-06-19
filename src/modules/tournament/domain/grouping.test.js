import { describe, it, expect } from 'vitest';
import {
  groupLetter,
  computeGroupSizes,
  assignBalancedGroups,
  drawGroups,
  validateGroupBalance,
} from './grouping.js';
import { PHASE_DIVISION_MODE } from './constants.js';

function makeEntrants(n, makeMeta) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    members: [`p${i}`],
    ...(makeMeta ? makeMeta(i) : {}),
  }));
}

describe('groupLetter', () => {
  it('gera A..Z e depois AA, AB', () => {
    expect(groupLetter(0)).toBe('A');
    expect(groupLetter(3)).toBe('D');
    expect(groupLetter(25)).toBe('Z');
    expect(groupLetter(26)).toBe('AA');
    expect(groupLetter(27)).toBe('AB');
  });
});

describe('computeGroupSizes', () => {
  it('grupo único quando SINGLE', () => {
    expect(computeGroupSizes(10, { mode: PHASE_DIVISION_MODE.SINGLE })).toEqual({
      groupCount: 1,
      sizes: [10],
    });
  });

  it('reparte 19 em 4 grupos como [5,5,5,4] (diferença ≤ 1)', () => {
    const { groupCount, sizes } = computeGroupSizes(19, {
      mode: PHASE_DIVISION_MODE.GROUP_COUNT,
      groupCount: 4,
    });
    expect(groupCount).toBe(4);
    expect(sizes).toEqual([5, 5, 5, 4]);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it('MAX_PER_GROUP calcula o menor nº de grupos que respeita o teto', () => {
    // 19 atletas, máx 5 por grupo → 4 grupos
    const { groupCount, sizes } = computeGroupSizes(19, {
      mode: PHASE_DIVISION_MODE.MAX_PER_GROUP,
      maxPerGroup: 5,
    });
    expect(groupCount).toBe(4);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(5);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(19);
  });

  it('nunca cria mais grupos que atletas', () => {
    const { groupCount } = computeGroupSizes(3, {
      mode: PHASE_DIVISION_MODE.GROUP_COUNT,
      groupCount: 8,
    });
    expect(groupCount).toBe(3);
  });
});

describe('assignBalancedGroups — tamanho', () => {
  it('respeita a diferença máxima de 1 atleta', () => {
    const entrants = makeEntrants(19);
    const { sizes } = computeGroupSizes(19, {
      mode: PHASE_DIVISION_MODE.GROUP_COUNT,
      groupCount: 4,
    });
    const groups = assignBalancedGroups(entrants, sizes, { seed: 's' });
    const counts = groups.map((g) => g.entrants.length);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(19);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it('é determinístico dada a seed', () => {
    const entrants = makeEntrants(16, (i) => ({ strength: i % 5 }));
    const sizes = [4, 4, 4, 4];
    const a = assignBalancedGroups(entrants, sizes, { seed: 'x' });
    const b = assignBalancedGroups(entrants, sizes, { seed: 'x' });
    expect(a.map((g) => g.entrants.map((e) => e.id))).toEqual(
      b.map((g) => g.entrants.map((e) => e.id)),
    );
  });
});

describe('assignBalancedGroups — gênero', () => {
  it('equilibra homens e mulheres entre os grupos (diferença ≤ 1 por gênero)', () => {
    // 8 homens + 8 mulheres em 4 grupos → 2M + 2F por grupo idealmente.
    const entrants = [
      ...makeEntrants(8, (i) => ({ gender: 'male', strength: i })),
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `f${i}`,
        members: [`f${i}`],
        gender: 'female',
        strength: i,
      })),
    ];
    const sizes = [4, 4, 4, 4];
    const groups = assignBalancedGroups(entrants, sizes, { seed: 'g' });
    const males = groups.map((g) => g.entrants.filter((e) => e.gender === 'male').length);
    const females = groups.map((g) => g.entrants.filter((e) => e.gender === 'female').length);
    expect(Math.max(...males) - Math.min(...males)).toBeLessThanOrEqual(1);
    expect(Math.max(...females) - Math.min(...females)).toBeLessThanOrEqual(1);
  });
});

describe('assignBalancedGroups — nível (força)', () => {
  it('distribui os fortes entre grupos (força total parelha)', () => {
    // 16 atletas com forças 0..15, 4 grupos de 4. Serpentina → somas próximas.
    const entrants = makeEntrants(16, (i) => ({ strength: i }));
    const sizes = [4, 4, 4, 4];
    const groups = assignBalancedGroups(entrants, sizes, { seed: 'lvl' });
    const totals = groups.map((g) => g.entrants.reduce((s, e) => s + e.strength, 0));
    // soma total 0..15 = 120, média 30 por grupo; serpentina mantém perto.
    totals.forEach((t) => expect(Math.abs(t - 30)).toBeLessThanOrEqual(4));
  });
});

describe('drawGroups + validateGroupBalance', () => {
  it('19 atletas, máx 5 por grupo → grupos válidos', () => {
    const entrants = makeEntrants(19, (i) => ({
      gender: i % 2 === 0 ? 'male' : 'female',
      strength: i % 7,
    }));
    const groups = drawGroups(entrants, {
      mode: PHASE_DIVISION_MODE.MAX_PER_GROUP,
      maxPerGroup: 5,
      seed: 'z',
    });
    expect(validateGroupBalance(groups).valid).toBe(true);
    expect(groups.reduce((s, g) => s + g.entrants.length, 0)).toBe(19);
  });
});
