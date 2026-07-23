import { describe, it, expect } from 'vitest';
import { FEATURE_FLAG } from './featureFlags.js';
import {
  FLAG_GROUPS, FLAG_GROUP_OTHER, FLAG_GROUP_ARENA_V3, flagGroupId, bucketAllFlags,
} from './featureFlagGroups.js';

describe('featureFlagGroups', () => {
  it('classifica flags de arena V3 no grupo arena_v3', () => {
    expect(flagGroupId('arena_modules')).toBe(FLAG_GROUP_ARENA_V3.id);
    expect(flagGroupId('arena_module_pdv')).toBe(FLAG_GROUP_ARENA_V3.id);
    expect(flagGroupId('arena_module_iot_sensors')).toBe(FLAG_GROUP_ARENA_V3.id);
  });

  it('classifica flags conhecidas nos grupos certos', () => {
    expect(flagGroupId(FEATURE_FLAG.COACH_LESSONS)).toBe('coaches');
    expect(flagGroupId(FEATURE_FLAG.SHARED_BOOKINGS)).toBe('arenas');
    expect(flagGroupId(FEATURE_FLAG.MULTI_PHASE_TOURNAMENTS)).toBe('tournaments');
  });

  it('bucketAllFlags cobre TODAS as flags sem perder nenhuma', () => {
    const buckets = bucketAllFlags();
    const bucketed = Object.values(buckets).reduce((n, arr) => n + arr.length, 0);
    const total = Object.values(FEATURE_FLAG).length;
    expect(bucketed).toBe(total);
    // cada flag aparece em exatamente um bucket
    const all = Object.values(buckets).flat();
    expect(new Set(all).size).toBe(total);
  });

  it('todo grupo tem id/label e as chaves conhecidas existem em FEATURE_FLAG', () => {
    const valid = new Set(Object.values(FEATURE_FLAG));
    FLAG_GROUPS.forEach((g) => {
      expect(g.id).toBeTruthy();
      expect(g.label).toBeTruthy();
      g.keys.forEach((k) => expect(valid.has(k)).toBe(true));
    });
    expect(FLAG_GROUP_OTHER.id).toBe('other');
  });
});
