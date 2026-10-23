/**
 * CONTRATOS DE PATROCÍNIO e PATRIMÔNIO — ganchos do React Query, sob
 * `['federacoes', …]` para `useFederationMutation` invalidar tudo de uma vez.
 */
import { useQuery } from '@tanstack/react-query';
import * as svc from '../services/managementService';
import { fedKeys, useFederationMutation } from './useFederations';

export const mgmtKeys = {
  contracts: (id) => [...fedKeys.all, 'federacao', id, 'contratos-patrocinio'],
  assets: (id) => [...fedKeys.all, 'federacao', id, 'patrimonio'],
};

export const useSponsorContracts = (id, { enabled = true } = {}) => useQuery({ queryKey: mgmtKeys.contracts(id), queryFn: () => svc.listSponsorContracts(id), enabled: !!id && enabled });
export const useAssets = (id, { enabled = true } = {}) => useQuery({ queryKey: mgmtKeys.assets(id), queryFn: () => svc.listAssets(id), enabled: !!id && enabled });

/** `mutate({ action, ...payload })` numa federação. */
export const useManagementAction = (federationId) => useFederationMutation(({ action, ...payload }) => svc.managementAction(federationId, action, payload));
