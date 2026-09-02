/**
 * useUserReferralCode — hook que lê/cria o código de referral do user.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getOrCreateReferralCode, watchReferralCode } from '@/modules/progression/services/referralService';

const KEY = (uid) => ['user-referral-code', uid];

export function useUserReferralCode(uid, enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: KEY(uid),
    queryFn: async () => getOrCreateReferralCode(uid),
    enabled: !!uid && enabled,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!uid || !enabled) return undefined;
    const unsub = watchReferralCode(uid, (data) => {
      if (data) qc.setQueryData(KEY(uid), data);
    });
    return unsub;
  }, [uid, enabled, qc]);

  return { code: query.data || null, isLoading: query.isLoading };
}
