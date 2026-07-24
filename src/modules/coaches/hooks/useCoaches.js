/**
 * Hooks do módulo Coaches (Sprint 4 PRO-15).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  getCoach, listCoaches, upsertCoachProfile,
  listCoachResidencies, listArenaCoaches,
  addCoachResidency, removeCoachResidency, updateCoachResidency,
  acceptCoachResidency, declineCoachResidency,
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

export function useAddCoachResidency() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const mutualOn = useFeatureFlag(FEATURE_FLAG.PARTNERSHIP_MUTUAL);
  return useMutation({
    mutationFn: (input) => addCoachResidency(input, user, { requireAcceptance: mutualOn }),
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
