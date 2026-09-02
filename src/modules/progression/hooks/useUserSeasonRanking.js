/**
 * useUserSeasonRanking — hook que observa o ranking sazonal do user.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  getCurrentSeasonRanking,
  listSeasonTop,
  watchSeasonRanking,
} from '@/modules/progression/services/seasonRankingService';
import { currentSeasonId } from '@/modules/progression/domain/seasons';

const KEY_CURRENT = (uid) => ['user-season-current', uid];
const KEY_TOP = (seasonId) => ['season-top', seasonId];

export function useUserCurrentSeason(uid, enabled = true) {
  const qc = useQueryClient();
  const seasonId = currentSeasonId();
  const query = useQuery({
    queryKey: KEY_CURRENT(uid),
    queryFn: async () => getCurrentSeasonRanking(uid),
    enabled: !!uid && enabled,
    staleTime: 60_000,
  });
  useEffect(() => {
    if (!uid || !enabled) return undefined;
    const unsub = watchSeasonRanking(seasonId, uid, (data) => {
      if (data) qc.setQueryData(KEY_CURRENT(uid), data);
    });
    return unsub;
  }, [uid, enabled, seasonId, qc]);
  return { season: query.data || null, seasonId, isLoading: query.isLoading };
}

export function useSeasonTop({ seasonId, limit: lim = 50, enabled = true } = {}) {
  const id = seasonId || currentSeasonId();
  return useQuery({
    queryKey: KEY_TOP(id),
    queryFn: async () => listSeasonTop({ seasonId: id, limit: lim }),
    enabled,
    staleTime: 5 * 60_000,
  });
}
