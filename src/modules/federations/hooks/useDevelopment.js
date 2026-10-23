/**
 * EMBAIXADORES e SELO DE CLUBE — ganchos do React Query, sob
 * `['federacoes', …]` para `useFederationMutation` invalidar tudo de uma vez.
 */
import { useQuery } from '@tanstack/react-query';
import * as svc from '../services/developmentService';
import { fedKeys, useFederationMutation } from './useFederations';

export const devKeys = {
  ambassadors: (id) => [...fedKeys.all, 'federacao', id, 'embaixadores'],
  seals: (id) => [...fedKeys.all, 'federacao', id, 'selos'],
  orgSeals: (kind, orgId) => [...fedKeys.all, 'selos-da-organizacao', kind, orgId],
  mine: (uid) => [...fedKeys.all, 'minhas-embaixadas', uid],
};

export const useAmbassadors = (id, { enabled = true } = {}) => useQuery({ queryKey: devKeys.ambassadors(id), queryFn: () => svc.listAmbassadors(id), enabled: !!id && enabled });
export const useClubSeals = (id, { enabled = true } = {}) => useQuery({ queryKey: devKeys.seals(id), queryFn: () => svc.listClubSeals(id), enabled: !!id && enabled });
export const useOrgSeals = (kind, orgId, { enabled = true } = {}) => useQuery({ queryKey: devKeys.orgSeals(kind, orgId), queryFn: () => svc.listOrgSeals(kind, orgId), enabled: !!orgId && enabled });
export const useMyAmbassadorships = (uid, { enabled = true } = {}) => useQuery({ queryKey: devKeys.mine(uid), queryFn: () => svc.listMyAmbassadorships(uid), enabled: !!uid && enabled });

/** `mutate({ action, ...payload })` numa federação. */
export const useDevelopmentAction = (federationId) => useFederationMutation(({ action, ...payload }) => svc.developmentAction(federationId, action, payload));
