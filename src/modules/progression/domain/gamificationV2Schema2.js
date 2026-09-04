/**
 * gamificationV2Schema2 — schemas para sub-sistemas V2 (Fase 16).
 *
 * Coleções:
 *  - user_referral_codes/{uid}: código + métricas
 *  - user_referrals/{refereeUid}: quem indicou
 *  - user_kudos/{kudoId}: kudos dados (com index por uid via kudoId)
 *  - user_kudos_index/{uid}: contadores recebidos/dados
 *  - user_rivals/{pairKey}: par de rivais
 *  - crews/{crewId}: crew
 *  - crew_members/{crewId}_{uid}: membro de crew
 *  - mentorships/{pairKey}: mentoria
 *  - season_rankings/{seasonId}_{uid}: XP sazonal
 *
 * Schema versioning: V2 (string) pra distinguir do "1" do schema V1.
 */
import { z } from 'zod';

export const GAMIFICATION_V2_SCHEMA_VERSION = '2';

// ===== REFERRALS =====

export const REFERRAL_CODE_VERSION = 2;
export const UserReferralCodeSchema = z.object({
  uid: z.string(),
  schemaVersion: z.literal(REFERRAL_CODE_VERSION),
  code: z.string().length(8).regex(/^[A-Z2-9]+$/, 'código sem 0/O/1/I/L'),
  createdAt: z.number().int().min(0),
  totalSignups: z.number().int().min(0),
  totalActivated: z.number().int().min(0), // 5+ jogos
  totalTournaments: z.number().int().min(0), // 1+ torneio
  totalXpEarned: z.number().int().min(0),
  monthlyCount: z.number().int().min(0), // anti-farm: cap 50/mês
  monthKey: z.string(), // YYYY-MM
  updatedAt: z.number().int().min(0),
});

export const referralCodePath = (uid) => `user_referral_codes/${uid}`;

export const REFERRAL_VERSION = 2;
export const UserReferralSchema = z.object({
  refereeUid: z.string(),
  referrerUid: z.string(),
  code: z.string().length(8),
  signedUpAt: z.number().int().min(0),
  activatedAt: z.number().int().min(0).nullable(), // 5+ jogos
  tournamentAt: z.number().int().min(0).nullable(), // 1+ torneio
  xpPaidOut: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
});

export const referralPath = (refereeUid) => `user_referrals/${refereeUid}`;

// ===== KUDOS =====

export const KUDO_VERSION = 2;
export const KudoType = z.enum([
  'sportsmanship', 'clutch', 'mentor', 'teacher', 'positive',
  'resilient', 'teamwork', 'custom',
]);
export const KudoScope = z.enum(['universal', 'match', 'tournament', 'crew', 'rivalry']);

export const UserKudoSchema = z.object({
  kudoId: z.string(),
  fromUid: z.string(),
  toUid: z.string(),
  type: KudoType,
  scope: KudoScope,
  message: z.string().max(280).optional(),
  contextId: z.string().optional(), // matchId, tournamentId, etc
  createdAt: z.number().int().min(0),
  expiresAt: z.number().int().min(0), // para rate limiting diário
});

export const kudoPath = (kudoId) => `user_kudos/${kudoId}`;

export const KUDO_INDEX_VERSION = 2;
export const UserKudoIndexSchema = z.object({
  uid: z.string(),
  schemaVersion: z.literal(KUDO_INDEX_VERSION),
  receivedCount: z.number().int().min(0),
  givenCount: z.number().int().min(0),
  // cap diário (aplicado no service, não no schema)
  receivedToday: z.number().int().min(0).max(100),
  givenToday: z.number().int().min(0).max(50),
  lastKudoDay: z.string(), // YYYY-MM-DD
  updatedAt: z.number().int().min(0),
});

export const kudoIndexPath = (uid) => `user_kudos_index/${uid}`;

// ===== RIVALS =====

export const RIVAL_VERSION = 2;
export const UserRivalSchema = z.object({
  pairKey: z.string(), // sort(uidA,uidB).join('_')
  userA: z.string(),
  userB: z.string(),
  gamesA: z.number().int().min(0),
  gamesB: z.number().int().min(0),
  winsA: z.number().int().min(0),
  winsB: z.number().int().min(0),
  lastGameAt: z.number().int().min(0).nullable(),
  createdAt: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
});

