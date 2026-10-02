/**
 * Hooks de recompensas e pedidos.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelClaim, createReward, decideClaim, deleteReward, listClaimsByIssuer, listMyClaims, listRewards,
  listRewardsByIssuer, requestReward, updateReward,
} from '@/modules/progression/services/rewardService';

const ALL_KEY = ['gamification-rewards'];
const CLAIMS_KEY = (uid) => ['gamification-claims', uid];
const ISSUER_REWARDS = (t, id) => ['gamification-rewards', 'issuer', t, id];
const ISSUER_CLAIMS = (t, id) => ['gamification-claims', 'issuer', t, id];

export function useRewards(enabled = true) {
  const q = useQuery({ queryKey: ALL_KEY, queryFn: listRewards, enabled, staleTime: 60_000 });
  return { rewards: q.data || [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export function useMyClaims(uid, enabled = true) {
  const q = useQuery({ queryKey: CLAIMS_KEY(uid), queryFn: () => listMyClaims(uid), enabled: !!uid && enabled, staleTime: 30_000 });
  return { claims: q.data || [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export function useClaimActions(uid) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: CLAIMS_KEY(uid) });
  const request = useMutation({ mutationFn: requestReward, onSuccess: refresh });
  const cancel = useMutation({ mutationFn: cancelClaim, onSuccess: refresh });
  return { request, cancel };
}

/** As recompensas e a fila de pedidos de um emissor. */
export function useIssuerRewards(issuer, actor, enabled = true) {
  const qc = useQueryClient();
  const on = !!issuer?.type && !!issuer?.id && enabled;
  const rewardsQ = useQuery({ queryKey: ISSUER_REWARDS(issuer?.type, issuer?.id), queryFn: () => listRewardsByIssuer(issuer.type, issuer.id), enabled: on, staleTime: 30_000 });
  const claimsQ = useQuery({ queryKey: ISSUER_CLAIMS(issuer?.type, issuer?.id), queryFn: () => listClaimsByIssuer(issuer.type, issuer.id), enabled: on, staleTime: 15_000 });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ISSUER_REWARDS(issuer?.type, issuer?.id) });
    qc.invalidateQueries({ queryKey: ISSUER_CLAIMS(issuer?.type, issuer?.id) });
    qc.invalidateQueries({ queryKey: ALL_KEY });
  };
  const create = useMutation({ mutationFn: (input) => createReward(input, issuer, actor), onSuccess: refresh });
  const update = useMutation({ mutationFn: ({ id, atual, patch }) => updateReward(id, atual, patch, issuer, actor), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id) => deleteReward(id), onSuccess: refresh });
  const decide = useMutation({ mutationFn: ({ claim, next, note }) => decideClaim(claim, next, actor, note), onSuccess: refresh });
  return {
    rewards: rewardsQ.data || [],
    claims: claimsQ.data || [],
    isLoading: rewardsQ.isLoading || claimsQ.isLoading,
    isError: rewardsQ.isError || claimsQ.isError,
    refetch: () => { rewardsQ.refetch(); claimsQ.refetch(); },
    create, update, remove, decide,
  };
}
