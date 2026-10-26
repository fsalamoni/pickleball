/**
 * ELEIÇÕES DO CLUBE (Bloco F2) — a visão geral da pessoa, vinda do servidor. Uma consulta só
 * (`overview`): eleições visíveis, chapas, colégio (só de quem conduz) e o que é da pessoa
 * (`mine`). A chave mora sob `assocKeys.all(clubId)`: toda ação da associação e toda ação da
 * eleição invalidam a árvore do clube. Falha é `isError`, nunca "nenhuma eleição".
 */
import { useQuery } from '@tanstack/react-query';
import { assocKeys } from './useClubAssociation.js';
import { clubElectionsAction } from '../services/clubElectionsService.js';

export const clubElectionsKeys = {
  overview: (clubId) => [...assocKeys.all(clubId), 'eleicoes', 'visao'],
  info: (clubId, eid, cid) => [...assocKeys.all(clubId), 'eleicoes', 'apoio', eid, cid],
};

export function useClubElectionsOverview(clubId, { enabled = true } = {}) {
  return useQuery({
    queryKey: clubElectionsKeys.overview(clubId),
    queryFn: () => clubElectionsAction({ clubId, action: 'overview' }),
    enabled: !!clubId && enabled,
    staleTime: 30_000,
  });
}

/** A chapa do link de apoio: o servidor confere a eleição e diz se ainda cabe apoio. */
export function useClubCandidacyInfo(clubId, eid, cid, { enabled = true } = {}) {
  return useQuery({
    queryKey: clubElectionsKeys.info(clubId, eid, cid),
    queryFn: () => clubElectionsAction({ clubId, action: 'candidacy_info', electionId: eid, candidacyId: cid }),
    enabled: !!clubId && !!eid && !!cid && enabled,
    retry: false,
  });
}
