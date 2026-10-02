/**
 * useGamificationEngine — o motor do cliente: junta as fontes, compõe o XP, as
 * conquistas, o roteiro de primeiros passos e os marcos, e (com `sync`) grava o
 * que precisa ser gravado. Um lugar só — antes cada tela montava a sua conta, e
 * duas telas diziam números diferentes para a mesma pessoa.
 *
 * ## Quem escreve
 * Só com `sync: true` (o hub, o perfil e a sincronização de fundo do layout).
 * Todas as escritas são idempotentes e do PRÓPRIO dono:
 *  - conquistas ganhas → `user_achievements_v2` (uma vez por id);
 *  - primeiros passos detectados → `prefs.onboarding.done` (só cresce);
 *  - XP/nível/tier → `user_progression_v2` (só quando o resultado muda).
 *
 * ## O que NÃO escreve
 * Nada se grava com fonte faltando: com `stats` ou as fontes de XP em erro ou
 * carregando, o total seria parcial e apareceria como total.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { logger } from '@/core/lib/logger';
import { usePlayerStats } from '@/modules/performance/hooks/usePlayerStats';
import { useNationalRanking, useRatingHistory } from '@/modules/rating/hooks/useRating';
import { usePlayerMatchDates, PLAYER_RECORDS_KEY } from './useProgression';
import { useActivityFacts } from './useActivityFacts';
import { useGamificationPrefs } from './useGamificationPrefs';
import { useGamificationConfig } from './useGamificationConfig';
import { useXpGrants } from './useXpGrants';
import { useMissionXpTotal } from './useMissionXpTotal';
import { useUserProgressionV2 } from './useUserProgressionV2';
import { useUserAchievementsV2 } from '@/modules/achievements/hooks/useUserAchievementsV2';
import { useSyncAchievementsV2 } from '@/modules/achievements/hooks/useSyncAchievementsV2';
import { computeAchievementsV2 } from '@/modules/achievements/domain/achievementsV2';
import { setUserProgressionV2 } from '@/modules/progression/services/progressionV2Service';
import { computeProtectedStreak } from '@/modules/progression/domain/streakProtection';
import { computeTotalXpV2 } from '@/modules/progression/domain/xpTotal';
import { levelFromXpV2 } from '@/modules/progression/domain/progressionV2';
import { tierFromXp, tierProgress } from '@/modules/progression/domain/tiers';
import { buildSkillTrees } from '@/modules/progression/domain/skillTrees';
import { XP_WEIGHTS_V2 } from '@/modules/progression/domain/progressionV2';
import { extractActivityDates } from '@/modules/progression/domain/missionMetrics';
import { achievementUserFromFacts } from '@/modules/progression/domain/activityFacts';
import { evaluateOnboarding, shouldShowOnboarding, daysSinceJoined } from '@/modules/progression/domain/onboarding';
import { reachedMarks } from '@/modules/progression/domain/marks';
import {
  splitAchievements, statsToXpSources, calcProgressionFields, progressionIsCurrent, nextProgressionDoc,
  countUniqueOpponents,
} from '@/modules/progression/domain/gamificationSnapshot';
import { instanteEmMs } from '@/core/domain/instant';

const PROGRESSION_KEY = (uid) => ['user-progression-v2', uid];

/**
 * @param {string} uid
 * @param {{ enabled?: boolean, sync?: boolean }} [opts]
 */
