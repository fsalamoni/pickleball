/**
 * Hooks do ranking "estilo DUPR" (escala 2.000–8.000) — INDEPENDENTE do rating
 * ELO. Mantido em arquivo próprio para não tocar em `useRating.js`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { listDuprRanking, recomputeDuprRatings } from '../services/duprRatingService.js';

/** Ranking "estilo DUPR" materializado (todos os atletas com jogos). */
export function useDuprRanking(enabled = true) {
  return useQuery({
    queryKey: ['dupr-ranking'],
    queryFn: listDuprRanking,
    enabled,
    staleTime: 60_000,
  });
}

/** Mutação do admin: recalcula o ranking "estilo DUPR" e invalida a lista. */
export function useRecomputeDuprRatings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => recomputeDuprRatings(user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dupr-ranking'] });
    },
  });
}
