/**
 * DISCIPLINA E OUVIDORIA DO CLUBE (Bloco E1) — ganchos do React Query. As chaves moram sob
 * `assocKeys.all(clubId)`: toda ação da associação e da disciplina invalida a árvore do clube.
 * Fonte que falha é `isError`: a tela nunca afirma "nenhuma sanção" sem a consulta ter dado certo.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { assocKeys } from './useClubAssociation.js';
import { clubDisciplineAction, listClubCases, listClubOmbud, listMyClubCases } from '../services/clubDisciplineService.js';

export const clubDisciplineKeys = {
  cases: (clubId) => [...assocKeys.all(clubId), 'discipline', 'cases'],
  mine: (clubId, uid) => [...assocKeys.all(clubId), 'discipline', 'mine', uid],
  ombud: (clubId) => [...assocKeys.all(clubId), 'discipline', 'ombud'],
};

/** Todas as sanções (a disciplina). */
export function useClubCases(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: clubDisciplineKeys.cases(clubId), queryFn: () => listClubCases(clubId), enabled: !!clubId && enabled });
}

/** As sanções da pessoa logada neste clube. */
export function useMyClubCases(clubId, { enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: clubDisciplineKeys.mine(clubId, user?.uid), queryFn: () => listMyClubCases(clubId, user?.uid), enabled: !!clubId && !!user?.uid && enabled });
}

/** Uma ação do clube na disciplina (recurso, manifestação…): `mutate({ action, ...extra })`. */
export function useClubDisciplineAction(clubId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => clubDisciplineAction({ clubId, ...payload }),
    onSettled: () => qc.invalidateQueries({ queryKey: assocKeys.all(clubId) }),
  });
}

/** O estado de uma manifestação pelo protocolo (só quem enviou, ou a anônima com o protocolo). */
export function useClubReportStatus(clubId, reportId) {
  return useQuery({
    queryKey: [...clubDisciplineKeys.ombud(clubId), 'status', reportId],
    queryFn: () => clubDisciplineAction({ clubId, action: 'report_status', reportId }).then((r) => r.report),
    enabled: !!clubId && !!reportId,
    retry: 0,
  });
}

/** A ouvidoria (a disciplina). */
export function useClubOmbud(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: clubDisciplineKeys.ombud(clubId), queryFn: () => listClubOmbud(clubId), enabled: !!clubId && enabled });
}
