/**
 * Testes para `achievementsV2.js`.
 */

import { describe, it, expect } from 'vitest';
import {
  ACHIEVEMENTS_V2,
  ACHIEVEMENT_FAMILY,
  ACHIEVEMENT_FAMILY_META,
  ACHIEVEMENT_RARITY,
  ACHIEVEMENT_RARITY_META,
  SEASON_KEY,
  currentSeason,
  computeAchievementsV2,
  evaluateAchievement,
  totalAchievementXp,
  getAchievementV2ById,
  listAchievementsByFamily,
  countByRarity,
} from './achievementsV2.js';

describe('achievementsV2 · constantes', () => {
  it('ACHIEVEMENTS_V2 é congelado', () => {
    expect(Object.isFrozen(ACHIEVEMENTS_V2)).toBe(true);
  });

  it('tem ~80 conquistas', () => {
    expect(ACHIEVEMENTS_V2.length).toBeGreaterThanOrEqual(80);
  });

  it('IDs são únicos', () => {
    const ids = ACHIEVEMENTS_V2.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada conquista tem família, raridade, name, description, test', () => {
    for (const a of ACHIEVEMENTS_V2) {
      expect(a.family).toBeTruthy();
      expect(a.rarity).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(a.description).toBeTruthy();
      expect(typeof a.test).toBe('function');
    }
  });

  it('todas as famílias são válidas', () => {
    const validFamilies = new Set(Object.values(ACHIEVEMENT_FAMILY));
    for (const a of ACHIEVEMENTS_V2) {
      expect(validFamilies.has(a.family)).toBe(true);
    }
  });

  it('todas as raridades são válidas', () => {
    const validRarities = new Set(Object.values(ACHIEVEMENT_RARITY));
    for (const a of ACHIEVEMENTS_V2) {
      expect(validRarities.has(a.rarity)).toBe(true);
    }
  });
});

describe('achievementsV2 · famílias e raridades', () => {
  it('FAMILY_META tem 5 famílias', () => {
    expect(Object.keys(ACHIEVEMENT_FAMILY_META)).toHaveLength(5);
  });

  it('RARITY_META tem 5 raridades em ordem', () => {
    const rarities = Object.values(ACHIEVEMENT_RARITY);
    expect(rarities).toHaveLength(5);
    expect(ACHIEVEMENT_RARITY_META[ACHIEVEMENT_RARITY.COMMON].order).toBe(1);
    expect(ACHIEVEMENT_RARITY_META[ACHIEVEMENT_RARITY.LEGENDARY].order).toBe(5);
  });

  it('countByRarity retorna contagem correta', () => {
    const c = countByRarity();
    expect(c.common).toBeGreaterThan(0);
    expect(c.legendary).toBeGreaterThan(0);
    // Total deve bater com o tamanho do array
    const total = Object.values(c).reduce((s, n) => s + n, 0);
    expect(total).toBe(ACHIEVEMENTS_V2.length);
  });
});

describe('achievementsV2 · currentSeason', () => {
  it('janeiro = summer', () => {
    expect(currentSeason(new Date(2026, 0, 15))).toBe(SEASON_KEY.SUMMER);
  });
  it('abril = autumn', () => {
    expect(currentSeason(new Date(2026, 3, 15))).toBe(SEASON_KEY.AUTUMN);
  });
  it('julho = winter', () => {
    expect(currentSeason(new Date(2026, 6, 15))).toBe(SEASON_KEY.WINTER);
  });
  it('novembro = spring', () => {
    expect(currentSeason(new Date(2026, 10, 15))).toBe(SEASON_KEY.SPRING);
  });
});

describe('achievementsV2 · evaluateAchievement', () => {
  it('boolean true = unlocked', () => {
    const def = {
      id: 'test',
      family: 'career',
      rarity: 'common',
      test: () => true,
    };
    const r = evaluateAchievement(def, {});
    expect(r.unlocked).toBe(true);
    expect(r.progress).toBe(1);
  });

  it('boolean false = locked', () => {
    const def = {
      id: 'test',
      family: 'career',
      rarity: 'common',
      test: () => false,
    };
    const r = evaluateAchievement(def, {});
    expect(r.unlocked).toBe(false);
    expect(r.progress).toBe(0);
  });

  it('objeto com progress 0-1', () => {
    const def = {
      id: 'test',
      family: 'career',
      rarity: 'common',
      test: () => ({ unlocked: false, progress: 0.5 }),
    };
    const r = evaluateAchievement(def, {});
    expect(r.unlocked).toBe(false);
    expect(r.progress).toBe(0.5);
  });

  it('clamp progress para [0, 1]', () => {
    const def = {
      id: 'test',
      family: 'career',
      rarity: 'common',
      test: () => ({ unlocked: true, progress: 2.5 }),
    };
    const r = evaluateAchievement(def, {});
    expect(r.progress).toBe(1);
  });

  it('lida com def sem test', () => {
    const r = evaluateAchievement({ id: 'a' }, {});
    expect(r.unlocked).toBe(false);
    expect(r.reason).toBeTruthy();
  });
});

