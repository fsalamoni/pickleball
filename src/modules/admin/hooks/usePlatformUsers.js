import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listAllPlatformUsers, revokeAccountPowers, updateUserRecordAsAdmin,
} from '../services/adminService';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { previewAccountDeletion, deleteAccounts } from '../services/accountDeletionService';

/**
 * Lista todos os usuários da plataforma (coleção `users`). Só o admin da
 * plataforma tem permissão de leitura, então o consumidor deve manter
 * `enabled` como `false` para os demais — evitando chamadas que o Firestore
 * negaria.
 *
 * @param {{ enabled?: boolean }} [options]
 */
export function useAllPlatformUsers({ enabled = false } = {}) {
  return useQuery({
    queryKey: ['platform-users-all'],
    queryFn: listAllPlatformUsers,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Revoga o poder de uma conta. Só o dono da plataforma consegue — a regra do
 * Firestore recusa qualquer outro autor, então a interface deve esconder a
 * ação (ver `canRevokeAccount`) em vez de deixar o usuário bater na parede.
 */
export function useRevokeAccountPowers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, previousRole, reason }) => (
      revokeAccountPowers(uid, user, { previousRole, reason })
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-users-all'] }),
  });
}

/**
 * Corrige/complementa o cadastro de um usuário. Só admin — a regra do
 * Firestore recusa qualquer outro autor.
 */
export function useUpdateUserRecordAsAdmin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, patch, reason }) => updateUserRecordAsAdmin(uid, patch, user, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-users-all'] }),
  });
}

/**
 * Prévia da exclusão: o servidor diz o que aconteceria com cada conta, sem
 * gravar nada. É uma mutação (e não uma consulta) de propósito: é disparada
 * pelo admin, sobre uma seleção, e não deve ser refeita sozinha em segundo
 * plano — cada prévia varre dezenas de coleções.
 */
export function usePreviewAccountDeletion() {
  return useMutation({ mutationFn: ({ uids }) => previewAccountDeletion(uids) });
}

/**
 * Exclui cadastros. Invalida a lista de usuários E o diretório público: a
 * conta excluída não pode continuar aparecendo em nenhum dos dois.
 */
export function useDeleteAccounts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uids, reason, confirm }) => deleteAccounts(uids, { reason, confirm }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-users-all'] });
      queryClient.invalidateQueries({ queryKey: ['athletes'] });
    },
  });
}
