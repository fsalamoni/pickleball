/**
 * Hooks do DIA DE JOGO DA ARENA (flag `arena_game_day`).
 *
 * Os dias de jogo de arena moram em `game_days`, então as invalidações
 * derrubam TAMBÉM o cache do dia de jogo do atleta (`['game-days']`): quem
 * marca presença passa a ver o dia na própria lista, e isso precisa aparecer
 * sem recarregar a página.
 *
 * O calendário da arena depende dos bloqueios gravados, então toda escrita que
 * mexe em quadra/horário derruba `['arena-unavailabilities']` também — sem
 * isso, a arena criaria o dia de jogo e veria a quadra ainda livre.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  createArenaGameDay, updateArenaGameDay, archiveArenaGameDay,
  listArenaGameDays, signUpToArenaGameDay, leaveArenaGameDay,
  setArenaParticipantCourt,
} from '../services/arenaGameDayService.js';

/** Chaves a derrubar depois de qualquer escrita de dia de jogo de arena. */
function invalidarTudo(qc, arenaId) {
  qc.invalidateQueries({ queryKey: ['arena-game-days', arenaId] });
  qc.invalidateQueries({ queryKey: ['game-days'] });
  qc.invalidateQueries({ queryKey: ['arena-unavailabilities'] });
}

/** Os dias de jogo de uma arena. */
export function useArenaGameDays(arenaId, { includeArchived = false } = {}) {
  return useQuery({
    queryKey: ['arena-game-days', arenaId, includeArchived],
    queryFn: () => listArenaGameDays(arenaId, { includeArchived }),
    enabled: !!arenaId,
    staleTime: 20_000,
  });
}

export function useCreateArenaGameDay(arenaId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, arena, courts, bookings }) => createArenaGameDay(
      arenaId, input, user, { arena, courts, bookings },
    ),
    onSuccess: () => invalidarTudo(qc, arenaId),
  });
}

export function useUpdateArenaGameDay(arenaId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ gameDayId, input, courts, bookings }) => updateArenaGameDay(
      gameDayId, input, user, { courts, bookings },
    ),
    onSuccess: () => invalidarTudo(qc, arenaId),
  });
}

export function useArchiveArenaGameDay(arenaId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gameDayId) => archiveArenaGameDay(gameDayId, user),
    onSuccess: () => invalidarTudo(qc, arenaId),
  });
}

/** Marcar presença (o atleta). */
export function useSignUpToArenaGameDay() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ gameDay, courtId = null }) => signUpToArenaGameDay(
      gameDay, user, userProfile, { courtId },
    ),
    onSuccess: (_r, vars) => invalidarTudo(qc, vars?.gameDay?.arena_id),
  });
}

/** Desmarcar presença (o atleta, ou a arena removendo alguém). */
export function useLeaveArenaGameDay() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ gameDayId, uid }) => leaveArenaGameDay(gameDayId, uid || user?.uid, user),
    onSuccess: (_r, vars) => invalidarTudo(qc, vars?.arenaId),
  });
}

/** Trocar a quadra de um inscrito. */
export function useSetArenaParticipantCourt(gdId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ participantId, courtId }) => setArenaParticipantCourt(gdId, participantId, courtId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['game-days', gdId, 'participants'] }),
  });
}
