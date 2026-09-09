import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAllPlatformUsers, revokeAccountPowers } from '../services/adminService';
import { useAuth } from '@/core/lib/FirebaseAuthContext';

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
