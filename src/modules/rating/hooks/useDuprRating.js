/**
 * Hooks do ranking "estilo DUPR" (escala 2.000–8.000) — INDEPENDENTE do rating
 * ELO. Mantido em arquivo próprio para não tocar em `useRating.js`.
 */
import { useQuery } from '@tanstack/react-query';
import {
  getDuprRatingForUid,
  getDuprRatingHistory,
  listDuprRanking,
} from '../services/duprRatingService.js';

/** Rating "estilo DUPR" de um atleta específico (para perfis). */
export function useDuprRatingForUid(uid, enabled = true) {
  return useQuery({
    queryKey: ['dupr-rating', uid],
    queryFn: () => getDuprRatingForUid(uid),
    enabled: !!uid && enabled,
    staleTime: 60_000,
  });
}

/** Histórico de evolução do rating "estilo DUPR" de um atleta. */
export function useDuprRatingHistory(uid, enabled = true) {
  return useQuery({
    queryKey: ['dupr-rating-history', uid],
    queryFn: () => getDuprRatingHistory(uid),
    enabled: !!uid && enabled,
    staleTime: 60_000,
  });
}

/** Ranking "estilo DUPR" materializado (todos os atletas com jogos). */
export function useDuprRanking(enabled = true) {
  return useQuery({
    queryKey: ['dupr-ranking'],
    queryFn: listDuprRanking,
    enabled,
    staleTime: 60_000,
  });
}
