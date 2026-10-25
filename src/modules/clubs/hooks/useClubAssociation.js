/**
 * Hooks da ASSOCIAÇÃO DO CLUBE (flag `club_association`).
 *
 * Leitura por React Query; toda mutação invalida a árvore `club-assoc` do
 * clube (barato, e nunca deixa cache velho). Fonte que falha é `isError` —
 * a tela nunca afirma "nenhum plano" / "nenhum associado" sem a consulta ter
 * dado certo (`docs/27-FALHA-NAO-E-VAZIO.md`).
 */
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { clubPermsOf } from '../domain/association.js';
import { useMyMembership } from './useClubs.js';
import {
  associationAction, getMyAffiliation, getMyStaff, getPix, getPlan, listAffiliations, listAllPlans, listCharges, listMyCharges,
  listPublicPlans, listStaff, saveAssociationSettings, savePix, savePlan, setPlanActive, verifyClubCard,
} from '../services/associationService.js';

export const assocKeys = {
  all: (clubId) => ['club-assoc', clubId],
  publicPlans: (clubId) => ['club-assoc', clubId, 'public-plans'],
  allPlans: (clubId) => ['club-assoc', clubId, 'all-plans'],
  plan: (clubId, planId) => ['club-assoc', clubId, 'plan', planId],
  mine: (clubId, uid) => ['club-assoc', clubId, 'mine', uid],
  myCharges: (clubId, uid) => ['club-assoc', clubId, 'my-charges', uid],
  myStaff: (clubId, uid) => ['club-assoc', clubId, 'my-staff', uid],
  affiliations: (clubId) => ['club-assoc', clubId, 'affiliations'],
  charges: (clubId) => ['club-assoc', clubId, 'charges'],
  pix: (clubId) => ['club-assoc', clubId, 'pix'],
  staff: (clubId) => ['club-assoc', clubId, 'staff'],
  verify: (code) => ['club-assoc', 'verify', code],
};

/** Os planos da vitrine (públicos e ativos). */
export function usePublicPlans(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.publicPlans(clubId), queryFn: () => listPublicPlans(clubId), enabled: !!clubId && enabled, staleTime: 60_000 });
}

/** Todos os planos (quem gere). */
export function useAllPlans(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.allPlans(clubId), queryFn: () => listAllPlans(clubId), enabled: !!clubId && enabled });
}

export function useClubPlan(clubId, planId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.plan(clubId, planId), queryFn: () => getPlan(clubId, planId), enabled: !!clubId && !!planId && enabled, staleTime: 60_000 });
}

/** A filiação da pessoa logada neste clube. */
export function useMyAffiliation(clubId, { enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: assocKeys.mine(clubId, user?.uid), queryFn: () => getMyAffiliation(clubId, user?.uid), enabled: !!clubId && !!user?.uid && enabled });
}

export function useMyClubCharges(clubId, { enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: assocKeys.myCharges(clubId, user?.uid), queryFn: () => listMyCharges(clubId, user?.uid), enabled: !!clubId && !!user?.uid && enabled });
}

/** O cargo da pessoa logada neste clube (o que ela pode operar além de ser administradora). */
export function useMyClubStaff(clubId, { enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: assocKeys.myStaff(clubId, user?.uid), queryFn: () => getMyStaff(clubId, user?.uid), enabled: !!clubId && !!user?.uid && enabled, staleTime: 60_000 });
}

/**
 * O papel da pessoa na gestão do clube: administradora do clube (tudo) ou cargo
 * com permissões e mandato. `isLoading` só até as duas fontes responderem;
 * `isError` se alguma falhou (a tela não afirma "sem acesso" sem saber).
 */
export function useMyClubRole(clubId) {
  const membership = useMyMembership(clubId);
  const admin = membership.data?.role === 'admin';
  const staff = useMyClubStaff(clubId, { enabled: membership.isSuccess && !admin });
  const perms = useMemo(() => clubPermsOf({ isClubAdmin: admin, staff: staff.data }), [admin, staff.data]);
  const isLoading = membership.isLoading || (!admin && staff.isLoading);
  const isError = membership.isError || (!admin && staff.isError);
  return {
    perms, isAdmin: admin, isStaff: perms.length > 0, isLoading, isError,
    roleName: admin ? 'admin' : (staff.data?.role_name || ''),
    refetch: () => { membership.refetch(); if (!admin) staff.refetch(); },
  };
}

export function useClubAffiliations(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.affiliations(clubId), queryFn: () => listAffiliations(clubId), enabled: !!clubId && enabled });
}

export function useClubCharges(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.charges(clubId), queryFn: () => listCharges(clubId), enabled: !!clubId && enabled });
}

export function useClubPix(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.pix(clubId), queryFn: () => getPix(clubId), enabled: !!clubId && enabled });
}

export function useClubStaff(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: assocKeys.staff(clubId), queryFn: () => listStaff(clubId), enabled: !!clubId && enabled });
}

/** A verificação pública da carteirinha (sem login). */
export function useClubCardVerification(code) {
  return useQuery({ queryKey: assocKeys.verify(code), queryFn: () => verifyClubCard(code), enabled: !!code, retry: 1, staleTime: 30_000 });
}

/** Toda mutação da associação: invalida a árvore do clube (e a do clube em si, que guarda `association`). */
function useAssocMutation(clubId, fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: assocKeys.all(clubId) });
      qc.invalidateQueries({ queryKey: ['club', clubId] });
      qc.invalidateQueries({ queryKey: ['club-membership', clubId] });
      qc.invalidateQueries({ queryKey: ['public-club', clubId] });
    },
  });
}

/** Uma ação do servidor (pedir, renovar, declarar, aprovar…): `mutate({ action, ...extra })`. */
export function useAssociationAction(clubId) {
  return useAssocMutation(clubId, ({ action, ...extra }) => associationAction(clubId, action, extra));
}

export function useSavePlan(clubId) {
  const { user } = useAuth();
  return useAssocMutation(clubId, ({ planId, input }) => savePlan(clubId, planId || null, input, user));
}

export function useSetPlanActive(clubId) {
  return useAssocMutation(clubId, ({ planId, active }) => setPlanActive(clubId, planId, active));
}

export function useSavePix(clubId) {
  const { user } = useAuth();
  return useAssocMutation(clubId, (input) => savePix(clubId, input, user));
}

export function useSaveAssociationSettings(clubId) {
  const { user } = useAuth();
  return useAssocMutation(clubId, (patch) => saveAssociationSettings(clubId, patch, user));
}
