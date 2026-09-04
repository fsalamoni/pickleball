/**
 * useUserProgressionV2 — hook que observa o snapshot materializado.
 *
 * Devolve { progression, isLoading, error, refresh }.
 * Usa React Query (consistente com os outros hooks do projeto).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { watchUserProgressionV2, getUserProgressionV2 } from '@/modules/progression/services/progressionV2Service';

const KEY = (uid) => ['user-progression-v2', uid];

export function useUserProgressionV2(uid, enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: KEY(uid),
    queryFn: async () => getUserProgressionV2(uid),
    enabled: !!uid && enabled,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!uid || !enabled) return undefined;
    const unsub = watchUserProgressionV2(uid, (data) => {
      qc.setQueryData(KEY(uid), data);
    });
    return unsub;
  }, [uid, enabled, qc]);

  return {
    progression: query.data || null,
    isLoading: query.isLoading,
    error: query.error,
    refresh: query.refetch,
  };
}
