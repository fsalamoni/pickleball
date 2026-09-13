import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  listMyBookings,
  listArenaBookings,
  createBooking,
  createBookingsForSelection,
  createManualBooking,
  updateBookingStatus,
  proposeBookingPrice,
  setBookingPayment,
  deleteBooking,
  editBookingSlot,
  transferBooking,
  setBookingNoShow,
} from '../services/bookingService.js';
import { arenaKeys } from './arenaKeys.js';

export function useMyBookings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-bookings', user?.uid],
    queryFn: () => listMyBookings(user?.uid),
    enabled: !!user?.uid,
    refetchInterval: 30_000,
  });
}

/**
 * As reservas da arena — as opções da consulta, sozinhas, para a PRÉ-BUSCA
 * poder usar exatamente a mesma coisa que o hook.
 */
export function arenaBookingsQuery(arenaId) {
  return {
    queryKey: arenaKeys.reservas(arenaId),
    queryFn: () => listArenaBookings(arenaId),
  };
}

/**
 * Reservas da arena.
 *
 * ⚠️ Isto busca a coleção INTEIRA da arena (não há como recortar por data no
 * servidor: a data mora dentro de `slots`, que é um vetor). Então o custo
 * cresce com a história da arena, e recarregar de 30 em 30 segundos, em toda
 * aba aberta, era caro sem ser mais fresco onde importa. Agora: um minuto de
 * intervalo, e **recarga ao voltar para a aba** — que é o instante em que a
 * pessoa realmente olha. `staleTime` continua valendo, então voltar para a aba
 * duas vezes em dois minutos não busca duas vezes.
 */
export function useArenaBookings(arenaId) {
  return useQuery({
    ...arenaBookingsQuery(arenaId),
    enabled: !!arenaId,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
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

/**
 * Cria as reservas de uma SELEÇÃO de calendário — várias quadras e horários
 * num pedido só, num lote atômico. Ver `createBookingsForSelection`.
 */
export function useCreateBookingsForSelection() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arena, input }) => createBookingsForSelection(arena, user, userProfile, input),
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

export function useSetBookingNoShow() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ booking, isNoShow }) => setBookingNoShow(booking, user, isNoShow),
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

export function useTransferBooking() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ booking, target }) => transferBooking(booking, user, target),
    onSuccess: (_d, { booking }) => {
      qc.invalidateQueries({ queryKey: ['my-bookings'] });
      qc.invalidateQueries({ queryKey: ['arena-bookings', booking.arena_id] });
    },
  });
}
