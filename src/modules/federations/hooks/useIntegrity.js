/**
 * JOGO LIMPO — ganchos do React Query, sob `['federacoes', …]` para
 * `useFederationMutation` invalidar tudo de uma vez.
 */
import { useQuery } from '@tanstack/react-query';
import * as svc from '../services/integrityService';
import { fedKeys, useFederationMutation } from './useFederations';

export const integrityKeys = { equipment: (id) => [...fedKeys.all, 'federacao', id, 'equipamentos'] };

export const useEquipment = (id, { enabled = true } = {}) => useQuery({ queryKey: integrityKeys.equipment(id), queryFn: () => svc.listEquipment(id), enabled: !!id && enabled });

/** `mutate({ action, ...payload })` numa federação. */
export const useIntegrityAction = (federationId) => useFederationMutation(({ action, ...payload }) => svc.integrityAction(federationId, action, payload));