describe('achievementsV2 · computeAchievementsV2 (cenário Flávio)', () => {
  const flavio = {
    uid: 'flavio',
    stats: {
      tournaments: 8,
      played: 142,
      wins: 66,
      podiums: 1,
      titles: 0,
    },
    rating: 1023,
    streak: { weeks: 2 },
    level: 'intermediario_plus',
  };

  it('retorna estrutura esperada', () => {
    const r = computeAchievementsV2(flavio);
    expect(r).toHaveProperty('unlocked');
    expect(r).toHaveProperty('locked');
    expect(r).toHaveProperty('total');
    expect(r).toHaveProperty('unlockedCount');
    expect(r).toHaveProperty('byFamily');
    expect(r).toHaveProperty('byRarity');
    expect(r.total).toBe(ACHIEVEMENTS_V2.length);
  });

  it('Flavio tem várias conquistas desbloqueadas', () => {
    const r = computeAchievementsV2(flavio);
    // bem-vindo, 1 torneio, 1 vitória, 1 pódio, 10 wins, 25 games, 50 wins...
    expect(r.unlockedCount).toBeGreaterThan(5);
  });

  it('Flavio NÃO tem rating 1100+ (rating 1023)', () => {
    const r = computeAchievementsV2(flavio);
    const found = r.locked.find((a) => a.id === 'career_rating_1100');
    expect(found).toBeTruthy();
  });

  it('Filtro por família funciona', () => {
    const r = computeAchievementsV2(flavio, {}, { family: ACHIEVEMENT_FAMILY.CAREER });
    expect(r.unlocked.every((a) => a.family === ACHIEVEMENT_FAMILY.CAREER)).toBe(true);
  });

  it('Filtro por raridade funciona', () => {
    const r = computeAchievementsV2(flavio, {}, { rarity: ACHIEVEMENT_RARITY.LEGENDARY });
    expect(r.locked.every((a) => a.rarity === ACHIEVEMENT_RARITY.LEGENDARY)).toBe(true);
  });

  it('byFamily conta corretamente', () => {
    const r = computeAchievementsV2(flavio);
    expect(r.byFamily.career.total).toBeGreaterThan(20);
    expect(r.byFamily.social.total).toBeGreaterThan(10);
  });
});

describe('achievementsV2 · totalAchievementXp', () => {
  it('soma XP bônus das desbloqueadas', () => {
    const user = {
      stats: { played: 200, wins: 200, podiums: 5, titles: 1, tournaments: 30 },
      rating: 1100,
    };
    const xp = totalAchievementXp(user);
    // desbloqueia 1 título (50) + 100 wins (100) + 100 jogos (200) + 10 pódios (??) + rating 1100 (0)
    // sem contar épicos/lendários porque user não chegou lá
    expect(xp).toBeGreaterThan(0);
  });

  it('retorna 0 para user zerado', () => {
    expect(totalAchievementXp({})).toBe(0);
  });
});

describe('achievementsV2 · getAchievementV2ById / listAchievementsByFamily', () => {
  it('getAchievementV2ById encontra por ID', () => {
    const a = getAchievementV2ById('career_first_win');
    expect(a.name).toBe('Primeira vitória');
  });

  it('getAchievementV2ById retorna null para inexistente', () => {
    expect(getAchievementV2ById('nope')).toBeNull();
  });

  it('listAchievementsByFamily filtra', () => {
    const list = listAchievementsByFamily(ACHIEVEMENT_FAMILY.CAREER);
    expect(list.every((a) => a.family === ACHIEVEMENT_FAMILY.CAREER)).toBe(true);
    expect(list.length).toBeGreaterThan(20);
  });
});
