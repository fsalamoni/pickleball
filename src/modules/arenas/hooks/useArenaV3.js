/**
 * Hooks React Query para Arena V3.
 *
 * - useArenaSettings(arenaId) — settings da arena
 * - useArenaModuleStates(arenaId) — mapa de module states
 * - useArenaModuleState(arenaId, moduleId) — estado de um módulo
 * - useCanArenaUseModule(arenaId, moduleId) — gate (true/false)
 * - useToggleArenaModule — mutation
 * - useUpdateArenaSettings — mutation
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { canArenaUseModule, indexModuleStates } from '../domain/modules.js';
import {
  getOrCreateArenaSettings,
  getArenaSettings,
  updateArenaSettings,
} from '../services/v3SettingsService.js';
import {
  setArenaModuleState,
  toggleArenaModule,
  listArenaModuleStates,
  getArenaModuleState,
} from '../services/moduleStateService.js';

/* ----------------------------- Settings ----------------------------- */

export function useArenaSettings(arenaId, { createIfMissing = false } = {}) {
  return useQuery({
    queryKey: ['arena-settings', arenaId],
    queryFn: () => createIfMissing ? getOrCreateArenaSettings(arenaId) : getArenaSettings(arenaId),
    enabled: !!arenaId,
    staleTime: 60_000,
  });
}

export function useUpdateArenaSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, updates }) => updateArenaSettings(arenaId, updates, user),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: ['arena-settings', arenaId] });
    },
  });
}

/* ------------------------- Module States --------------------------- */

export function useArenaModuleStates(arenaId) {
  return useQuery({
    queryKey: ['arena-module-states', arenaId],
    queryFn: () => listArenaModuleStates(arenaId),
    enabled: !!arenaId,
    staleTime: 30_000,
  });
}

export function useArenaModuleState(arenaId, moduleId) {
  return useQuery({
    queryKey: ['arena-module-state', arenaId, moduleId],
    queryFn: () => getArenaModuleState(arenaId, moduleId),
    enabled: !!arenaId && !!moduleId,
    staleTime: 30_000,
  });
}

/**
 * Hook gate: retorna true se a arena pode usar o módulo.
 * Combina: flag global + sub-flag + arena state.
 */
export function useCanArenaUseModule(arenaId, moduleId) {
  const platformFlags = useFeatureFlag();
  const { data: states = [] } = useArenaModuleStates(arenaId);
  const indexed = useMemo(() => indexModuleStates(states), [states]);
  return canArenaUseModule({
    platformFlags: platformFlags || {},
    moduleState: indexed[moduleId] || null,
    moduleId,
  });
}

/* --------------------------- Mutations ----------------------------- */

export function useSetArenaModuleState() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, moduleId, enabled, config }) =>
      setArenaModuleState(arenaId, moduleId, enabled, config, user),
    onSuccess: (_d, { arenaId, moduleId }) => {
      qc.invalidateQueries({ queryKey: ['arena-module-states', arenaId] });
      qc.invalidateQueries({ queryKey: ['arena-module-state', arenaId, moduleId] });
    },
  });
}

export function useToggleArenaModule() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, moduleId }) => toggleArenaModule(arenaId, moduleId, user),
    onSuccess: (_d, { arenaId, moduleId }) => {
      qc.invalidateQueries({ queryKey: ['arena-module-states', arenaId] });
      qc.invalidateQueries({ queryKey: ['arena-module-state', arenaId, moduleId] });
    },
  });
}
