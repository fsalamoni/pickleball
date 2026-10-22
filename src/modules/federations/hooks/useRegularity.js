/**
 * REGULARIDADE — ganchos do React Query. As chaves moram sob `['federacoes', …]`
 * para a mutação geral (`useFederationMutation`) invalidar tudo de uma vez.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import * as svc from '../services/regularityService';

export const regKeys = {
  incidents: (fedId) => ['federacoes', 'federacao', fedId, 'ocorrencias'],
  myIncidents: (uid) => ['federacoes', 'ocorrencias', 'minhas', uid],
};

export function useFederationIncidents(fedId, { enabled = true } = {}) {
  return useQuery({ queryKey: regKeys.incidents(fedId), queryFn: () => svc.listFederationIncidents(fedId), enabled: !!fedId && enabled });
}

export function useMyIncidents({ enabled = true } = {}) {
  const { user } = useAuth();
  const uid = user?.uid;
  return useQuery({ queryKey: regKeys.myIncidents(uid), queryFn: () => svc.listMyIncidents(uid), enabled: !!uid && enabled });
}
