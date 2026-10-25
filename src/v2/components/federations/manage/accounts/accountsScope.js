/**
 * O ESCOPO das contas: a mesma tela serve a federação e o clube-associação.
 *
 * As abas (orçamento, lançamentos, prestação, extrato) recebem uma "entidade"
 * (`federation`): a federação como ela é, ou o clube no mesmo formato
 * (`clubAccountsEntity`, com `kind: 'club'`). Só mudam três coisas, todas aqui:
 * qual função do servidor é chamada, quais consultas a ação invalida e em que
 * pasta do Storage o anexo é enviado. Nada de regra de conta — essa é a MESMA
 * (`functions/federationAccountsPolicy.js`, com a cópia em `domain/accounts`).
 */
import { useQueryClient } from '@tanstack/react-query';
import { accountsAction } from '@/modules/federations/services/accountsService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { clubAccountsAction } from '@/modules/clubs/services/clubAccountsService';
import { assocKeys } from '@/modules/clubs/hooks/useClubAssociation';

export const isClubScope = (entity) => entity?.kind === 'club';

/** A pasta do Storage de onde o servidor aceita o anexo novo. */
export const accountsFolder = (entity) => (isClubScope(entity) ? 'clube-contas' : 'federacao-contas');

/** O clube no formato que as abas das contas leem (nome, sigla para o nome do arquivo, sem módulos de agenda/acervo). */
export function clubAccountsEntity(club) {
  const slug = String(club?.name || club?.id || 'clube').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return { id: club?.id, kind: 'club', name: club?.name || '', acronym: slug || club?.id, modules: { accounts: true } };
}

/** Chama a função do servidor do escopo. */
export function callAccounts(entity, payload) {
  return isClubScope(entity)
    ? clubAccountsAction({ clubId: entity.id, ...payload })
    : accountsAction({ federationId: entity.id, ...payload });
}

/**
 * Mutação das contas. A federação segue com `useFederationMutation` (invalida a
 * árvore da federação); o clube soma a invalidação da árvore da associação.
 */
export function useAccountsMutation(entity, fn) {
  const qc = useQueryClient();
  return useFederationMutation(async (payload) => {
    try {
      return await fn(payload);
    } finally {
      if (isClubScope(entity)) qc.invalidateQueries({ queryKey: assocKeys.all(entity.id) });
    }
  });
}
