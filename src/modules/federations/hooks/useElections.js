/**
 * ELEIÇÕES — ganchos do React Query. Chaves debaixo de `fedKeys.all`, para
 * a invalidação de `useFederationMutation` alcançá-las.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import * as svc from '../services/electionsService';
import { electionAction, listMyCandidacies, listMyElectionEndorsements, listMyElectionVoters } from '../services/federationService';
import { useFederationMutation } from './useFederations';

export const electionKeys = {
  public: (fedId) => ['federacoes', 'eleicoes', 'publicas', fedId],
  all: (fedId) => ['federacoes', 'eleicoes', 'todas', fedId],
  commission: (uid) => ['federacoes', 'eleicoes', 'comissao', uid],
  candidacies: (fedId, eid, all) => ['federacoes', 'eleicoes', 'chapas', fedId, eid, all ? 'todas' : 'aceitas'],
  fedCandidacies: (fedId) => ['federacoes', 'eleicoes', 'chapas-da-federacao', fedId],
  voters: (fedId, eid) => ['federacoes', 'eleicoes', 'colegio', fedId, eid],
  myVoters: (uid) => ['federacoes', 'eleicoes', 'meu-colegio', uid],
  myCandidacies: (uid) => ['federacoes', 'eleicoes', 'minhas-chapas', uid],
  myEndorsements: (uid) => ['federacoes', 'eleicoes', 'meus-apoios', uid],
};

export const usePublicElections = (fedId, { enabled = true } = {}) => useQuery({ queryKey: electionKeys.public(fedId), queryFn: () => svc.listPublicElections(fedId), enabled: !!fedId && enabled });
export const useFederationElections = (fedId, { enabled = true } = {}) => useQuery({ queryKey: electionKeys.all(fedId), queryFn: () => svc.listFederationElections(fedId), enabled: !!fedId && enabled });
export const useElectionCandidacies = (fedId, eid, { all = false, enabled = true } = {}) => useQuery({ queryKey: electionKeys.candidacies(fedId, eid, all), queryFn: () => svc.listElectionCandidacies(fedId, eid, { all }), enabled: !!fedId && !!eid && enabled });
export const useFederationCandidacies = (fedId, { enabled = true } = {}) => useQuery({ queryKey: electionKeys.fedCandidacies(fedId), queryFn: () => svc.listFederationCandidacies(fedId), enabled: !!fedId && enabled });
export const useElectionVoters = (fedId, eid, { enabled = true } = {}) => useQuery({ queryKey: electionKeys.voters(fedId, eid), queryFn: () => svc.listElectionVoters(fedId, eid), enabled: !!fedId && !!eid && enabled });

export function useMyCommissionElections({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: electionKeys.commission(user?.uid), queryFn: () => svc.listMyCommissionElections(user?.uid), enabled: !!user?.uid && enabled });
}
export function useMyElectionVoters({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: electionKeys.myVoters(user?.uid), queryFn: () => listMyElectionVoters(user?.uid), enabled: !!user?.uid && enabled });
}
export function useMyCandidacies({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: electionKeys.myCandidacies(user?.uid), queryFn: () => listMyCandidacies(user?.uid), enabled: !!user?.uid && enabled });
}
export function useMyElectionEndorsements({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: electionKeys.myEndorsements(user?.uid), queryFn: () => listMyElectionEndorsements(user?.uid), enabled: !!user?.uid && enabled });
}

/** A chapa do link de apoio (`?apoiar=`): o servidor confere a eleição e diz se ainda cabe apoio. */
export const useCandidacyInfo = (fedId, eid, cid, { enabled = true } = {}) => useQuery({
  queryKey: ['federacoes', 'eleicoes', 'apoio', fedId, eid, cid],
  queryFn: () => electionAction({ federationId: fedId, action: 'candidacy_info', electionId: eid, candidacyId: cid }),
  enabled: !!fedId && !!eid && !!cid && enabled,
  retry: false,
});

/** Toda ação da eleição (pelo servidor); invalida a árvore das federações. */
export const useElectionAction = () => useFederationMutation(electionAction);
