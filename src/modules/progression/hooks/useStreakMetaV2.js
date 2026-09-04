/**
 * useStreakMetaV2 — hook para estado de streak (grace/freezes/vacation).
 */
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  getOrCreateStreakMeta,
  enableVacation,
  disableVacation,
  consumeFreeze,
  addFreeze,
  watchStreakMeta,
} from '@/modules/progression/services/streakMetaService';

const KEY = (uid) => ['user-streak-meta', uid];

export function useStreakMetaV2(uid, enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: KEY(uid),
    queryFn: async () => getOrCreateStreakMeta(uid),
    enabled: !!uid && enabled,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!uid || !enabled) return undefined;
    const unsub = watchStreakMeta(uid, (data) => {
      if (data) qc.setQueryData(KEY(uid), data);
    });
    return unsub;
  }, [uid, enabled, qc]);

  const vacationMut = useMutation({
    mutationFn: async (on) => (on ? enableVacation(uid) : disableVacation(uid)),
    onSuccess: (data) => qc.setQueryData(KEY(uid), data),
  });

  const freezeMut = useMutation({
    mutationFn: async (action) => (action === 'use' ? consumeFreeze(uid) : addFreeze(uid)),
    onSuccess: (data) => qc.setQueryData(KEY(uid), data),
  });

  return {
    meta: query.data || null,
    isLoading: query.isLoading,
    enableVacation: () => vacationMut.mutate(true),
    disableVacation: () => vacationMut.mutate(false),
    useFreeze: () => freezeMut.mutate('use'),
    addFreeze: () => freezeMut.mutate('add'),
    isMutating: vacationMut.isPending || freezeMut.isPending,
  };
}
