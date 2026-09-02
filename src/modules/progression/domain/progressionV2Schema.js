/**
 * progressionV2Schema — schema do documento materializado user_progression_v2/{uid}
 *
 * Fonte única de verdade do que é lido/escrito pela V2.
 * Inclui: XP total, tier atual, nível, skill trees, contadores de achievements.
 * Não inclui streak (vai em user_streak_meta/{uid}).
 *
 * Schema versionado: incrementa quando shape muda.
 */
import { z } from 'zod';

export const PROGRESSION_V2_SCHEMA_VERSION = 1;

export const SkillTreeSnapshotSchema = z.object({
  tree: z.enum(['tournament', 'match', 'social', 'mentorship', 'consistency']),
  level: z.number().int().min(0).max(10),
  xp: z.number().int().min(0),
});

export const ProgressionV2Schema = z.object({
  uid: z.string().min(1).max(128),
  schemaVersion: z.literal(PROGRESSION_V2_SCHEMA_VERSION),
  xpTotal: z.number().int().min(0),
  level: z.number().int().min(1).max(20),
  tier: z.enum([
    'Calouro', 'Aprendiz', 'Jogador', 'Competidor', 'Veterano',
    'Craque', 'Mestre', 'Lendário', 'Imortal',
  ]),
  skillTrees: z.array(SkillTreeSnapshotSchema).length(5),
  // contadores (espelham achievementsV2 pra evitar join)
  achievementsUnlocked: z.number().int().min(0),
  achievementsTotal: z.number().int().min(0),
  // auditoria
  source: z.enum(['recomputed', 'incremental', 'seed']),
  updatedAt: z.number().int().min(0),
  createdAt: z.number().int().min(0),
});

export function validateProgressionV2(payload) {
  return ProgressionV2Schema.safeParse(payload);
}

export function makeEmptyProgressionV2(uid) {
  const now = Date.now();
  return {
    uid,
    schemaVersion: PROGRESSION_V2_SCHEMA_VERSION,
    xpTotal: 0,
    level: 1,
    tier: 'Calouro',
    skillTrees: [
      { tree: 'tournament', level: 0, xp: 0 },
      { tree: 'match', level: 0, xp: 0 },
      { tree: 'social', level: 0, xp: 0 },
      { tree: 'mentorship', level: 0, xp: 0 },
      { tree: 'consistency', level: 0, xp: 0 },
    ],
    achievementsUnlocked: 0,
    achievementsTotal: 83,
    source: 'seed',
    updatedAt: now,
    createdAt: now,
  };
}

/** Path no Firestore */
export const progressionV2Path = (uid) => `user_progression_v2/${uid}`;

/** Schema do documento de missões: user_missions/{uid}_{date} */
export const MISSION_DOC_VERSION = 1;

export const UserMissionSchema = z.object({
  uid: z.string(),
  date: z.string(), // 'YYYY-MM-DD' (daily) | 'YYYY-Www' (weekly) | 'YYYY-MM' (monthly)
  scope: z.enum(['daily', 'weekly', 'monthly']),
  missions: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    metric: z.string(),
    target: z.number().int().min(1),
    current: z.number().int().min(0),
    xp: z.number().int().min(0),
    bonus: z.number().int().min(0),
    bonusClaimed: z.boolean(),
    seed: z.number().int(),
  })),
  bonusClaimed: z.boolean(),
  completedAt: z.number().int().min(0).nullable(),
  createdAt: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
});

export const missionDocPath = (uid, date) => `user_missions/${uid}_${date}`;

/** Schema do documento de achievement desbloqueado: user_achievements_v2/{uid}_{achId} */
export const ACHIEVEMENT_DOC_VERSION = 1;

export const UserAchievementV2Schema = z.object({
  uid: z.string(),
  achievementId: z.string(),
  family: z.enum(['tournament', 'match', 'social', 'mentorship', 'consistency']),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
  unlockedAt: z.number().int().min(0),
  progress: z.number().min(0).max(1),
  shareCount: z.number().int().min(0).default(0),
  notified: z.boolean().default(false),
});

export const achievementDocPath = (uid, achId) => `user_achievements_v2/${uid}_${achId}`;

/** Schema do documento de streak meta: user_streak_meta/{uid} */
export const STREAK_META_VERSION = 1;

export const UserStreakMetaSchema = z.object({
  uid: z.string(),
  schemaVersion: z.literal(STREAK_META_VERSION),
  lastPlayAt: z.number().int().min(0).nullable(),
  graceDaysRemaining: z.number().int().min(0).max(3),
  freezesAvailable: z.number().int().min(0).max(3),
  freezesUsed: z.number().int().min(0).max(3),
  vacationMode: z.boolean(),
  vacationStartedAt: z.number().int().min(0).nullable(),
  comebackBonus: z.number().int().min(0).max(500),
  updatedAt: z.number().int().min(0),
});

export const streakMetaPath = (uid) => `user_streak_meta/${uid}`;
