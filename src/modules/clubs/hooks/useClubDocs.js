/**
 * ACERVO DO CLUBE-ASSOCIAÇÃO (Bloco D2) — ganchos do React Query. As chaves moram sob
 * `assocKeys.all(clubId)`, então toda ação da associação e toda ação do acervo
 * invalidam a árvore do clube inteira. Fonte que falha é `isError`: a tela nunca
 * afirma "sem documentos" sem a consulta ter dado certo.
 */
import { useQuery } from '@tanstack/react-query';
import { assocKeys } from './useClubAssociation.js';
import { listClubDocsAll, listClubReadableDocs } from '../services/clubDocsService.js';

export const clubDocKeys = {
  all: (clubId) => [...assocKeys.all(clubId), 'docs', 'equipe'],
  readable: (clubId, member) => [...assocKeys.all(clubId), 'docs', member ? 'associados' : 'publicos'],
};

export function useClubDocsAll(clubId, { enabled = true } = {}) {
  return useQuery({ queryKey: clubDocKeys.all(clubId), queryFn: () => listClubDocsAll(clubId), enabled: !!clubId && enabled });
}

/** O que a pessoa lê na página do clube (membro: tudo de associados; visitante: só o público). */
export function useReadableClubDocs(clubId, { member = false, enabled = true } = {}) {
  return useQuery({ queryKey: clubDocKeys.readable(clubId, member), queryFn: () => listClubReadableDocs(clubId, { member }), enabled: !!clubId && enabled, staleTime: 2 * 60_000 });
}
