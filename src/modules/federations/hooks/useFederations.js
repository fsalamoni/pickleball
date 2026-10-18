/**
 * FEDERAÇÕES — ganchos do React Query. As chaves vêm de `fedKeys` (fonte
 * única: chave escrita duas vezes diverge e busca de novo o que já estava em
 * cache).
 */
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import * as svc from '../services/federationService';
import { FED_PERMISSION } from '../domain/constants.js';
import { permissionsOf } from '../domain/staff.js';

export const fedKeys = {
  all: ['federacoes'],
  publicList: ['federacoes', 'diretorio'],
  adminList: ['federacoes', 'admin', 'todas'],
  one: (id) => ['federacoes', 'federacao', id],
  bySlug: (slug) => ['federacoes', 'slug', slug],
  priv: (id) => ['federacoes', 'federacao', id, 'privado'],
  staff: (id) => ['federacoes', 'federacao', id, 'equipe'],
  plans: (id) => ['federacoes', 'federacao', id, 'planos'],
  members: (id) => ['federacoes', 'federacao', id, 'filiados'],
  charges: (id) => ['federacoes', 'federacao', id, 'cobrancas'],
  myRoles: (uid) => ['federacoes', 'meus-papeis', uid],
  myMemberships: (uid) => ['federacoes', 'minhas-filiacoes', uid],
  myCharges: (uid) => ['federacoes', 'minhas-cobrancas', uid],
  myCreated: (uid) => ['federacoes', 'pedidas-por', uid],
  membership: (fedId, uid) => ['federacoes', 'federacao', fedId, 'filiacao', uid],
  verify: (code) => ['federacoes', 'verificar', code],
  affiliations: (id) => ['federacoes', 'federacao', id, 'filiados-orgs'],
  approvedAffiliations: (id) => ['federacoes', 'federacao', id, 'filiados-orgs', 'aprovados'],
  orgAffiliations: (kind, orgId, approvedOnly) => ['federacoes', 'organizacao', kind, orgId, approvedOnly ? 'aprovadas' : 'todas'],
  tournaments: (id) => ['federacoes', 'federacao', id, 'torneios'],
  results: (id) => ['federacoes', 'federacao', id, 'resultados'],
  tournamentResults: (tid) => ['federacoes', 'torneio', tid, 'resultados'],
  ranking: (id, season) => ['federacoes', 'federacao', id, 'ranking', season],
};

/** As federações estão ligadas para quem vê? (a flag do admin) */
export const useFederationsEnabled = () => useFeatureFlag(FEATURE_FLAG.FEDERATIONS);

export function usePublicFederations({ enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.publicList, queryFn: svc.listPublicFederations, staleTime: 5 * 60_000, enabled });
}

export function useFederation(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.one(id), queryFn: () => svc.getFederation(id), enabled: !!id && enabled });
}

export function useFederationBySlug(slug) {
  return useQuery({ queryKey: fedKeys.bySlug(slug), queryFn: () => svc.getFederationBySlug(slug), enabled: !!slug });
}

export function useFederationPrivate(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.priv(id), queryFn: () => svc.getFederationPrivate(id), enabled: !!id && enabled });
}

export function useFederationStaff(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.staff(id), queryFn: () => svc.listFederationStaff(id), enabled: !!id && enabled });
}

export function useFederationPlans(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.plans(id), queryFn: () => svc.listFederationPlans(id), enabled: !!id && enabled });
}

export function useFederationMembers(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.members(id), queryFn: () => svc.listFederationMembers(id), enabled: !!id && enabled });
}

export function useFederationCharges(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.charges(id), queryFn: () => svc.listFederationCharges(id), enabled: !!id && enabled });
}

/** Admin da plataforma: todas, em qualquer estado. */
export function useAdminFederations({ enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.adminList, queryFn: svc.listAllFederations, enabled });
}

/** As federações que a pessoa pediu para abrir (pendente, recusada…). */
export function useMyCreatedFederations({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: fedKeys.myCreated(user?.uid), queryFn: () => svc.listFederationsCreatedBy(user?.uid), enabled: !!user?.uid && enabled });
}

