/**
 * useKudoActions — hook para dar kudos + observar contadores.
 */
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  giveKudo,
  getKudoIndex,
  listKudosReceivedBy,
  listKudosGivenBy,
  watchKudoIndex,
} from '@/modules/progression/services/kudoService';

const INDEX_KEY = (uid) => ['user-kudo-index', uid];
const RECEIVED_KEY = (uid) => ['user-kudos-received', uid];
const GIVEN_KEY = (uid) => ['user-kudos-given', uid];

export function useKudoActions(uid, enabled = true) {
  const qc = useQueryClient();

  const index = useQuery({
    queryKey: INDEX_KEY(uid),
    queryFn: async () => getKudoIndex(uid),
    enabled: !!uid && enabled,
    staleTime: 30_000,
  });
  const received = useQuery({
    queryKey: RECEIVED_KEY(uid),
    queryFn: async () => listKudosReceivedBy(uid, { limit: 20 }),
    enabled: !!uid && enabled,
    staleTime: 30_000,
  });
  const given = useQuery({
    queryKey: GIVEN_KEY(uid),
    queryFn: async () => listKudosGivenBy(uid, { limit: 20 }),
    enabled: !!uid && enabled,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!uid || !enabled) return undefined;
    const unsub = watchKudoIndex(uid, (data) => {
      if (data) qc.setQueryData(INDEX_KEY(uid), data);
    });
    return unsub;
  }, [uid, enabled, qc]);

  const giveMut = useMutation({
    mutationFn: async ({ toUid, type, scope, message, contextId }) => {
      const res = await giveKudo({ fromUid: uid, toUid, type, scope, message, contextId });
      qc.invalidateQueries({ queryKey: INDEX_KEY(uid) });
      qc.invalidateQueries({ queryKey: RECEIVED_KEY(toUid) });
      qc.invalidateQueries({ queryKey: GIVEN_KEY(uid) });
      return res;
    },
  });

  return {
    index: index.data || null,
    received: received.data || [],
    given: given.data || [],
    isLoading: index.isLoading || received.isLoading,
    give: giveMut.mutate,
    isGiving: giveMut.isPending,
    giveError: giveMut.error?.message || null,
  };
}
