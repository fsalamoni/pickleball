import { describe, it, expect } from 'vitest';
import { LEVEL_TABLE } from '@/modules/leveling/data/levels.js';
import { seedFromLevelOrdinal } from './elo.js';
import { seedFromValidatedLevelId, pickRatingSeed } from './coachSeed.js';

describe('coachSeed', () => {
  it('nível validado conhecido gera a mesma semente do ordinal', () => {
    const mid = LEVEL_TABLE[Math.floor(LEVEL_TABLE.length / 2)];
    const expected = seedFromLevelOrdinal(LEVEL_TABLE.indexOf(mid), LEVEL_TABLE.length);
    expect(seedFromValidatedLevelId(mid.id)).toBe(expected);
    expect(Number.isFinite(seedFromValidatedLevelId(mid.id))).toBe(true);
  });

  it('nível desconhecido / vazio → undefined', () => {
    expect(seedFromValidatedLevelId('nivel_inexistente')).toBeUndefined();
    expect(seedFromValidatedLevelId('')).toBeUndefined();
    expect(seedFromValidatedLevelId(null)).toBeUndefined();
  });

  it('pickRatingSeed prioriza o nível validado sobre o auto-declarado', () => {
    const a = LEVEL_TABLE[0];
    const b = LEVEL_TABLE[LEVEL_TABLE.length - 1];
    const seedValidated = seedFromValidatedLevelId(b.id);
    expect(pickRatingSeed({ validatedLevelId: b.id, selfLevelId: a.id })).toBe(seedValidated);
  });

  it('pickRatingSeed cai no auto-declarado quando não há validado', () => {
    const a = LEVEL_TABLE[1];
    expect(pickRatingSeed({ validatedLevelId: null, selfLevelId: a.id }))
      .toBe(seedFromValidatedLevelId(a.id));
  });
});
