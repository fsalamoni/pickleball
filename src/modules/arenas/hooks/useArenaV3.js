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
import {
  listArenaOpenSlots,
  listOpenSlotsGlobal,
  getOpenSlot,
  createOpenSlot,
  updateOpenSlot,
  cancelOpenSlot,
  joinOpenSlot,
  leaveOpenSlot,
  deleteOpenSlot,
} from '../services/openMatchService.js';
import {
  joinWaitlist,
  leaveWaitlist,
  listSlotWaitlist,
  listUserWaitlist,
  getUserWaitlistEntry,
  notifyNextInLine,
  acceptWaitlistPromotion,
  declineWaitlistPromotion,
} from '../services/waitlistService.js';

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

/* ----------------------------- Open Match ----------------------------- */

export function useArenaOpenSlots(arenaId, filters = {}) {
  return useQuery({
    queryKey: ['arena-open-slots', arenaId, filters],
    queryFn: () => listArenaOpenSlots(arenaId, filters),
    enabled: !!arenaId,
    staleTime: 30_000,
  });
}

export function useGlobalOpenSlots(filters = {}) {
  return useQuery({
    queryKey: ['open-slots-global', filters],
    queryFn: () => listOpenSlotsGlobal(filters),
    staleTime: 30_000,
  });
}

export function useOpenSlot(slotId) {
  return useQuery({
    queryKey: ['open-slot', slotId],
    queryFn: () => getOpenSlot(slotId),
    enabled: !!slotId,
    staleTime: 15_000,
  });
}

export function useCreateOpenSlot() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, input }) => createOpenSlot(arenaId, input, user),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: ['arena-open-slots', arenaId] });
      qc.invalidateQueries({ queryKey: ['open-slots-global'] });
    },
  });
}

export function useUpdateOpenSlot() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slotId, updates }) => updateOpenSlot(slotId, updates, user),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: ['arena-open-slots', arenaId] });
    },
  });
}

export function useCancelOpenSlot() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slotId, reason }) => cancelOpenSlot(slotId, reason, user),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: ['arena-open-slots', arenaId] });
    },
  });
}

export function useJoinOpenSlot() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId) => joinOpenSlot(slotId, user, userProfile),
    onSuccess: (_d, slotId) => {
      qc.invalidateQueries({ queryKey: ['open-slot', slotId] });
      qc.invalidateQueries({ queryKey: ['open-slots-global'] });
      qc.invalidateQueries({ queryKey: ['arena-open-slots'] });
    },
  });
}

export function useLeaveOpenSlot() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId) => leaveOpenSlot(slotId, user?.uid),
    onSuccess: (_d, slotId) => {
      qc.invalidateQueries({ queryKey: ['open-slot', slotId] });
      qc.invalidateQueries({ queryKey: ['open-slots-global'] });
    },
  });
}

export function useDeleteOpenSlot() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId) => deleteOpenSlot(slotId, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['open-slots-global'] });
      qc.invalidateQueries({ queryKey: ['arena-open-slots'] });
    },
  });
}

/* ------------------------------- Waitlist ----------------------------- */

export function useSlotWaitlist(slotId) {
  return useQuery({
    queryKey: ['slot-waitlist', slotId],
    queryFn: () => listSlotWaitlist(slotId),
    enabled: !!slotId,
    staleTime: 15_000,
  });
}

export function useUserWaitlistEntry(slotId) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-waitlist-entry', slotId, user?.uid],
    queryFn: () => getUserWaitlistEntry(user?.uid, slotId),
    enabled: !!user?.uid && !!slotId,
    staleTime: 15_000,
  });
}

export function useUserWaitlist() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-waitlist', user?.uid],
    queryFn: () => listUserWaitlist(user?.uid),
    enabled: !!user?.uid,
    staleTime: 30_000,
  });
}

export function useJoinWaitlist() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId) => joinWaitlist(slotId, user, userProfile),
    onSuccess: (_d, slotId) => {
      qc.invalidateQueries({ queryKey: ['slot-waitlist', slotId] });
      qc.invalidateQueries({ queryKey: ['user-waitlist-entry', slotId] });
      qc.invalidateQueries({ queryKey: ['user-waitlist'] });
    },
  });
}

export function useLeaveWaitlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId) => leaveWaitlist(slotId, user?.uid, user),
    onSuccess: (_d, slotId) => {
      qc.invalidateQueries({ queryKey: ['slot-waitlist', slotId] });
      qc.invalidateQueries({ queryKey: ['user-waitlist-entry', slotId] });
    },
  });
}

export function useAcceptWaitlist() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId) => acceptWaitlistPromotion(slotId, user, userProfile),
    onSuccess: (_d, slotId) => {
      qc.invalidateQueries({ queryKey: ['slot-waitlist', slotId] });
      qc.invalidateQueries({ queryKey: ['open-slot', slotId] });
    },
  });
}

export function useDeclineWaitlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId) => declineWaitlistPromotion(slotId, user, user),
    onSuccess: (_d, slotId) => {
      qc.invalidateQueries({ queryKey: ['slot-waitlist', slotId] });
    },
  });
}

/* ------------------------ Members (sprint 2) ------------------------ */