export function useGamificationEngine(uid, { enabled = true, sync = false } = {}) {
  const qc = useQueryClient();
  const { userProfile, user } = useAuth();
  const on = !!uid && enabled;

  const { config, isModuleOn } = useGamificationConfig();
  const statsQ = usePlayerStats();
  const { stats, history, gameDayGames } = statsQ;
  const { data: matchDates = [] } = usePlayerMatchDates(uid, on);
  const { data: ratingHistory = [] } = useRatingHistory(uid, on);
  const { data: ranking = [] } = useNationalRanking();
  const factsQ = useActivityFacts(uid, userProfile, on);
  const prefsQ = useGamificationPrefs(uid, on);
  const grantsQ = useXpGrants(uid, on);
  const missionXpQ = useMissionXpTotal(uid, on);
  const { progression, isLoading: progressionLoading } = useUserProgressionV2(uid, on);
  const { unlocked: persisted, unlockedIds: persistedIds, isLoading: achievementsLoading } = useUserAchievementsV2(uid, on);

  const dates = useMemo(() => extractActivityDates({ history, gameDayGames }), [history, gameDayGames]);
  const allGameDates = useMemo(() => [...matchDates, ...dates.gameDayDates], [matchDates, dates.gameDayDates]);
  const streak = useMemo(() => computeProtectedStreak(allGameDates, { now: new Date() }), [allGameDates]);

  const rating = ratingHistory.length ? Number(ratingHistory[ratingHistory.length - 1].rating) || 0 : 0;
  const position = useMemo(() => {
    const me = ranking.find((p) => p.id === uid || p.uid === uid);
    return me?.position || null;
  }, [ranking, uid]);
  const h2h = qc.getQueryData(PLAYER_RECORDS_KEY(uid));
  const opponents = useMemo(
    () => countUniqueOpponents({ h2hRecords: h2h, gameDayGames }),
    [h2h, gameDayGames],
  );

  // ===== conquistas (com os fatos) =====
  const achievementUser = useMemo(() => {
    const base = {
      uid, rating, stats: { tournaments: stats?.tournaments || 0, played: stats?.played || 0, wins: stats?.wins || 0, podiums: stats?.podiums || 0, titles: stats?.titles || 0 },
      streakWeeks: streak.weeks,
      level: userProfile?.level || userProfile?.leveling_level || null,
      xpTotal: progression?.xpTotal || 0,
      matchDates, gameDayDates: dates.gameDayDates, tournamentDates: dates.tournamentDates,
      opponents, position,
    };
    if (factsQ.facts) return achievementUserFromFacts(factsQ.facts, base);
    // sem fatos ainda: o que já se sabe, sem inventar o resto
    return { uid, rating, stats: base.stats, streak: { weeks: streak.weeks }, level: base.level, position, unique_opponents: opponents };
  }, [uid, rating, stats, streak.weeks, userProfile, progression?.xpTotal, matchDates, dates, opponents, position, factsQ.facts]);

  const achievementsRaw = useMemo(() => computeAchievementsV2(achievementUser), [achievementUser]);
  const achievements = useMemo(() => splitAchievements(achievementsRaw), [achievementsRaw]);

  // ===== XP =====
  const xp = useMemo(() => {
    const { xpTotal, breakdown } = computeTotalXpV2({
      statsSources: statsToXpSources(stats),
      unlockedAchievementIds: persistedIds,
      missionXpTotal: missionXpQ.total,
      missionDocs: missionXpQ.docs,
      onboardingDone: prefsQ.prefs.onboarding?.done,
      grantDocs: grantsQ.grants,
      uid,
    });
    const level = levelFromXpV2(xpTotal);
    return { total: xpTotal, breakdown, level, tier: tierFromXp(xpTotal), tierProgress: tierProgress(xpTotal) };
  }, [stats, persistedIds, missionXpQ.total, missionXpQ.docs, prefsQ.prefs.onboarding?.done, grantsQ.grants, uid]);

  const skillTrees = useMemo(() => buildSkillTrees(statsToXpSources(stats), XP_WEIGHTS_V2).trees, [stats]);

  // ===== primeiros passos =====
  const joinedDays = daysSinceJoined(instanteEmMs(userProfile?.created_at ?? user?.metadata?.creationTime));
  const onboarding = useMemo(() => {
    const state = evaluateOnboarding({
      facts: factsQ.facts,
      done: prefsQ.prefs.onboarding?.done,
      dismissed: prefsQ.prefs.onboarding?.dismissed,
      joinedDays,
    });
    return { ...state, visible: shouldShowOnboarding(state, { joinedDays, activityCount: stats?.played || 0 }) };
  }, [factsQ.facts, prefsQ.prefs.onboarding, joinedDays, stats?.played]);

  // ===== marcos =====
  const marks = useMemo(() => reachedMarks({
    tier: xp.tier.name, level: xp.level.level, games: stats?.played, wins: stats?.wins,
    streakWeeks: streak.weeks, titles: stats?.titles, podiums: stats?.podiums,
  }), [xp.tier.name, xp.level.level, stats, streak.weeks]);

  // Pronto para gravar: nenhuma fonte essencial faltando.
  const ready = !statsQ.isLoading && !statsQ.isError
    && !missionXpQ.isLoading && !missionXpQ.isError
    && !grantsQ.isLoading && !grantsQ.isError
    && prefsQ.loaded && !prefsQ.error
    && !progressionLoading && !achievementsLoading
    && factsQ.facts !== null;

  // ===== escritas (só com sync) =====
  useSyncAchievementsV2(uid, achievements.unlocked, persistedIds, on && sync && ready);

  const onboardingSig = useRef('');
  useEffect(() => {
    if (!on || !sync || !ready || !onboarding.toRecord.length) return;
    const sig = onboarding.toRecord.join(',');
    if (onboardingSig.current === sig) return;
    onboardingSig.current = sig;
    const now = Date.now();
    const done = Object.fromEntries(onboarding.toRecord.map((id) => [id, now]));
    prefsQ.update({ onboarding: { done } }).then((r) => { if (!r) onboardingSig.current = ''; });
  }, [on, sync, ready, onboarding.toRecord, prefsQ]);

  const progressionSig = useRef('');
  useEffect(() => {
    if (!on || !sync || !ready) return;
    const calc = calcProgressionFields({
      xpTotal: xp.total, breakdown: xp.breakdown, stats, unlockedCount: persistedIds.size || achievements.unlockedCount,
    });
    if (progressionIsCurrent(progression, calc)) return;
    const sig = `${uid}|${calc.xpTotal}|${calc.achievementsUnlocked}|${calc.grantsXp}|${calc.xpBreakdown.missions}|${calc.xpBreakdown.onboarding}`;
    if (progressionSig.current === sig) return;
    progressionSig.current = sig;
    (async () => {
      try {
        const next = nextProgressionDoc(uid, progression, calc);
        await setUserProgressionV2(uid, next);
        qc.setQueryData(PROGRESSION_KEY(uid), next);
      } catch (err) {
        progressionSig.current = '';
        logger.warn('[useGamificationEngine] falha ao gravar a progressão', err);
      }
    })();
  }, [on, sync, ready, xp, stats, persistedIds, achievements.unlockedCount, progression, uid, qc]);

  return {
    uid,
    config,
    isModuleOn,
    stats,
    history,
    gameDayGames,
    matchDates,
    dates,
    streak,
    facts: factsQ.facts,
    sources: factsQ.sources,
    prefs: prefsQ.prefs,
    updatePrefs: prefsQ.update,
    prefsLoaded: prefsQ.loaded,
    xp,
    skillTrees,
    progression,
    achievements,
    persistedAchievements: persisted,
    persistedIds,
    onboarding,
    marks,
    rating,
    ratingPoints: ratingHistory,
    position,
    ready,
    isLoading: statsQ.isLoading || factsQ.isLoading,
    isError: statsQ.isError || factsQ.isError,
    refetch: () => { statsQ.refetch(); factsQ.refetch(); },
  };
}
