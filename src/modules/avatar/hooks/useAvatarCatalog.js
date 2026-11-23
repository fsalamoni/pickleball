import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAvatarCatalog, saveAvatarCatalog } from '../services/avatarService.js';
import { liveBrandPaddles } from '../domain/brandItems.js';

export const avatarKeys = Object.freeze({ catalog: ['avatar', 'catalog'] });

/** O catálogo inteiro (admin) — `isError` separado de "vazio". */
export function useAvatarCatalog({ enabled = true } = {}) {
  return useQuery({ queryKey: avatarKeys.catalog, queryFn: getAvatarCatalog, staleTime: 5 * 60 * 1000, enabled });
}

/**
 * As raquetes de marca NO AR. Se a leitura falhar, o criador segue com a
 * raquete de cor (marca é extra, não pode travar o avatar) e diz que não
 * carregou.
 */
export function useLiveBrandPaddles({ enabled = true } = {}) {
  const q = useAvatarCatalog({ enabled });
  const live = useMemo(() => liveBrandPaddles(q.data?.brand_paddles || []), [q.data]);
  return { items: live, isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export function useSaveAvatarCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ list, actor }) => saveAvatarCatalog(list, actor),
    onSuccess: () => qc.invalidateQueries({ queryKey: avatarKeys.catalog }),
  });
}
