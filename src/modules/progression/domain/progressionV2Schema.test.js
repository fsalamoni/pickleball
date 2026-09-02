import { describe, it, expect } from 'vitest';
import {
  PROGRESSION_V2_SCHEMA_VERSION,
  ProgressionV2Schema,
  makeEmptyProgressionV2,
  validateProgressionV2,
  UserMissionSchema,
  UserAchievementV2Schema,
  UserStreakMetaSchema,
  progressionV2Path,
  missionDocPath,
  achievementDocPath,
  streakMetaPath,
} from './progressionV2Schema';

describe('progressionV2Schema', () => {
  it('progressões válidas passam', () => {
    const ok = makeEmptyProgressionV2('u1');
    expect(validateProgressionV2(ok).success).toBe(true);
  });

  it('schemaVersion diferente falha', () => {
    const bad = { ...makeEmptyProgressionV2('u1'), schemaVersion: 999 };
    expect(validateProgressionV2(bad).success).toBe(false);
  });

  it('tier inválido falha', () => {
    const bad = { ...makeEmptyProgressionV2('u1'), tier: 'Imperador' };
    expect(validateProgressionV2(bad).success).toBe(false);
  });

  it('skillTrees deve ter 5 entries', () => {
    const bad = {
      ...makeEmptyProgressionV2('u1'),
      skillTrees: [{ tree: 'tournament', level: 0, xp: 0 }],
    };
    expect(validateProgressionV2(bad).success).toBe(false);
  });

  it('xp negativo falha', () => {
    const bad = { ...makeEmptyProgressionV2('u1'), xpTotal: -1 };
    expect(validateProgressionV2(bad).success).toBe(false);
  });

  it('uid vazio falha', () => {
    const bad = { ...makeEmptyProgressionV2('') };
    expect(validateProgressionV2(bad).success).toBe(false);
  });

  it('makeEmptyProgressionV2 tem Calouro e todas as árvores zeradas', () => {
    const empty = makeEmptyProgressionV2('u1');
    expect(empty.tier).toBe('Calouro');
    expect(empty.xpTotal).toBe(0);
    expect(empty.level).toBe(1);
    expect(empty.skillTrees).toHaveLength(5);
    empty.skillTrees.forEach((t) => {
      expect(t.level).toBe(0);
      expect(t.xp).toBe(0);
    });
  });
});

describe('progressionV2Schema · paths', () => {
  it('progressionV2Path', () => {
    expect(progressionV2Path('abc')).toBe('user_progression_v2/abc');
  });
  it('missionDocPath', () => {
    expect(missionDocPath('abc', '2026-09-02')).toBe('user_missions/abc_2026-09-02');
  });
  it('achievementDocPath', () => {
    expect(achievementDocPath('abc', 'first_blood')).toBe('user_achievements_v2/abc_first_blood');
  });
  it('streakMetaPath', () => {
    expect(streakMetaPath('abc')).toBe('user_streak_meta/abc');
  });
});

describe('progressionV2Schema · missões', () => {
  it('missão válida', () => {
    const ok = {
      uid: 'u1',
      date: '2026-09-02',
      scope: 'daily',
      missions: [{
        id: 'm1', title: 'Jogue 1 partida', description: 'Jogue 1 partida',
        metric: 'game_played', target: 1, current: 0, xp: 30, bonus: 15,
        bonusClaimed: false, seed: 12345,
      }],
      bonusClaimed: false,
      completedAt: null,
      createdAt: 1, updatedAt: 1,
    };
    expect(UserMissionSchema.safeParse(ok).success).toBe(true);
  });

  it('missão com current > target ainda é válida (overflow)', () => {
    const ok = {
      uid: 'u1', date: '2026-09-02', scope: 'daily',
      missions: [{
        id: 'm1', title: 't', description: 't', metric: 'm',
        target: 1, current: 5, xp: 30, bonus: 15, bonusClaimed: false, seed: 1,
      }],
      bonusClaimed: false, completedAt: null, createdAt: 1, updatedAt: 1,
    };
    expect(UserMissionSchema.safeParse(ok).success).toBe(true);
  });
});

describe('progressionV2Schema · achievements', () => {
  it('achievement comum', () => {
    const ok = {
      uid: 'u1', achievementId: 'first_blood', family: 'match',
      rarity: 'common', unlockedAt: Date.now(), progress: 1, shareCount: 0, notified: false,
    };
    expect(UserAchievementV2Schema.safeParse(ok).success).toBe(true);
  });
  it('progress fora de [0,1] falha', () => {
    const bad = {
      uid: 'u1', achievementId: 'x', family: 'match', rarity: 'common',
      unlockedAt: 1, progress: 1.5, shareCount: 0, notified: false,
    };
    expect(UserAchievementV2Schema.safeParse(bad).success).toBe(false);
  });
});

describe('progressionV2Schema · streak meta', () => {
  it('válido padrão', () => {
    const ok = {
      uid: 'u1', schemaVersion: 1, lastPlayAt: null,
      graceDaysRemaining: 3, freezesAvailable: 3, freezesUsed: 0,
      vacationMode: false, vacationStartedAt: null, comebackBonus: 0,
      updatedAt: 1,
    };
    expect(UserStreakMetaSchema.safeParse(ok).success).toBe(true);
  });
  it('graceDaysRemaining > 3 falha', () => {
    const bad = {
      uid: 'u1', schemaVersion: 1, lastPlayAt: null,
      graceDaysRemaining: 99, freezesAvailable: 3, freezesUsed: 0,
      vacationMode: false, vacationStartedAt: null, comebackBonus: 0,
      updatedAt: 1,
    };
    expect(UserStreakMetaSchema.safeParse(bad).success).toBe(false);
  });
});
