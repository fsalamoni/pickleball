import { useQuery } from '@tanstack/react-query';
import { listAllPlatformUsers } from '../services/adminService';

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
