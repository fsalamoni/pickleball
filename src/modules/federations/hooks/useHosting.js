/**
 * SEDES E COPA — ganchos do React Query, sob `['federacoes', …]` para
 * `useFederationMutation` invalidar tudo de uma vez.
 */
import { useQueries, useQuery } from '@tanstack/react-query';
import * as svc from '../services/hostingService';
import { fedKeys, useFederationMutation } from './useFederations';

export const hostKeys = {
  bids: (id, equipe) => [...fedKeys.all, 'federacao', id, 'sedes', equipe ? 'equipe' : 'publico'],
  entries: (id, bidId) => [...fedKeys.all, 'federacao', id, 'sedes', bidId, 'candidaturas'],
  scores: (id, bidId) => [...fedKeys.all, 'federacao', id, 'sedes', bidId, 'notas'],
  orgEntries: (kind, orgId) => [...fedKeys.all, 'sedes-da-organizacao', kind, orgId],
  cups: (id, equipe) => [...fedKeys.all, 'federacao', id, 'copas', equipe ? 'equipe' : 'publico'],
  cupTeams: (id) => [...fedKeys.all, 'federacao', id, 'copas', 'elencos'],
  myFedTeams: (id) => [...fedKeys.all, 'federacao', id, 'copas', 'meus-elencos'],
};

export const useHostBids = (id, { equipe = false, enabled = true } = {}) => useQuery({ queryKey: hostKeys.bids(id, equipe), queryFn: () => svc.listHostBids(id, { equipe }), enabled: !!id && enabled });
export const useBidEntries = (id, bidId, { enabled = true } = {}) => useQuery({ queryKey: hostKeys.entries(id, bidId), queryFn: () => svc.listBidEntries(id, bidId), enabled: !!id && !!bidId && enabled });
export const useBidScores = (id, bidId, { enabled = true } = {}) => useQuery({ queryKey: hostKeys.scores(id, bidId), queryFn: () => svc.listBidScores(id, bidId), enabled: !!id && !!bidId && enabled });
export const useOrgHostEntries = (kind, orgId, { enabled = true } = {}) => useQuery({ queryKey: hostKeys.orgEntries(kind, orgId), queryFn: () => svc.listOrgHostEntries(kind, orgId), enabled: !!orgId && enabled });
export const useCups = (id, { equipe = false, enabled = true } = {}) => useQuery({ queryKey: hostKeys.cups(id, equipe), queryFn: () => svc.listCups(id, { equipe }), enabled: !!id && enabled });
export const useCupTeams = (id, { enabled = true } = {}) => useQuery({ queryKey: hostKeys.cupTeams(id), queryFn: () => svc.listCupTeams(id), enabled: !!id && enabled });
export const useMyFederationCupTeams = (id, { enabled = true } = {}) => useQuery({ queryKey: hostKeys.myFedTeams(id), queryFn: () => svc.listMyFederationCupTeams(id), enabled: !!id && enabled });

/** Os editais publicados de VÁRIAS federações (a organização vê os de onde pode se candidatar). */
export function usePublicHostBidsOf(ids = []) {
  return useQueries({ queries: ids.map((id) => ({ queryKey: hostKeys.bids(id, false), queryFn: () => svc.listHostBids(id) })) });
}

/** `mutate({ action, ...payload })` numa federação. */
export const useHostingAction = (federationId) => useFederationMutation(({ action, ...payload }) => svc.hostingAction(federationId, action, payload));
