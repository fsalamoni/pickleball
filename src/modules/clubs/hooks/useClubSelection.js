/**
 * SELEÇÃO DO CLUBE (Bloco E3) — ganchos do React Query. As chaves moram sob `assocKeys.all(clubId)`:
 * toda ação invalida a árvore do clube. Fonte que falha é `isError` — a tela nunca afirma
 * "nenhuma convocação" sem a consulta ter dado certo.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { assocKeys } from './useClubAssociation.js';
import { clubSelectionAction, listPublicCallups } from '../services/clubSelectionService.js';

export const clubSelectionKeys = {
  list: (clubId) => [...assocKeys.all(clubId), 'selecao', 'lista'],
  members: (clubId, callupId) => [...assocKeys.all(clubId), 'selecao', 'convidados', callupId],
  mine: (clubId, uid) => [...assocKeys.all(clubId), 'selecao', 'minhas', uid],
  pub: (clubId) => [...assocKeys.all(clubId), 'selecao', 'publica'],
};

/** As convocações do clube (diretoria esportiva; pelo servidor). */
export function useClubCallups(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: clubSelectionKeys.list(clubId), queryFn: () => clubSelectionAction({ clubId, action: 'list' }), enabled: !!clubId && enabled });
}

/** Os convidados de uma convocação. */
export function useCallupMembers(clubId, callupId, { enabled = true } = {}) {
  return useQuery({ queryKey: clubSelectionKeys.members(clubId, callupId), queryFn: () => clubSelectionAction({ clubId, action: 'members', callupId }), enabled: !!clubId && !!callupId && enabled });
}

/** Os convites da própria pessoa neste clube. */
export function useMyCallups(clubId, { enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: clubSelectionKeys.mine(clubId, user?.uid), queryFn: () => clubSelectionAction({ clubId, action: 'mine' }), enabled: !!clubId && !!user?.uid && enabled, retry: 1 });
}

/** A lista pública das delegações (visitante e associado). */
export function usePublicCallups(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: clubSelectionKeys.pub(clubId), queryFn: () => listPublicCallups(clubId), enabled: !!clubId && enabled, retry: 1 });
}

/** Uma ação do servidor: `mutate({ action, ...extra })`. */
export function useClubSelectionAction(clubId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => clubSelectionAction({ clubId, ...payload }),
    onSettled: () => qc.invalidateQueries({ queryKey: assocKeys.all(clubId) }),
  });
}
