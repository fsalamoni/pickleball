import { describe, it, expect, vi } from 'vitest';
import { computeCelebrationDiff } from './useCelebrationListener';

describe('computeCelebrationDiff (puro)', () => {
  it('não emite nada se nenhuma missão está completa', () => {
    const seen = { missions: new Set(), achievements: new Set() };
    const missions = [{ id: 'm1', title: 'A', current: 0, target: 1, xp: 10, bonus: 0 }];
    const out = computeCelebrationDiff(seen, missions, []);
    expect(out.newlyCompleted).toEqual([]);
    expect(out.newlyUnlocked).toEqual([]);
  });

  it('emite missão recém-completada', () => {
    const seen = { missions: new Set(), achievements: new Set() };
    const missions = [{ id: 'm1', title: 'A', current: 1, target: 1, xp: 10, bonus: 5 }];
    const out = computeCelebrationDiff(seen, missions, []);
    expect(out.newlyCompleted).toEqual([{ id: 'm1', title: 'A', xp: 10, bonus: 5 }]);
    expect(seen.missions.has('m1')).toBe(true);
  });

  it('idempotente: não re-emite missão já vista', () => {
    const seen = { missions: new Set(['m1']), achievements: new Set() };
    const missions = [{ id: 'm1', title: 'A', current: 1, target: 1, xp: 10, bonus: 5 }];
    const out = computeCelebrationDiff(seen, missions, []);
    expect(out.newlyCompleted).toEqual([]);
  });

  it('emite achievement recém-desbloqueado', () => {
    const seen = { missions: new Set(), achievements: new Set() };
    const out = computeCelebrationDiff(seen, [], [{ achievementId: 'a1', family: 'match', rarity: 'common' }]);
    expect(out.newlyUnlocked).toHaveLength(1);
    expect(out.newlyUnlocked[0].achievementId).toBe('a1');
    expect(seen.achievements.has('a1')).toBe(true);
  });

  it('idempotente: achievement já visto', () => {
    const seen = { missions: new Set(), achievements: new Set(['a1']) };
    const out = computeCelebrationDiff(seen, [], [{ achievementId: 'a1' }]);
    expect(out.newlyUnlocked).toEqual([]);
  });

  it('trata current=null e target=undefined como 0/1', () => {
    const seen = { missions: new Set(), achievements: new Set() };
    const missions = [{ id: 'm1', title: 'A' }]; // sem current/target
    const out = computeCelebrationDiff(seen, missions, []);
    expect(out.newlyCompleted).toEqual([]);
  });

  it('missão com current > target emite só 1x (cap é do emit)', () => {
    const seen = { missions: new Set(), achievements: new Set() };
    const missions = [{ id: 'm1', title: 'A', current: 5, target: 1, xp: 10, bonus: 0 }];
    const out = computeCelebrationDiff(seen, missions, []);
    expect(out.newlyCompleted).toHaveLength(1);
  });
});
