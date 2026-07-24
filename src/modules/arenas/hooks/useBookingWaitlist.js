/**
 * Hooks da lista de espera de reservas (flag booking_waitlist).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  joinWaitlist, leaveWaitlist, listArenaWaitlist, listMyWaitlist,
} from '../services/bookingWaitlistService.js';

export function useArenaWaitlist(arenaId, enabled = true) {
  return useQuery({
    queryKey: ['arena-waitlist', arenaId],
    queryFn: () => listArenaWaitlist(arenaId),
    enabled: !!arenaId && enabled,
    staleTime: 30_000,
  });
}

export function useMyWaitlist(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-waitlist', user?.uid],
    queryFn: () => listMyWaitlist(user?.uid),
    enabled: !!user?.uid && enabled,
    staleTime: 30_000,
  });
}

export function useJoinWaitlist() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => joinWaitlist({
      ...input,
      user_name: userProfile?.platform_name || userProfile?.full_name || user?.displayName || 'Atleta',
      user_photo: userProfile?.photo_url || '',
    }, user),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: ['arena-waitlist', input.arena_id] });
      qc.invalidateQueries({ queryKey: ['my-waitlist'] });
    },
  });
}

export function useLeaveWaitlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId }) => leaveWaitlist(entryId, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arena-waitlist'] });
      qc.invalidateQueries({ queryKey: ['my-waitlist'] });
    },
  });
}
