/**
 * Hooks da chegada na arena (módulo `iot_qr_kiosk`).
 *
 * Toda mutação invalida os DOIS lados: a lista do atleta (`my-bookings`) e a
 * da arena (`arenaKeys.reservas`). A mesma reserva aparece nas duas telas, e
 * presença confirmada num lado que não aparece no outro é o tipo de coisa que
 * faz a recepção conferir na mão — que é justamente o que o módulo elimina.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { arenaKeys } from './arenaKeys.js';
import {
  getKioskDevice, rotateKioskToken, markKioskOffline,
  checkInBooking, confirmArrivalByArena, undoArrival, markNoShowBatch,
} from '../services/checkinService.js';
import { KIOSK_TOKEN_TTL_MS } from '../domain/checkin.js';

/** O totem, para o atleta conferir o código sem depender do que a tela dele guardou. */
export function useKioskDevice(deviceId) {
  return useQuery({
    queryKey: ['arena-kiosk', deviceId],
    queryFn: () => getKioskDevice(deviceId),
    enabled: !!deviceId,
    // Um pouco mais rápido que a validade: pegar o código já vencido faria a
    // pessoa digitar certo e ouvir que errou.
    refetchInterval: Math.round(KIOSK_TOKEN_TTL_MS / 3),
  });
}

function useInvalidarReservas() {
  const qc = useQueryClient();
  return (arenaId) => {
    qc.invalidateQueries({ queryKey: ['my-bookings'] });
    if (arenaId) qc.invalidateQueries({ queryKey: arenaKeys.reservas(arenaId) });
  };
}

export function useRotateKioskToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId }) => rotateKioskToken(deviceId),
    onSuccess: (_d, { deviceId }) => qc.invalidateQueries({ queryKey: ['arena-kiosk', deviceId] }),
  });
}

export function useMarkKioskOffline() {
  return useMutation({ mutationFn: ({ deviceId }) => markKioskOffline(deviceId) });
}

/** O atleta confirma a própria chegada, com o código do totem. */
export function useCheckInBooking() {
  const { user } = useAuth();
  const invalidar = useInvalidarReservas();
  return useMutation({
    mutationFn: ({ booking, deviceId, code }) => checkInBooking(booking, user, { deviceId, code }),
    onSuccess: (_d, { booking }) => invalidar(booking?.arena_id),
  });
}

/** A arena confirma a chegada pelo painel. */
export function useConfirmArrival() {
  const { user } = useAuth();
  const invalidar = useInvalidarReservas();
  return useMutation({
    mutationFn: ({ booking }) => confirmArrivalByArena(booking, user),
    onSuccess: (_d, { booking }) => invalidar(booking?.arena_id),
  });
}

export function useUndoArrival() {
  const { user } = useAuth();
  const invalidar = useInvalidarReservas();
  return useMutation({
    mutationFn: ({ booking }) => undoArrival(booking, user),
    onSuccess: (_d, { booking }) => invalidar(booking?.arena_id),
  });
}

export function useMarkNoShowBatch() {
  const { user } = useAuth();
  const invalidar = useInvalidarReservas();
  return useMutation({
    mutationFn: ({ bookings }) => markNoShowBatch(bookings, user),
    onSuccess: (_d, { arenaId }) => invalidar(arenaId),
  });
}
