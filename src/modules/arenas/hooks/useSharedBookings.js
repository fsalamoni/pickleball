/**
 * Hooks de reservas compartilhadas (multi-atleta) e de aula — flag
 * shared_bookings. Operam sobre a mesma coleção arena_bookings.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  createSharedBooking, acceptBookingInvite, declineBookingInvite,
  joinOpenBooking, leaveBooking, inviteToBooking, updateSharedBookingSettings,
  setParticipantSlot, listMyInvites, listMyParticipations, listCoachBookings,
} from '../services/sharedBookingService.js';

export function useMyBookingInvites() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['booking-invites', user?.uid],
    queryFn: () => listMyInvites(user?.uid),
    enabled: !!user?.uid,
    refetchInterval: 30_000,
  });
}

export function useMyParticipations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['booking-participations', user?.uid],
    queryFn: () => listMyParticipations(user?.uid),
    enabled: !!user?.uid,
    refetchInterval: 30_000,
  });
}

export function useCoachBookings(coachId) {
  return useQuery({
    queryKey: ['coach-bookings', coachId],
    queryFn: () => listCoachBookings(coachId),
    enabled: !!coachId,
  });
}

function invalidateAll(qc, arenaId) {
  qc.invalidateQueries({ queryKey: ['my-bookings'] });
  qc.invalidateQueries({ queryKey: ['booking-invites'] });
  qc.invalidateQueries({ queryKey: ['booking-participations'] });
  qc.invalidateQueries({ queryKey: ['coach-bookings'] });
  if (arenaId) qc.invalidateQueries({ queryKey: ['arena-bookings', arenaId] });
}

export function useCreateSharedBooking() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arena, input }) => createSharedBooking(arena, user, userProfile, input),
    onSuccess: (_d, { arena }) => invalidateAll(qc, arena.id),
  });
}

export function useAcceptBookingInvite() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ booking, slot }) => acceptBookingInvite(booking, user, userProfile, { slot }),
    onSuccess: (_d, { booking }) => invalidateAll(qc, booking.arena_id),
  });
}

export function useDeclineBookingInvite() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ booking }) => declineBookingInvite(booking, user),
    onSuccess: (_d, { booking }) => invalidateAll(qc, booking.arena_id),
  });
}

export function useJoinOpenBooking() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ booking, slot }) => joinOpenBooking(booking, user, userProfile, { slot }),
    onSuccess: (_d, { booking }) => invalidateAll(qc, booking.arena_id),
  });
}

export function useLeaveBooking() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ booking }) => leaveBooking(booking, user),
    onSuccess: (_d, { booking }) => invalidateAll(qc, booking.arena_id),
  });
}

export function useInviteToBooking() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ booking, invitees }) => inviteToBooking(booking, user, invitees),
    onSuccess: (_d, { booking }) => invalidateAll(qc, booking.arena_id),
  });
}

export function useUpdateSharedBookingSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ booking, patch }) => updateSharedBookingSettings(booking, user, patch),
    onSuccess: (_d, { booking }) => invalidateAll(qc, booking.arena_id),
  });
}

export function useSetParticipantSlot() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ booking, athleteId, slot }) => setParticipantSlot(booking, user, athleteId, slot),
    onSuccess: (_d, { booking }) => invalidateAll(qc, booking.arena_id),
  });
}