/** Os papéis da pessoa em todas as federações — uma consulta, compartilhada. */
export function useMyFederationRoles({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: fedKeys.myRoles(user?.uid), queryFn: () => svc.listMyStaffRoles(user?.uid), enabled: !!user?.uid && enabled, staleTime: 60_000 });
}

/** O papel e as permissões de quem vê NESTA federação (admin da plataforma tem tudo). */
export function useMyFederationRole(fedId) {
  const { isPlatformAdmin } = useAuth();
  const q = useMyFederationRoles({ enabled: !!fedId });
  return useMemo(() => {
    const mine = (q.data || []).find((s) => s.federation_id === fedId) || null;
    const perms = isPlatformAdmin ? Object.values(FED_PERMISSION) : permissionsOf(mine?.role);
    return { staff: mine, role: mine?.role || null, perms, has: (p) => perms.includes(p), isStaff: Boolean(mine) || isPlatformAdmin, isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
  }, [q.data, q.isLoading, q.isError, q.refetch, fedId, isPlatformAdmin]);
}

export function useMyMemberships({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: fedKeys.myMemberships(user?.uid), queryFn: () => svc.listMyMemberships(user?.uid), enabled: !!user?.uid && enabled });
}

export function useMyFederationCharges({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: fedKeys.myCharges(user?.uid), queryFn: () => svc.listMyCharges(user?.uid), enabled: !!user?.uid && enabled });
}

/** A minha filiação numa federação. */
export function useMyMembership(fedId, { enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: fedKeys.membership(fedId, user?.uid), queryFn: () => svc.getMembership(fedId, user?.uid), enabled: !!fedId && !!user?.uid && enabled });
}

/** Verificação pública da carteirinha (sem conta). */
export function useCardVerification(code) {
  return useQuery({ queryKey: fedKeys.verify(code), queryFn: () => svc.verifyCard(code), enabled: !!code, retry: 1, staleTime: 30_000 });
}

/** Toda mutação invalida a árvore das federações (barato, e nunca deixa cache velho). */
export function useFederationMutation(fn) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries({ queryKey: fedKeys.all }) });
}

/* ------------------------------------------- PR 2: filiados, chancela, ranking -- */

export function useFederationAffiliations(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.affiliations(id), queryFn: () => svc.listFederationAffiliations(id), enabled: !!id && enabled });
}

/** Os filiados aprovados — público (página da federação). */
export function useApprovedAffiliations(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.approvedAffiliations(id), queryFn: () => svc.listApprovedAffiliations(id), enabled: !!id && enabled, staleTime: 5 * 60_000 });
}

/** As filiações de um clube/arena. `approvedOnly` para quem não gere (o selo público). */
export function useOrgAffiliations(kind, orgId, { approvedOnly = false, enabled = true } = {}) {
  const ligado = useFederationsEnabled();
  return useQuery({ queryKey: fedKeys.orgAffiliations(kind, orgId, approvedOnly), queryFn: () => svc.listOrgAffiliations(kind, orgId, { approvedOnly }), enabled: !!kind && !!orgId && ligado && enabled, staleTime: 5 * 60_000 });
}

/** Os torneios ligados à federação (pendentes de chancela e chancelados). */
export function useFederationTournaments(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.tournaments(id), queryFn: () => svc.listFederationTournaments(id), enabled: !!id && enabled });
}

export function useFederationResults(id, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.results(id), queryFn: () => svc.listFederationResults(id), enabled: !!id && enabled });
}

/** O que o organizador já enviou deste torneio. */
export function useTournamentFederationResults(tournamentId, { enabled = true } = {}) {
  const ligado = useFederationsEnabled();
  return useQuery({ queryKey: fedKeys.tournamentResults(tournamentId), queryFn: () => svc.listTournamentFederationResults(tournamentId), enabled: !!tournamentId && ligado && enabled });
}

/** O ranking oficial da temporada (gravado pelo servidor; `null` = ainda não há). */
export function useFederationRanking(id, season, { enabled = true } = {}) {
  return useQuery({ queryKey: fedKeys.ranking(id, season), queryFn: () => svc.getFederationRanking(id, season), enabled: !!id && !!season && enabled, staleTime: 60_000 });
}
