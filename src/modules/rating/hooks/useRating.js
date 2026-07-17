import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  listNationalRanking,
  recomputeAllRatings,
  maybeAutoRecomputeRatings,
  getRatingHistory,
} from '../services/ratingService.js';

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

/** Recálculo automático (só roda quando as entradas mudaram). */
export function useMaybeAutoRecomputeRatings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (options) => maybeAutoRecomputeRatings(user, options || {}),
    onSuccess: (res) => {
      if (res?.ran) qc.invalidateQueries({ queryKey: ['national-ranking'] });
    },
  });
}

/**
 * Mantém o ranking atualizado automaticamente, sem ação manual: quando o admin
 * da plataforma usa o app (com as flags de ranking e ciclo de vida ligadas),
 * verifica se algum torneio elegível mudou desde o último recálculo e, se sim,
 * recalcula em segundo plano. O recálculo é silencioso e não bloqueia a UI.
 */
export function useAutoRecomputeRatings() {
  const { isPlatformAdmin } = useAuth();
  const ratingOn = useFeatureFlag(FEATURE_FLAG.PLAYER_RATING);
  const lifecycleOn = useFeatureFlag(FEATURE_FLAG.TOURNAMENT_LIFECYCLE);
  const auto = useMaybeAutoRecomputeRatings();
  const ranRef = useRef(false);

  useEffect(() => {
    if (!isPlatformAdmin || !ratingOn || !lifecycleOn) return;
    if (ranRef.current) return;
    ranRef.current = true;
    auto.mutate({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlatformAdmin, ratingOn, lifecycleOn]);
}
