/**
 * PROTEÇÃO DE MENORES DO CLUBE (Bloco E2b) — ganchos do React Query. As chaves moram sob
 * `assocKeys.all(clubId)`: toda ação invalida a árvore do clube. Fonte que falha é `isError`: a
 * tela nunca afirma "ninguém trabalha com menores" sem a consulta ter dado certo.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { assocKeys } from './useClubAssociation.js';
import { clubSafeguardingAction } from '../services/clubSafeguardingService.js';

export const clubSafeguardingKeys = {
  overview: (clubId) => [...assocKeys.all(clubId), 'safeguarding', 'quadro'],
  minors: (clubId) => [...assocKeys.all(clubId), 'safeguarding', 'menores'],
  me: (clubId, uid) => [...assocKeys.all(clubId), 'safeguarding', 'me', uid],
};

/** Quem trabalha com menores e se está em dia (só a disciplina; pelo servidor). */
export function useClubSgOverview(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: clubSafeguardingKeys.overview(clubId), queryFn: () => clubSafeguardingAction({ clubId, action: 'sg_overview' }), enabled: !!clubId && enabled });
}

/** Os associados menores de idade e o responsável de cada um (só a disciplina). */
export function useClubMinors(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: clubSafeguardingKeys.minors(clubId), queryFn: () => clubSafeguardingAction({ clubId, action: 'minors_overview' }), enabled: !!clubId && enabled });
}

/** A proteção de menores da própria pessoa neste clube. */
export function useMyClubProtection(clubId, { enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: clubSafeguardingKeys.me(clubId, user?.uid), queryFn: () => clubSafeguardingAction({ clubId, action: 'me' }), enabled: !!clubId && !!user?.uid && enabled, retry: 1 });
}

/** Uma ação do servidor (aceitar, conferir, designar…): `mutate({ action, ...extra })`. */
export function useClubSafeguardingAction(clubId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => clubSafeguardingAction({ clubId, ...payload }),
    onSettled: () => qc.invalidateQueries({ queryKey: assocKeys.all(clubId) }),
  });
}
