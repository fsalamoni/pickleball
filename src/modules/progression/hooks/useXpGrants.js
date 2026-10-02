/** useXpGrants — o XP que o servidor concedeu à pessoa logada. */
import { useQuery } from '@tanstack/react-query';
import { listXpGrants } from '@/modules/progression/services/xpGrantService';

export const XP_GRANTS_KEY = (uid) => ['user-xp-grants', uid];

export function useXpGrants(uid, enabled = true) {
  const query = useQuery({
    queryKey: XP_GRANTS_KEY(uid),
    queryFn: () => listXpGrants(uid),
    enabled: !!uid && enabled,
    staleTime: 60_000,
  });
  return { grants: query.data || [], isLoading: query.isLoading, isError: query.isError, refetch: query.refetch };
}
