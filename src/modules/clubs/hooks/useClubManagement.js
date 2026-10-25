/**
 * PATRIMÔNIO DO CLUBE (Bloco E2a) — gancho do React Query. A chave mora sob
 * `assocKeys.all(clubId)`: toda ação da associação invalida a árvore do clube. Fonte que falha
 * é `isError`: a tela nunca afirma "nenhum bem cadastrado" sem a consulta ter dado certo.
 */
import { useQuery } from '@tanstack/react-query';
import { assocKeys } from './useClubAssociation.js';
import { listClubAssets } from '../services/clubManagementService.js';

export const clubManagementKeys = {
  assets: (clubId) => [...assocKeys.all(clubId), 'management', 'assets'],
};

export function useClubAssets(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: clubManagementKeys.assets(clubId), queryFn: () => listClubAssets(clubId), enabled: !!clubId && enabled });
}
