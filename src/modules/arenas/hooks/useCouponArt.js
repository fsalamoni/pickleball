/**
 * Hooks dos modelos de arte de cupom da arena (Onda CD).
 *
 * Arquivo próprio (leve): o editor de cupom importa só isto.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { getArenaCouponTemplates, saveArenaCouponTemplates } from '../services/couponArtService.js';

export const couponArtKeys = Object.freeze({
  modelos: (arenaId) => ['arena-coupon-templates', arenaId],
});

/** Os modelos de cupom da arena. */
export function useArenaCouponTemplates(arenaId) {
  return useQuery({
    queryKey: couponArtKeys.modelos(arenaId),
    queryFn: () => getArenaCouponTemplates(arenaId),
    enabled: !!arenaId,
    staleTime: 5 * 60_000,
  });
}

/** Gravar a lista de modelos de cupom da arena. */
export function useSaveArenaCouponTemplates() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, list }) => saveArenaCouponTemplates(arenaId, list, user),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: couponArtKeys.modelos(arenaId) });
      qc.invalidateQueries({ queryKey: ['arena-settings', arenaId] });
    },
  });
}
