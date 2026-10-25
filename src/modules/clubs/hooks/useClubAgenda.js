/**
 * AGENDA OFICIAL DO CLUBE-ASSOCIAÇÃO (Bloco D2b) — ganchos do React Query. As chaves
 * moram sob `assocKeys.all(clubId)`: toda ação da associação e toda ação da agenda
 * invalidam a árvore do clube inteira. Fonte que falha é `isError`: a tela nunca
 * afirma "agenda vazia" sem a consulta ter dado certo.
 */
import { useQuery } from '@tanstack/react-query';
import { assocKeys } from './useClubAssociation.js';
import { listClubEventsAll, listClubReadableEvents } from '../services/clubAgendaService.js';

export const clubAgendaKeys = {
  all: (clubId) => [...assocKeys.all(clubId), 'agenda', 'equipe'],
  readable: (clubId, member) => [...assocKeys.all(clubId), 'agenda', member ? 'associados' : 'publicos'],
};

export function useClubEventsAll(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: clubAgendaKeys.all(clubId), queryFn: () => listClubEventsAll(clubId), enabled: !!clubId && enabled });
}

/** O que a pessoa lê na página do clube (membro: tudo de associados; visitante: só o público). */
export function useReadableClubEvents(clubId, { member = false, enabled = true } = {}) {
  return useQuery({ queryKey: clubAgendaKeys.readable(clubId, member), queryFn: () => listClubReadableEvents(clubId, { member }), enabled: !!clubId && enabled, staleTime: 2 * 60_000 });
}