import {
  listArenaMembers, getArenaMember, addArenaMember, removeArenaMember,
  addPointsToMember, listArenaPackages, createArenaPackage, updateArenaPackage,
  deleteArenaPackage, purchasePackage, getArenaWallet, creditWallet, applyCashback,
} from '../services/membersService.js';

export function useArenaMembers(arenaId) {
  return useQuery({
    queryKey: ['arena-members', arenaId],
    queryFn: () => listArenaMembers(arenaId),
    enabled: !!arenaId,
    staleTime: 30_000,
  });
}

export function useArenaMember(arenaId, userId) {
  return useQuery({
    queryKey: ['arena-member', arenaId, userId],
    queryFn: () => getArenaMember(arenaId, userId),
    enabled: !!arenaId && !!userId,
    staleTime: 30_000,
  });
}

export function useAddArenaMember() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, target }) => addArenaMember(arenaId, target, user),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: ['arena-members', arenaId] });
    },
  });
}

export function useRemoveArenaMember() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, userId }) => removeArenaMember(arenaId, userId, user),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: ['arena-members', arenaId] });
    },
  });
}

export function useArenaPackages(arenaId) {
  return useQuery({
    queryKey: ['arena-packages', arenaId],
    queryFn: () => listArenaPackages(arenaId),
    enabled: !!arenaId,
    staleTime: 60_000,
  });
}

export function useCreatePackage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, input }) => createArenaPackage(arenaId, input, user),
    onSuccess: (_d, { arenaId }) => qc.invalidateQueries({ queryKey: ['arena-packages', arenaId] }),
  });
}

export function useDeletePackage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pkgId }) => deleteArenaPackage(pkgId, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arena-packages'] }),
  });
}

export function usePurchasePackage() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, pkgId }) => purchasePackage(arenaId, pkgId, user, userProfile),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: ['arena-packages', arenaId] });
      qc.invalidateQueries({ queryKey: ['arena-wallet', arenaId, user?.uid] });
      qc.invalidateQueries({ queryKey: ['arena-member', arenaId, user?.uid] });
    },
  });
}

export function useArenaWallet(arenaId, userId) {
  return useQuery({
    queryKey: ['arena-wallet', arenaId, userId],
    queryFn: () => getArenaWallet(arenaId, userId),
    enabled: !!arenaId && !!userId,
    staleTime: 30_000,
  });
}

/* ---------------------- PDV (sprint 3) ---------------------- */

import {
  listArenaProducts, createArenaProduct, updateArenaProduct, deleteArenaProduct,
  createSale, listArenaSales, listUserSales,
  listArenaPayments, confirmPayment,
} from '../services/pdvService.js';

export function useArenaProducts(arenaId) {
  return useQuery({
    queryKey: ['arena-products', arenaId],
    queryFn: () => listArenaProducts(arenaId),
    enabled: !!arenaId,
    staleTime: 60_000,
  });
}

export function useCreateProduct() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, input }) => createArenaProduct(arenaId, input, user),
    onSuccess: (_d, { arenaId }) => qc.invalidateQueries({ queryKey: ['arena-products', arenaId] }),
  });
}

export function useDeleteProduct() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ prodId }) => deleteArenaProduct(prodId, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arena-products'] }),
  });
}

export function useCreateSale() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, items, paymentMethod, splitWith }) =>
      createSale(arenaId, items, paymentMethod, splitWith, user, userProfile),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: ['arena-products', arenaId] });
      qc.invalidateQueries({ queryKey: ['arena-sales', arenaId] });
    },
  });
}

export function useArenaSales(arenaId) {
  return useQuery({
    queryKey: ['arena-sales', arenaId],
    queryFn: () => listArenaSales(arenaId),
    enabled: !!arenaId,
    staleTime: 30_000,
  });
}

export function useConfirmPayment() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId }) => confirmPayment(paymentId, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arena-payments'] }),
  });
}

/* -------------------- Classes (sprint 4) -------------------- */

import {
  listArenaCoaches, createArenaCoach, deleteArenaCoach,
  listArenaClasses, createArenaClass, bookClass,
} from '../services/classesService.js';

export function useArenaCoaches(arenaId) {
  return useQuery({
    queryKey: ['arena-coaches', arenaId],
    queryFn: () => listArenaCoaches(arenaId),
    enabled: !!arenaId,
    staleTime: 60_000,
  });
}

export function useCreateCoach() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, input }) => createArenaCoach(arenaId, input, user),
    onSuccess: (_d, { arenaId }) => qc.invalidateQueries({ queryKey: ['arena-coaches', arenaId] }),
  });
}

export function useArenaClasses(arenaId, filters = {}) {
  return useQuery({
    queryKey: ['arena-classes', arenaId, filters],
    queryFn: () => listArenaClasses(arenaId, filters),
    enabled: !!arenaId,
    staleTime: 30_000,
  });
}

export function useCreateClass() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, input }) => createArenaClass(arenaId, input, user),
    onSuccess: (_d, { arenaId }) => qc.invalidateQueries({ queryKey: ['arena-classes', arenaId] }),
  });
}

export function useBookClass() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (classId) => bookClass(classId, user, userProfile),
    onSuccess: (_d, classId) => {
      qc.invalidateQueries({ queryKey: ['arena-classes'] });
      qc.invalidateQueries({ queryKey: ['class', classId] });
    },
  });
}
