/**
 * COMPETIÇÕES — ganchos do React Query. As chaves moram sob `['federacoes', …]`
 * para a mutação geral (`useFederationMutation`) invalidar tudo de uma vez.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import * as svc from '../services/competitionsService';

export const compKeys = {
  report: (tid) => ['federacoes', 'relatorio-torneio', tid],
  reports: (fedId) => ['federacoes', 'federacao', fedId, 'relatorios-torneio'],
  invites: (fedId, tid) => ['federacoes', 'federacao', fedId, 'final', tid],
  fees: (fedId) => ['federacoes', 'federacao', fedId, 'taxas-chancela'],
  fee: (chargeId) => ['federacoes', 'taxa-chancela', chargeId],
  myInvites: (uid) => ['federacoes', 'final', 'meus', uid],
  myReports: (uid) => ['federacoes', 'relatorios-torneio', 'meus', uid],
};

export function useTournamentReport(tid, { enabled = true } = {}) {
  return useQuery({ queryKey: compKeys.report(tid), queryFn: () => svc.getTournamentReport(tid), enabled: !!tid && enabled });
}

export function useFederationTournamentReports(fedId, { enabled = true } = {}) {
  return useQuery({ queryKey: compKeys.reports(fedId), queryFn: () => svc.listFederationTournamentReports(fedId), enabled: !!fedId && enabled });
}

export function useFinalInvites(fedId, tid, { enabled = true } = {}) {
  return useQuery({ queryKey: compKeys.invites(fedId, tid), queryFn: () => svc.listFinalInvites(fedId, tid), enabled: !!fedId && !!tid && enabled });
}

export function useSanctionFees(fedId, { enabled = true } = {}) {
  return useQuery({ queryKey: compKeys.fees(fedId), queryFn: () => svc.listSanctionFees(fedId), enabled: !!fedId && enabled });
}

export function useSanctionFee(chargeId, { enabled = true } = {}) {
  return useQuery({ queryKey: compKeys.fee(chargeId), queryFn: () => svc.getSanctionFee(chargeId), enabled: !!chargeId && enabled });
}

export function useMyFinalInvites({ enabled = true } = {}) {
  const { user } = useAuth();
  const uid = user?.uid;
  return useQuery({ queryKey: compKeys.myInvites(uid), queryFn: () => svc.listMyFinalInvites(uid), enabled: !!uid && enabled });
}

export function useMyDirectedReports({ enabled = true } = {}) {
  const { user } = useAuth();
  const uid = user?.uid;
  return useQuery({ queryKey: compKeys.myReports(uid), queryFn: () => svc.listMyDirectedReports(uid), enabled: !!uid && enabled });
}
