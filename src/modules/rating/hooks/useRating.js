import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
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
  const lifecycleOn = useFeatureFlag(FEATURE_FLAG.TOURNAMENT_LIFECYCLE);
  const qc = useQueryClient();
  return useMutation({
    // Ranking oficial (flag do ciclo de vida): considera apenas torneios
    // públicos e encerrados. Desligado, mantém o cálculo anterior.
    mutationFn: () => recomputeAllRatings(user, { onlyPublicClosed: lifecycleOn }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['national-ranking'] });
    },
  });
}
