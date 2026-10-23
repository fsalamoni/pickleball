/**
 * PICKLEBALL ADAPTADO — ganchos do React Query, sob `['federacoes', …]` para
 * `useFederationMutation` invalidar tudo de uma vez.
 */
import { useQuery } from '@tanstack/react-query';
import * as svc from '../services/adaptedService';
import { fedKeys, useFederationMutation } from './useFederations';

export const adaptedKeys = {
  list: (id) => [...fedKeys.all, 'federacao', id, 'adaptado'],
  mine: (uid) => [...fedKeys.all, 'minhas-classificacoes', uid],
  check: (tId, mId) => [...fedKeys.all, 'conferencia-adaptada', tId, mId],
};

export const useAdaptedClassifications = (id, { enabled = true } = {}) => useQuery({ queryKey: adaptedKeys.list(id), queryFn: () => svc.listAdaptedClassifications(id), enabled: !!id && enabled });
export const useMyAdaptedClassifications = (uid, { enabled = true } = {}) => useQuery({ queryKey: adaptedKeys.mine(uid), queryFn: () => svc.listMyAdaptedClassifications(uid), enabled: !!uid && enabled });
export const useAdaptedCheck = (tId, mId, { enabled = true } = {}) => useQuery({ queryKey: adaptedKeys.check(tId, mId), queryFn: () => svc.checkAdaptedModality(tId, mId), enabled: !!tId && !!mId && enabled });

/** `mutate({ action, ...payload })` numa federação. */
export const useAdaptedAction = (federationId) => useFederationMutation(({ action, ...payload }) => svc.adaptedAction(federationId, action, payload));
