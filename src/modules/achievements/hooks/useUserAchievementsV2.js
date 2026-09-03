/**
 * useUserAchievementsV2 — hook que observa conquistas desbloqueadas no Firestore.
 *
 * Devolve { unlocked, isLoading, error, unlock, markNotified }.
 * Combina com useAchievementsV2 (que calcula o total e combina com rating).
 */
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import {
  listUserAchievementsV2,
  unlockAchievementV2,
  markAchievementNotified,
  incrementAchievementShare,
  watchUserAchievementsV2,
} from '@/modules/achievements/services/achievementsV2Service';

const KEY = (uid) => ['user-achievements-v2', uid];

export function useUserAchievementsV2(uid, enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: KEY(uid),
    queryFn: async () => listUserAchievementsV2(uid),
    enabled: !!uid && enabled,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!uid || !enabled) return undefined;
    const unsub = watchUserAchievementsV2(uid, (data) => {
      qc.setQueryData(KEY(uid), data);
    });
    return unsub;
  }, [uid, enabled, qc]);

  const unlockMut = useMutation({
    mutationFn: async ({ achievementId, family, rarity }) => {
      const res = await unlockAchievementV2(uid, achievementId, family, rarity);
      qc.invalidateQueries({ queryKey: KEY(uid) });
      return res;
    },
  });

  const notifiedMut = useMutation({
    mutationFn: async (achievementId) => markAchievementNotified(uid, achievementId),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(uid) }),
  });

  const shareMut = useMutation({
    mutationFn: async (achievementId) => incrementAchievementShare(uid, achievementId),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(uid) }),
  });

  // Memoizado: sem isso o Set nasce novo a cada render e qualquer efeito que
  // dependa dele (ex.: o sync de conquistas) re-dispara sem parar.
  const unlockedIds = useMemo(
    () => new Set((query.data || []).map((a) => a.achievementId)),
    [query.data],
  );

  return {
    unlocked: query.data || [],
    unlockedIds,
    isLoading: query.isLoading,
    error: query.error,
    unlock: unlockMut.mutate,
    markNotified: notifiedMut.mutate,
    incrementShare: shareMut.mutate,
  };
}
