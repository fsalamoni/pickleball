/**
 * useUserMissionsV2 — hook que observa missões diárias.
 * Auto-cria se não existir.
 */
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  getOrCreateDailyMissions,
  progressMission,
  claimDailyBonus,
  watchDailyMissions,
  getMissionsForDate,
} from '@/modules/progression/services/missionService';
import { tierFromXp } from '@/modules/progression/domain/tiers';
import { computeXpV2 } from '@/modules/progression/domain/progressionV2';

const KEY = (uid) => ['user-missions-daily', uid];

export function useUserMissionsV2(uid, currentTierName = 'Calouro', enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: KEY(uid),
    queryFn: async () => {
      if (!uid) return null;
      // tenta ler; se não existir, cria
      const existing = await getMissionsForDate(uid, new Date());
      if (existing) return existing;
      return getOrCreateDailyMissions(uid, currentTierName, new Date());
    },
    enabled: !!uid && enabled,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!uid || !enabled) return undefined;
    const unsub = watchDailyMissions(uid, (data) => {
      if (data) qc.setQueryData(KEY(uid), data);
    });
    return unsub;
  }, [uid, enabled, qc]);

  // mutation: progredir missão
  const progressMut = useMutation({
    mutationFn: async ({ missionId, delta }) => {
      const updated = await progressMission(uid, missionId, delta, new Date());
      qc.setQueryData(KEY(uid), updated);
      return updated;
    },
  });

  // mutation: claim bonus
  const claimMut = useMutation({
    mutationFn: async () => {
      const updated = await claimDailyBonus(uid, new Date());
      qc.setQueryData(KEY(uid), updated);
      return updated;
    },
  });

  return {
    missions: query.data?.missions || [],
    doc: query.data || null,
    isLoading: query.isLoading,
    error: query.error,
    progressMission: progressMut.mutate,
    claimBonus: claimMut.mutate,
    isProgressing: progressMut.isPending,
    isClaiming: claimMut.isPending,
  };
}