export const rivalPairKey = (uidA, uidB) => {
  const sorted = [uidA, uidB].sort();
  return `${sorted[0]}_${sorted[1]}`;
};

export const rivalPath = (pairKey) => `user_rivals/${pairKey}`;

// ===== CREWS =====

export const CREW_VERSION = 2;
export const CrewSchema = z.object({
  crewId: z.string(),
  schemaVersion: z.literal(CREW_VERSION),
  name: z.string().min(1).max(40),
  description: z.string().max(280).optional(),
  region: z.string().optional(),
  isPublic: z.boolean(),
  createdBy: z.string(),
  membersCount: z.number().int().min(1).max(50),
  totalXp: z.number().int().min(0),
  totalWins: z.number().int().min(0),
  createdAt: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
});

export const crewPath = (crewId) => `crews/${crewId}`;

export const CrewMemberRole = z.enum(['owner', 'captain', 'member']);
export const CREW_MEMBER_VERSION = 2;
export const CrewMemberSchema = z.object({
  crewId: z.string(),
  uid: z.string(),
  role: CrewMemberRole,
  joinedAt: z.number().int().min(0),
  contributionXp: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
});

export const crewMemberPath = (crewId, uid) => `crew_members/${crewId}_${uid}`;

// ===== MENTORSHIPS =====

export const MENTORSHIP_VERSION = 2;
export const MentorshipStatus = z.enum(['active', 'paused', 'completed', 'cancelled']);
export const MentorshipSchema = z.object({
  pairKey: z.string(),
  schemaVersion: z.literal(MENTORSHIP_VERSION),
  mentorUid: z.string(),
  apprenticeUid: z.string(),
  status: MentorshipStatus,
  lessonsCompleted: z.number().int().min(0),
  startedAt: z.number().int().min(0),
  endedAt: z.number().int().min(0).nullable(),
  updatedAt: z.number().int().min(0),
});

export const mentorPairKey = (mentorUid, apprenticeUid) => `${mentorUid}_${apprenticeUid}`;
export const mentorshipPath = (pairKey) => `mentorships/${pairKey}`;

// ===== SEASONS =====

export const SEASON_RANKING_VERSION = 2;
export const SeasonRankingSchema = z.object({
  seasonId: z.string(), // 'YYYY-MM' (temporada mensal)
  uid: z.string(),
  schemaVersion: z.literal(SEASON_RANKING_VERSION),
  /**
   * XP ganho DENTRO da temporada — não o XP de vida inteira. Ranquear por XP
   * acumulado transformaria a temporada numa cópia do Hall da Fama, onde
   * ninguém novo jamais aparece.
   */
  xp: z.number().int().min(0),
  /**
   * XP total do atleta quando a temporada começou para ele. É o que permite
   * calcular o XP da temporada (`xpTotal - baselineXp`) sem manter um livro
   * de eventos. Opcional para compatibilidade com linhas antigas.
   */
  baselineXp: z.number().int().min(0).optional(),
  tier: z.string(),
  position: z.number().int().min(1),
  deltaPosition: z.number().int(), // pode ser negativo
  prizeXp: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
});

export const seasonRankingPath = (seasonId, uid) => `season_rankings/${seasonId}_${uid}`;

// ===== VALIDATE HELPERS =====

export function validateUserReferralCode(p) { return UserReferralCodeSchema.safeParse(p); }
export function validateUserReferral(p) { return UserReferralSchema.safeParse(p); }
export function validateUserKudo(p) { return UserKudoSchema.safeParse(p); }
export function validateUserKudoIndex(p) { return UserKudoIndexSchema.safeParse(p); }
export function validateUserRival(p) { return UserRivalSchema.safeParse(p); }
export function validateCrew(p) { return CrewSchema.safeParse(p); }
export function validateCrewMember(p) { return CrewMemberSchema.safeParse(p); }
export function validateMentorship(p) { return MentorshipSchema.safeParse(p); }
export function validateSeasonRanking(p) { return SeasonRankingSchema.safeParse(p); }
