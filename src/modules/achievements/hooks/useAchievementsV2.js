import { useMemo } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { usePlayerStats } from '@/modules/performance/hooks/usePlayerStats';
import { useRatingHistory, useNationalRanking } from '@/modules/rating/hooks/useRating';
import { usePlayerMatchDates } from '@/modules/progression/hooks/useProgression';
import { computeProtectedStreak } from '@/modules/progression/domain/streakProtection';
import { computeAchievementsV2 } from '../domain/achievementsV2.js';

/**
 * Monta o objeto "user" consumido por `computeAchievementsV2`
 * a partir dos hooks existentes (stats, rating, matchDates, ranking).
 *
 * É a mesma lógica de `buildGamificationUser` em V2Achievements, mas
 * isolada aqui pra reuso por hooks e componentes.
 */
function buildGamificationUser({ user, stats, ratingHistory, matchDates, ranking }) {
  const currentRating = ratingHistory && ratingHistory.length > 0
    ? Number(ratingHistory[ratingHistory.length - 1].rating) || 0
    : 0;

  const me = ranking && ranking.length > 0
    ? ranking.find((p) => p.id === user?.uid || p.uid === user?.uid) || null
    : null;

  const streakInfo = computeProtectedStreak(matchDates || [], { now: new Date() });

  return {
    uid: user?.uid,
    rating: currentRating,
    stats: {
      tournaments: stats?.tournaments || 0,
      played: stats?.played || 0,
      wins: stats?.wins || 0,
      podiums: stats?.podiums || 0,
      titles: stats?.titles || 0,
    },
    streak: { weeks: streakInfo.weeks },
    level: user?.level || user?.leveling_level || null,
    position: me?.position || null,
  };
}

/**
 * Hook que retorna o estado completo de conquistas V2 do user logado.
 *
 * Reusa os hooks V1 existentes (usePlayerStats, useRatingHistory, etc)
 * para construir o "user" consumido por `computeAchievementsV2`.
 *
 * **Quando o sistema de eventos de XP/snapshots for implementado** (S+
 * futuro), a montagem do user passa a ler de uma coleção materializada
 * (read-only), sem mudar a API do hook.
 *
 * @param {{ filters?: { family?: string, rarity?: string } }} [options]
 * @returns {{
 *   result: object,        // saída de computeAchievementsV2
 *   isLoading: boolean,
 *   user: object,          // user "gamificado" (intermediário)
 * }}
 */
export function useAchievementsV2(options = {}) {
  const { user } = useAuth();
  const { stats, isLoading: statsLoading } = usePlayerStats();
  const { data: ratingHistory = [], isLoading: ratingLoading } = useRatingHistory(user?.uid, true);
  const { data: matchDates = [], isLoading: datesLoading } = usePlayerMatchDates(user?.uid, true);
  const { data: ranking = [], isLoading: rankingLoading } = useNationalRanking();

  const gamificationUser = useMemo(
    () => buildGamificationUser({ user, stats, ratingHistory, matchDates, ranking }),
    [user, stats, ratingHistory, matchDates, ranking],
  );

  const result = useMemo(
    () => computeAchievementsV2(gamificationUser, {}, options.filters || {}),
    [gamificationUser, options.filters],
  );

  const isLoading = Boolean(
    statsLoading || ratingLoading || datesLoading || rankingLoading,
  );

  return { result, isLoading, user: gamificationUser };
}
