/**
 * Guarda de sincronia: o vocabulário do DOMÍNIO precisa bater com o que as
 * regras do Firestore e o schema persistido aceitam.
 *
 * Por que este teste existe: a V2 nasceu com três vocabulários paralelos —
 * `tiers.js` dizia "Regular/Expert/Elite/Lenda", o schema e o
 * `firestore.rules` diziam "Competidor/Craque/Mestre/Lendário", e as skill
 * trees do domínio (`arena/coach/club`) não eram as do schema
 * (`match/mentorship/consistency`). O resultado é que NENHUM usuário acima de
 * 12.000 XP conseguia gravar a progressão, e as trilhas apareciam zeradas.
 *
 * Este teste roda na CI (sem emulador) e quebra na hora em que alguém mexer
 * num lado e esquecer do outro.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { TIER_NAMES, TIERS } from './tiers.js';
import { SKILL_TREE_KEYS, MAX_TREE_LEVEL, toSkillTreeSnapshots } from './skillTrees.js';
import { MAX_LEVEL_V2, levelFromXpV2 } from './progressionV2.js';
import {
  ProgressionV2Schema,
  UserAchievementV2Schema,
  makeEmptyProgressionV2,
} from './progressionV2Schema.js';
import {
  ACHIEVEMENTS_V2,
  ACHIEVEMENT_FAMILY,
  ACHIEVEMENT_RARITY,
} from '@/modules/achievements/domain/achievementsV2.js';

const RULES = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

/** Extrai a lista de tiers declarada em `gamificationTierNames()` nas regras. */
function tierNamesInRules() {
  const fn = RULES.match(/function gamificationTierNames\(\)\s*\{[\s\S]*?\}/);
  if (!fn) return null;
  return [...fn[0].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('sincronia domínio ↔ firestore.rules ↔ schema', () => {
  it('firestore.rules aceita exatamente os tiers do domínio', () => {
    expect(tierNamesInRules()).toEqual([...TIER_NAMES]);
  });

  it('o schema persistido aceita TODOS os tiers que o domínio gera', () => {
    for (const tier of TIER_NAMES) {
      const parsed = ProgressionV2Schema.safeParse({ ...makeEmptyProgressionV2('u1'), tier });
      expect(parsed.success, `tier "${tier}" recusado pelo schema`).toBe(true);
    }
  });

  it('todo tier alcançável por XP real passa pelo schema', () => {
    for (const t of TIERS) {
      const level = levelFromXpV2(t.threshold).level;
      const parsed = ProgressionV2Schema.safeParse({
        ...makeEmptyProgressionV2('u1'), tier: t.name, xpTotal: t.threshold, level,
      });
      expect(parsed.success, `${t.name} (${t.threshold} XP) recusado`).toBe(true);
    }
  });

  it('todo nível alcançável na prática é gravável', () => {
    // A curva (250 * L * (L-1) de XP cumulativo) é a mesma da V1 e não tem
    // teto — o teto é só de sanidade na persistência. 105.000 XP é o caso que
    // estourava o antigo limite de nível 20 e travava o save.
    for (const xp of [0, 500, 95_000, 105_000, 1_000_000, 9_000_000]) {
      const { level } = levelFromXpV2(xp);
      expect(level).toBeLessThanOrEqual(MAX_LEVEL_V2);
      expect(
        ProgressionV2Schema.safeParse({ ...makeEmptyProgressionV2('u1'), level }).success,
        `nível ${level} (${xp} XP) recusado pelo schema`,
      ).toBe(true);
    }
  });

  it('o teto do schema bate com o teto declarado na regra do Firestore', () => {
    expect(RULES).toContain(`request.resource.data.level <= ${MAX_LEVEL_V2}`);
  });

  it('o snapshot de skill trees do domínio é aceito pelo schema', () => {
    const snapshots = toSkillTreeSnapshots({
      tournament: { xp: 5000, level: 4 }, social: { xp: 200, level: 1 },
      arena: { xp: 0, level: 1 }, coach: { xp: 90_000, level: 99 }, club: { xp: 10, level: 1 },
    });
    expect(snapshots).toHaveLength(SKILL_TREE_KEYS.length);
    expect(snapshots.map((s) => s.tree)).toEqual([...SKILL_TREE_KEYS]);
    // nível absurdo é grampeado no teto de sanidade, não recusado
    expect(snapshots.find((s) => s.tree === 'coach').level).toBe(99);
    expect(toSkillTreeSnapshots({ coach: { xp: 1, level: 10_000 } })
      .find((s) => s.tree === 'coach').level).toBe(MAX_TREE_LEVEL);
    expect(ProgressionV2Schema.safeParse({ ...makeEmptyProgressionV2('u1'), skillTrees: snapshots }).success).toBe(true);
  });

  it('as regras exigem a mesma quantidade de trilhas do domínio', () => {
    expect(RULES).toContain(`request.resource.data.skillTrees.size() == ${SKILL_TREE_KEYS.length}`);
  });

  it('o schema de conquista aceita TODA família e raridade do catálogo', () => {
    const base = {
      uid: 'u1', achievementId: 'x', unlockedAt: 1, progress: 1, shareCount: 0, notified: false,
    };
    for (const family of Object.values(ACHIEVEMENT_FAMILY)) {
      for (const rarity of Object.values(ACHIEVEMENT_RARITY)) {
        expect(
          UserAchievementV2Schema.safeParse({ ...base, family, rarity }).success,
          `${family}/${rarity} recusado`,
        ).toBe(true);
      }
    }
  });

  it('toda conquista do catálogo é gravável (família + raridade válidas)', () => {
    for (const a of ACHIEVEMENTS_V2) {
      const parsed = UserAchievementV2Schema.safeParse({
        uid: 'u1', achievementId: a.id, family: a.family, rarity: a.rarity,
        unlockedAt: 1, progress: 1, shareCount: 0, notified: false,
      });
      expect(parsed.success, `conquista "${a.id}" (${a.family}/${a.rarity}) não é gravável`).toBe(true);
    }
  });

  it('o total de conquistas mostrado ao usuário vem do catálogo, não de um número fixo', () => {
    expect(makeEmptyProgressionV2('u1').achievementsTotal).toBe(ACHIEVEMENTS_V2.length);
  });
});
