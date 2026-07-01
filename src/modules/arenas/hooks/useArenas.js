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
} from '../services/arenaService.js';

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
