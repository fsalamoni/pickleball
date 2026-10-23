/**
 * LICENÇA DE PROFESSOR e PROTEÇÃO DE MENORES — ganchos do React Query. As
 * chaves moram sob `['federacoes', …]` para a mutação geral
 * (`useFederationMutation`) invalidar tudo de uma vez.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import * as svc from '../services/coachingService';
import { listMyCoachLicenses } from '../services/federationService';

export const coachKeys = {
  licenses: (fedId) => ['federacoes', 'federacao', fedId, 'licencas'],
  minorReports: (fedId) => ['federacoes', 'federacao', fedId, 'protecao', 'denuncias'],
  overview: (fedId) => ['federacoes', 'federacao', fedId, 'protecao', 'quadro'],
  me: (fedId, uid) => ['federacoes', 'coaching', 'me', fedId, uid],
  myLicenses: (uid) => ['federacoes', 'coaching', 'minhas-licencas', uid],
  badges: (uid) => ['federacoes', 'coaching', 'selo', uid],
  credentialed: (fedId) => ['federacoes', 'federacao', fedId, 'professores-credenciados'],
};

export function useFederationCoachLicenses(fedId, { enabled = true } = {}) {
  return useQuery({ queryKey: coachKeys.licenses(fedId), queryFn: () => svc.listFederationCoachLicenses(fedId), enabled: !!fedId && enabled });
}

export function useMinorReports(fedId, { enabled = true } = {}) {
  return useQuery({ queryKey: coachKeys.minorReports(fedId), queryFn: () => svc.listMinorReports(fedId), enabled: !!fedId && enabled });
}

/** Quem trabalha com menores e se está em dia (só o responsável; pelo servidor). */
export function useSafeguardingOverview(fedId, { enabled = true } = {}) {
  return useQuery({ queryKey: coachKeys.overview(fedId), queryFn: () => svc.coachingAction({ federationId: fedId, action: 'sg_overview' }), enabled: !!fedId && enabled });
}

/** A licença e a proteção de menores da própria pessoa numa federação. */
export function useMyCoaching(fedId, { enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: coachKeys.me(fedId, user?.uid), queryFn: () => svc.coachingAction({ federationId: fedId, action: 'me' }), enabled: !!fedId && !!user?.uid && enabled, retry: 1 });
}

export function useMyCoachLicenses({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: coachKeys.myLicenses(user?.uid), queryFn: () => listMyCoachLicenses(user?.uid), enabled: !!user?.uid && enabled });
}

export function useCoachBadges(uid, { enabled = true } = {}) {
  return useQuery({ queryKey: coachKeys.badges(uid), queryFn: () => svc.getCoachBadges(uid), enabled: !!uid && enabled, staleTime: 5 * 60_000 });
}

export function useCredentialedCoaches(fedId, { enabled = true } = {}) {
  return useQuery({ queryKey: coachKeys.credentialed(fedId), queryFn: () => svc.listCredentialedCoaches(fedId), enabled: !!fedId && enabled, staleTime: 5 * 60_000 });
}
