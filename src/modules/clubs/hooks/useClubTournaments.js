/**
 * TORNEIOS DO CLUBE (Bloco E3b) — gancho do React Query, sob `assocKeys.all(clubId)`.
 * Falha de consulta é `isError`: a tela nunca afirma "nenhum torneio" sem a consulta ter dado certo.
 */
import { useQuery } from '@tanstack/react-query';
import { assocKeys } from './useClubAssociation.js';
import { listClubTournaments } from '../services/clubTournamentsService.js';

export const clubTournamentKeys = {
  list: (clubId) => [...assocKeys.all(clubId), 'torneios'],
};

export function useClubTournaments(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: clubTournamentKeys.list(clubId), queryFn: () => listClubTournaments(clubId), enabled: !!clubId && enabled, retry: 1 });
}
