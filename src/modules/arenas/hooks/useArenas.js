import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  listArenas,
  getArena,
  listMyManagedArenas,
  listArenaManagers,
  listMyFavoriteArenas,
  favoriteArena,
  unfavoriteArena,
  listArenaReviews,
  addArenaReview,
  deleteArenaReview,
  createArena,
  updateArena,
  saveArenaPricing,
  setArenaPhotos,
  deleteArena,
  addArenaManager,
  removeArenaManager,
  listArenaCourts,
  createArenaCourt,
  updateArenaCourt,
  deleteArenaCourt,
  reorderArenaCourts,
  normalizeArenaCourtsOrder,
  respondToArenaReview,
  deleteArenaReviewResponse,
  listArenaCourtSchedules,
  listCourtSchedules,
  createCourtSchedule,
  updateCourtSchedule,
  deleteCourtSchedule,
} from '../services/arenaService.js';
import { sortCourts } from '../domain/court.js';
import { sortSchedules, groupSchedulesByWeekday } from '../domain/court_schedule.js';

export function useArenas() {
  return useQuery({ queryKey: ['arenas'], queryFn: listArenas, staleTime: 30_000 });
}

export function useArena(id) {
  return useQuery({ queryKey: ['arena', id], queryFn: () => getArena(id), enabled: !!id });
}

export function useMyManagedArenas() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['arenas-managed', user?.uid],
    queryFn: () => listMyManagedArenas(user?.uid),
    enabled: !!user?.uid,
  });
}

export function useArenaManagers(arenaId) {
  return useQuery({ queryKey: ['arena-managers', arenaId], queryFn: () => listArenaManagers(arenaId), enabled: !!arenaId });
}

export function useMyFavoriteArenas() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['arena-favorites', user?.uid],
    queryFn: () => listMyFavoriteArenas(user?.uid),
    enabled: !!user?.uid,
  });
}

export function useToggleFavorite() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ arena, isFavorite }) => {
      if (isFavorite) return unfavoriteArena(user.uid, arena.id);
      return favoriteArena(user, arena);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arena-favorites'] }),
  });
}

export function useArenaReviews(arenaId) {
  return useQuery({ queryKey: ['arena-reviews', arenaId], queryFn: () => listArenaReviews(arenaId), enabled: !!arenaId });
}

export function useAddReview() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arena, input }) => addArenaReview(arena, user, userProfile, input),
    onSuccess: (_d, { arena }) => {
      qc.invalidateQueries({ queryKey: ['arena-reviews', arena.id] });
      qc.invalidateQueries({ queryKey: ['arena', arena.id] });
    },
  });
}

export function useDeleteReview() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (review) => deleteArenaReview(review, user),
    onSuccess: (_d, review) => qc.invalidateQueries({ queryKey: ['arena-reviews', review.arena_id] }),
  });
}

export function useCreateArena() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => createArena(user, userProfile, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arenas'] });
      qc.invalidateQueries({ queryKey: ['arenas-managed'] });
    },
  });
}

export function useUpdateArena() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }) => updateArena(id, updates, user),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ['arena', id] });
      qc.invalidateQueries({ queryKey: ['arenas'] });
    },
  });
}

export function useSaveArenaPricing() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pricing }) => saveArenaPricing(id, pricing, user),
    onSuccess: (_d, { id }) => qc.invalidateQueries({ queryKey: ['arena', id] }),
  });
}

export function useSetArenaPhotos() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, photos }) => setArenaPhotos(id, photos, user),
    onSuccess: (_d, { id }) => qc.invalidateQueries({ queryKey: ['arena', id] }),
  });
}

export function useDeleteArena() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => deleteArena(id, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arenas'] });
      qc.invalidateQueries({ queryKey: ['arenas-managed'] });
    },
  });
}

export function useAddManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arena, target }) => addArenaManager(arena, target, user),
    onSuccess: (_d, { arena }) => qc.invalidateQueries({ queryKey: ['arena-managers', arena.id] }),
  });
}

export function useRemoveManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, userId }) => removeArenaManager(arenaId, userId, user),
    onSuccess: (_d, { arenaId }) => qc.invalidateQueries({ queryKey: ['arena-managers', arenaId] }),
  });
}

/* ---------------------- Courts (ARE-01, Sprint 1) -------------------- */

