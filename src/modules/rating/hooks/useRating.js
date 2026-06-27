import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { listNationalRanking, recomputeAllRatings, getRatingHistory } from '../services/ratingService.js';

/** Ranking nacional materializado (rating ELO). */
export function useNationalRanking() {
  return useQuery({
    queryKey: ['national-ranking'],
    queryFn: listNationalRanking,
    staleTime: 60_000,
  });
}

/** Histórico de rating de um atleta (pontos {at, rating}). */
export function useRatingHistory(uid, enabled = true) {
  return useQuery({
    queryKey: ['rating-history', uid],
    queryFn: () => getRatingHistory(uid),
    enabled: !!uid && enabled,
    staleTime: 60_000,
  });
}

/** Mutação do admin: recalcula todos os ratings e invalida o ranking. */
export function useRecomputeRatings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => recomputeAllRatings(user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['national-ranking'] });
    },
  });
}
