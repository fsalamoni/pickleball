import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  listMyBookings,
  listArenaBookings,
  createBooking,
  createManualBooking,
  updateBookingStatus,
  proposeBookingPrice,
  setBookingPayment,
  deleteBooking,
  editBookingSlot,
} from '../services/bookingService.js';

export function useMyBookings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-bookings', user?.uid],
    queryFn: () => listMyBookings(user?.uid),
    enabled: !!user?.uid,
    refetchInterval: 30_000,
  });
}

export function useArenaBookings(arenaId) {
  return useQuery({
    queryKey: ['arena-bookings', arenaId],
    queryFn: () => listArenaBookings(arenaId),
    enabled: !!arenaId,
    refetchInterval: 30_000,
  });
}

export function useCreateBooking() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arena, input }) => createBooking(arena, user, userProfile, input),
    onSuccess: (_d, { arena }) => {
      qc.invalidateQueries({ queryKey: ['my-bookings'] });
      qc.invalidateQueries({ queryKey: ['arena-bookings', arena.id] });
    },
  });
}

export function useCreateManualBooking() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arena, input }) => createManualBooking(arena, user, input),
    onSuccess: (_d, { arena }) => {
      qc.invalidateQueries({ queryKey: ['arena-bookings', arena.id] });
    },
  });
}

export function useUpdateBookingStatus() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ booking, status, options }) => updateBookingStatus(booking, status, user, options),
    onSuccess: (_d, { booking }) => {
      qc.invalidateQueries({ queryKey: ['my-bookings'] });
      qc.invalidateQueries({ queryKey: ['arena-bookings', booking.arena_id] });
    },
  });
}

export function useProposeBookingPrice() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ booking, price, options }) => proposeBookingPrice(booking, price, user, options),
    onSuccess: (_d, { booking }) => {
      qc.invalidateQueries({ queryKey: ['my-bookings'] });
      qc.invalidateQueries({ queryKey: ['arena-bookings', booking.arena_id] });
    },
  });
}

export function useSetBookingPayment() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ booking, paymentStatus }) => setBookingPayment(booking, paymentStatus, user),
    onSuccess: (_d, { booking }) => {
      qc.invalidateQueries({ queryKey: ['my-bookings'] });
      qc.invalidateQueries({ queryKey: ['arena-bookings', booking.arena_id] });
    },
  });
}

export function useDeleteBooking() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (booking) => deleteBooking(booking, user),
    onSuccess: (_d, booking) => {
      qc.invalidateQueries({ queryKey: ['my-bookings'] });
      qc.invalidateQueries({ queryKey: ['arena-bookings', booking.arena_id] });
    },
  });
}

export function useEditBooking() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ booking, input, options }) => editBookingSlot(booking, user, input, options),
    onSuccess: (_d, { booking }) => {
      qc.invalidateQueries({ queryKey: ['my-bookings'] });
      qc.invalidateQueries({ queryKey: ['booking-participations'] });
      qc.invalidateQueries({ queryKey: ['coach-bookings'] });
      qc.invalidateQueries({ queryKey: ['arena-bookings', booking.arena_id] });
    },
  });
}
