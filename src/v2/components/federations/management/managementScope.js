/**
 * O ESCOPO do patrimônio: a mesma tela de inventário e empréstimo serve a federação e o
 * clube-associação (Bloco E2a). O painel recebe uma "entidade": a federação como ela é, ou o
 * clube no mesmo formato (`clubManagementEntity`, com `kind: 'club'`). Mudam só a leitura, a
 * função do servidor chamada (`federationManagement` × `clubManagement`) e os textos que falam
 * "da federação"; a régua (`domain/management.js`) é a mesma.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useAssets, useManagementAction } from '@/modules/federations/hooks/useManagement';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { useClubAssets } from '@/modules/clubs/hooks/useClubManagement';
import { assocKeys } from '@/modules/clubs/hooks/useClubAssociation';
import { clubManagementAction } from '@/modules/clubs/services/clubManagementService';

export const isClubManagement = (entity) => entity?.kind === 'club';

/** O clube no formato que o painel lê. */
export const clubManagementEntity = (club) => ({ id: club?.id, kind: 'club', name: club?.name || '', acronym: club?.name || club?.id, slug: club?.id });

/** O texto da federação ou o do clube. */
export const pick = (entity, daFederacao, doClube) => (isClubManagement(entity) ? doClube : daFederacao);

/** Os bens da entidade: as duas consultas existem, só a do escopo roda. */
export function useScopedAssets(entity) {
  const club = isClubManagement(entity);
  const daFederacao = useAssets(entity.id, { enabled: !club });
  const doClube = useClubAssets(entity.id, { enabled: club });
  return club ? doClube : daFederacao;
}

/** `mutate({ action, ...payload })` na entidade; o clube soma a invalidação da árvore da associação. */
export function useScopedManagementAction(entity) {
  const qc = useQueryClient();
  const daFederacao = useManagementAction(entity.id);
  const doClube = useFederationMutation(async ({ action, ...payload }) => {
    try {
      return await clubManagementAction({ clubId: entity.id, action, ...payload });
    } finally {
      qc.invalidateQueries({ queryKey: assocKeys.all(entity.id) });
    }
  });
  return isClubManagement(entity) ? doClube : daFederacao;
}
