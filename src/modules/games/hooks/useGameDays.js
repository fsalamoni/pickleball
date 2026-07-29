/**
 * Hooks do "Dia de jogo do atleta" (flag athlete_game_day).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  createGameDay, getGameDay, listMyGameDays, updateGameDay, deleteGameDay,
  listGameDayParticipants, addGameDayParticipant, removeGameDayParticipant,
  listGameDayGames, addGameDayGame, updateGameDayGame, deleteGameDayGame,
  replaceGameDayGames, clearGameDayGames,
  joinPublicGameDay, publishGameDayToRanking, unpublishGameDayFromRanking,
  getGameDayRankingMeta, getMyGameDayGames,
} from '../services/gameDayService.js';

/* ------------------------------ Dias de jogo ---------------------------- */

export function useMyGameDays() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['game-days', 'mine', user?.uid],
    queryFn: () => listMyGameDays(user?.uid),
    enabled: !!user?.uid,
    staleTime: 20_000,
  });
}

export function useGameDay(id) {
  return useQuery({
    queryKey: ['game-days', 'detail', id],
    queryFn: () => getGameDay(id),
    enabled: !!id,
  });
}

/** Todos os jogos de dia de jogo do atleta (para "Meu desempenho"). */
export function useMyGameDayGames() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['game-days', 'my-games', user?.uid],
    queryFn: () => getMyGameDayGames(user?.uid),
    enabled: !!user?.uid,
    staleTime: 20_000,
  });
}

export function useCreateGameDay() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => createGameDay(input, user, userProfile),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['game-days'] });
      qc.invalidateQueries({ queryKey: ['open-games'] });
    },
  });
}

export function useUpdateGameDay() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => updateGameDay(id, patch, user),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['game-days'] });
      qc.invalidateQueries({ queryKey: ['game-days', 'detail', vars.id] });
    },
  });
}

export function useDeleteGameDay() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => deleteGameDay(id, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['game-days'] });
      qc.invalidateQueries({ queryKey: ['open-games'] });
    },
  });
}

export function useJoinPublicGameDay() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gameDay) => joinPublicGameDay(gameDay, user, userProfile),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['game-days'] });
      qc.invalidateQueries({ queryKey: ['open-games'] });
    },
  });
}

/* ------------------------------ Participantes --------------------------- */

export function useGameDayParticipants(gdId) {
  return useQuery({
    queryKey: ['game-days', gdId, 'participants'],
    queryFn: () => listGameDayParticipants(gdId),
    enabled: !!gdId,
  });
}

export function useAddGameDayParticipant(gdId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry) => addGameDayParticipant(gdId, entry, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['game-days', gdId, 'participants'] });
      qc.invalidateQueries({ queryKey: ['game-days'] });
    },
  });
}

export function useRemoveGameDayParticipant(gdId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pid) => removeGameDayParticipant(gdId, pid, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['game-days', gdId, 'participants'] });
      qc.invalidateQueries({ queryKey: ['game-days'] });
    },
  });
}

/* --------------------------------- Jogos -------------------------------- */

export function useGameDayGames(gdId) {
  return useQuery({
    queryKey: ['game-days', gdId, 'games'],
    queryFn: () => listGameDayGames(gdId),
    enabled: !!gdId,
  });
}

function useGamesInvalidate(gdId) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['game-days', gdId, 'games'] });
}

export function useAddGameDayGame(gdId) {
  const { user } = useAuth();
  const invalidate = useGamesInvalidate(gdId);
  return useMutation({ mutationFn: (game) => addGameDayGame(gdId, game, user), onSuccess: invalidate });
}

export function useUpdateGameDayGame(gdId) {
  const invalidate = useGamesInvalidate(gdId);
  return useMutation({ mutationFn: ({ gameId, updates }) => updateGameDayGame(gdId, gameId, updates), onSuccess: invalidate });
}

export function useDeleteGameDayGame(gdId) {
  const invalidate = useGamesInvalidate(gdId);
  return useMutation({ mutationFn: (gameId) => deleteGameDayGame(gdId, gameId), onSuccess: invalidate });
}

export function useReplaceGameDayGames(gdId) {
  const { user } = useAuth();
  const invalidate = useGamesInvalidate(gdId);
  return useMutation({ mutationFn: (games) => replaceGameDayGames(gdId, games, user), onSuccess: invalidate });
}

export function useClearGameDayGames(gdId) {
  const { user } = useAuth();
  const invalidate = useGamesInvalidate(gdId);
  return useMutation({ mutationFn: () => clearGameDayGames(gdId, user), onSuccess: invalidate });
}

/* ------------------------------- Ranking -------------------------------- */

export function useGameDayRankingMeta(gdId) {
  return useQuery({
    queryKey: ['game-days', gdId, 'ranking-meta'],
    queryFn: () => getGameDayRankingMeta(gdId),
    enabled: !!gdId,
    staleTime: 10_000,
  });
}

export function usePublishGameDayRanking() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gameDay) => publishGameDayToRanking(gameDay, user),
    onSuccess: (_, gameDay) => {
      qc.invalidateQueries({ queryKey: ['game-days', gameDay.id, 'ranking-meta'] });
      qc.invalidateQueries({ queryKey: ['game-days', 'detail', gameDay.id] });
    },
  });
}

export function useUnpublishGameDayRanking() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gameDay) => unpublishGameDayFromRanking(gameDay, user),
    onSuccess: (_, gameDay) => {
      qc.invalidateQueries({ queryKey: ['game-days', gameDay.id, 'ranking-meta'] });
      qc.invalidateQueries({ queryKey: ['game-days', 'detail', gameDay.id] });
    },
  });
}
