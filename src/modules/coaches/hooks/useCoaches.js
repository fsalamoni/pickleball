/**
 * Hooks do módulo Coaches (Sprint 4 PRO-15).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  getCoach, listCoaches, upsertCoachProfile, syncCoachDocFromEssentials,
  listCoachResidencies, listArenaCoaches,
  addCoachResidency, removeCoachResidency, updateCoachResidency,
  acceptCoachResidency, declineCoachResidency,
  listMyFavoriteCoaches, favoriteCoach, unfavoriteCoach,
} from '../services/coachService';
import { filterCoaches, canAcceptStudents, coachTenureDays } from '../domain/coach.js';

export function useCoaches(filters = {}) {
  return useQuery({
    queryKey: ['coaches', 'list', filters],
    queryFn: () => listCoaches(filters),
  });
}

export function useCoach(coachId) {
  return useQuery({
    queryKey: ['coaches', 'detail', coachId],
    queryFn: () => getCoach(coachId),
    enabled: !!coachId,
  });
}

export function useCoachResidencies(coachId) {
  return useQuery({
    queryKey: ['coaches', 'residencies', coachId],
    queryFn: () => listCoachResidencies(coachId),
    enabled: !!coachId,
  });
}

export function useArenaCoaches(arenaId, opts = {}) {
  return useQuery({
    queryKey: ['coaches', 'arena', arenaId, opts],
    queryFn: () => listArenaCoaches(arenaId, opts),
    enabled: !!arenaId,
  });
}

export function useUpsertCoachProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ coachId, input }) => upsertCoachProfile(coachId, input, user),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['coaches'] });
      qc.invalidateQueries({ queryKey: ['coaches', 'detail', vars.coachId] });
    },
  });
}

/**
 * Sincroniza o doc de professor a partir do "Sou professor" do editor de perfil.
 * Preserva os campos avançados e espelha o resumo em users/diretório.
 */
export function useSyncCoachFromProfile() {
  const { user, isPlatformAdmin } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ coachId, essentials }) => syncCoachDocFromEssentials(
      coachId, essentials, { uid: user?.uid, isPlatformAdmin, displayName: user?.displayName },
    ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['coaches'] });
      qc.invalidateQueries({ queryKey: ['coaches', 'detail', vars.coachId] });
    },
  });
}

export function useAddCoachResidency() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => addCoachResidency(input, user, { requireAcceptance: true }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['coaches'] });
      qc.invalidateQueries({ queryKey: ['coaches', 'residencies', vars.coach_id] });
      qc.invalidateQueries({ queryKey: ['coaches', 'arena', vars.arena_id] });
    },
  });
}

export function useAcceptCoachResidency() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ coachId, arenaId }) => acceptCoachResidency(coachId, arenaId, user),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['coaches', 'residencies', vars.coachId] });
      qc.invalidateQueries({ queryKey: ['coaches', 'arena', vars.arenaId] });
    },
  });
}

export function useDeclineCoachResidency() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ coachId, arenaId }) => declineCoachResidency(coachId, arenaId, user),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['coaches', 'residencies', vars.coachId] });
      qc.invalidateQueries({ queryKey: ['coaches', 'arena', vars.arenaId] });
    },
  });
}

export function useRemoveCoachResidency() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ coachId, arenaId }) => removeCoachResidency(coachId, arenaId, user),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['coaches', 'residencies', vars.coachId] });
      qc.invalidateQueries({ queryKey: ['coaches', 'arena', vars.arenaId] });
    },
  });
}

export function useUpdateCoachResidency() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ coachId, arenaId, patch }) => updateCoachResidency(coachId, arenaId, patch, user),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['coaches', 'residencies', vars.coachId] });
      qc.invalidateQueries({ queryKey: ['coaches', 'arena', vars.arenaId] });
    },
  });
}

/* ----------------------- Favorites (Wave B) ------------------------ */

export function useMyFavoriteCoaches() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['coach-favorites', user?.uid],
    queryFn: () => listMyFavoriteCoaches(user?.uid),
    enabled: !!user?.uid,
    staleTime: 30_000,
  });
}

export function useToggleFavoriteCoach() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ coach, isFavorite }) => {
      if (isFavorite) return unfavoriteCoach(user.uid, coach.id);
      return favoriteCoach(user, coach);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coach-favorites'] }),
  });
}