/**
 * Lista quadras de uma arena, ordenadas por sort_order. Retorna lista
 * vazia se arenaId ausente ou ainda carregando.
 */
export function useArenaCourts(arenaId) {
  return useQuery({
    queryKey: ['arena-courts', arenaId],
    queryFn: async () => sortCourts(await listArenaCourts(arenaId)),
    enabled: !!arenaId,
    staleTime: 30_000,
  });
}

function useCourtMutation(arenaId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return { user, qc, invalidate: () => qc.invalidateQueries({ queryKey: ['arena-courts', arenaId] }) };
}

export function useCreateCourt(arenaId) {
  const { user, invalidate } = useCourtMutation(arenaId);
  return useMutation({
    mutationFn: (input) => createArenaCourt(arenaId, input, user),
    onSuccess: invalidate,
  });
}

export function useUpdateCourt(arenaId) {
  const { user, invalidate } = useCourtMutation(arenaId);
  return useMutation({
    mutationFn: ({ courtId, input }) => updateArenaCourt(courtId, input, user),
    onSuccess: invalidate,
  });
}

export function useDeleteCourt(arenaId) {
  const { user, invalidate } = useCourtMutation(arenaId);
  return useMutation({
    mutationFn: (courtId) => deleteArenaCourt(courtId, user),
    onSuccess: invalidate,
  });
}

export function useReorderCourts(arenaId) {
  const { user, invalidate } = useCourtMutation(arenaId);
  return useMutation({
    mutationFn: (orderedIds) => reorderArenaCourts(arenaId, orderedIds, user),
    onSuccess: invalidate,
  });
}

export function useNormalizeCourtOrder(arenaId) {
  const { user, invalidate } = useCourtMutation(arenaId);
  return useMutation({
    mutationFn: () => normalizeArenaCourtsOrder(arenaId, user),
    onSuccess: invalidate,
  });
}

/* ---------------- Review responses (Sprint 3 ARE-09) --------------- */

export function useRespondToReview() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, response }) => respondToArenaReview(reviewId, response, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arena-reviews'] });
    },
  });
}

export function useDeleteReviewResponse() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reviewId) => deleteArenaReviewResponse(reviewId, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arena-reviews'] });
    },
  });
}

/* ---------------- Court Schedules (ARE-04, Sprint 1) ----------------- */

/**
 * Lista todos os schedules de uma arena (todas as quadras), ordenados.
 * Útil pra render agregado (calendário semanal).
 */
export function useArenaCourtSchedules(arenaId) {
  return useQuery({
    queryKey: ['arena-court-schedules', arenaId],
    queryFn: async () => sortSchedules(await listArenaCourtSchedules(arenaId)),
    enabled: !!arenaId,
    staleTime: 60_000,
  });
}

/**
 * Lista schedules de uma quadra específica, ordenados.
 * Retorna também o agrupamento por weekday (helper pronto pra UI).
 */
export function useCourtSchedules(courtId) {
  return useQuery({
    queryKey: ['court-schedules', courtId],
    queryFn: async () => {
      const list = sortSchedules(await listCourtSchedules(courtId));
      return { list, byWeekday: groupSchedulesByWeekday(list) };
    },
    enabled: !!courtId,
    staleTime: 60_000,
  });
}

function useScheduleMutation(courtId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return {
    user,
    invalidate: () => {
      qc.invalidateQueries({ queryKey: ['court-schedules', courtId] });
      qc.invalidateQueries({ queryKey: ['arena-court-schedules'] });
    },
  };
}

export function useCreateSchedule(arenaId, courtId) {
  const { user, invalidate } = useScheduleMutation(courtId);
  return useMutation({
    mutationFn: (input) => createCourtSchedule(arenaId, courtId, input, user),
    onSuccess: invalidate,
  });
}

export function useUpdateSchedule(courtId) {
  const { user, invalidate } = useScheduleMutation(courtId);
  return useMutation({
    mutationFn: ({ scheduleId, input }) => updateCourtSchedule(scheduleId, input, user),
    onSuccess: invalidate,
  });
}

export function useDeleteSchedule(courtId) {
  const { user, invalidate } = useScheduleMutation(courtId);
  return useMutation({
    mutationFn: (scheduleId) => deleteCourtSchedule(scheduleId, user),
    onSuccess: invalidate,
  });
}

