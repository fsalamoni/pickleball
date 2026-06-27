import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  followAthlete,
  unfollowAthlete,
  isFollowing,
  listFollowing,
  listFollowers,
} from '../services/followService.js';

/** Estado e ação de seguir/desseguir um atleta alvo. */
export function useFollow(targetUid, enabled = true) {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  const me = user?.uid;

  const followingQuery = useQuery({
    queryKey: ['is-following', me, targetUid],
    queryFn: () => isFollowing(me, targetUid),
    enabled: !!me && !!targetUid && me !== targetUid && enabled,
  });

  const mutation = useMutation({
    mutationFn: async (next) => {
      const name = userProfile?.platform_name || user?.displayName || null;
      if (next) await followAthlete(targetUid, user, name);
      else await unfollowAthlete(targetUid, user);
      return next;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['is-following', me, targetUid] });
      qc.invalidateQueries({ queryKey: ['followers', targetUid] });
      qc.invalidateQueries({ queryKey: ['following', me] });
    },
  });

  return {
    isFollowing: followingQuery.data === true,
    isSelf: !!me && me === targetUid,
    toggle: () => mutation.mutate(!(followingQuery.data === true)),
    isPending: mutation.isPending,
  };
}

/** Quem o usuário segue. */
export function useFollowing(uid, enabled = true) {
  return useQuery({
    queryKey: ['following', uid],
    queryFn: () => listFollowing(uid),
    enabled: !!uid && enabled,
  });
}

/** Seguidores de um atleta. */
export function useFollowers(uid, enabled = true) {
  return useQuery({
    queryKey: ['followers', uid],
    queryFn: () => listFollowers(uid),
    enabled: !!uid && enabled,
  });
}
