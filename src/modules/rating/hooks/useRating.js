import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  listNationalRanking,
  recomputeAllRatings,
  maybeAutoRecomputeRatings,
  getRatingHistory,
  listFinishedEngineMatches,
} from '../services/ratingService.js';
import { computeDoublesRanking } from '../domain/doublesRanking.js';
import { listDoublesRanking } from '../services/doublesRankingService.js';

/** Ranking nacional materializado (rating ELO). */
export function useNationalRanking() {
  return useQuery({
    queryKey: ['national-ranking'],
    queryFn: listNationalRanking,
    staleTime: 60_000,
  });
}

/**
 * Ranking de duplas.
 *
 * Lê a coleção MATERIALIZADA (`doubles_rankings`), que o servidor reescreve a
 * cada resultado publicado: uma leitura pequena, já classificada, já com nome e
 * foto. Antes esta consulta lia quatro coleções inteiras e refazia a conta no
 * navegador a cada abertura da página.
 *
 * O cálculo antigo continua aqui como REDE: a coleção só nasce no primeiro
 * recálculo do servidor, e enquanto ela estiver vazia a página tem de mostrar
 * o ranking assim mesmo. É caro, mas é o caminho que ninguém percorre depois
 * do primeiro resultado publicado.
 *
 * `enabled` é controlado por quem chama.
 */
export function useDoublesRanking(enabled = true) {
  return useQuery({
    queryKey: ['doubles-ranking'],
    queryFn: async () => {
      const materializado = await listDoublesRanking();
      if (materializado.length > 0) {
        return materializado.map((row) => ({
          ...row,
          // A tela usa `players[].id`; o banco grava `uid` (o nome do campo em
          // todo o resto da plataforma). Normaliza aqui, num lugar só.
          players: (row.players || []).map((p) => ({
            id: p.uid || p.id,
            name: p.name || 'Atleta',
            photo: p.photo || '',
          })),
        }));
      }

      // Rede: ainda não houve recálculo no servidor.
      const { matches, nameById } = await listFinishedEngineMatches();
      const ranking = computeDoublesRanking(matches, { minGames: 1 });
      return ranking.map((row) => ({
        ...row,
        players: row.player_ids.map((id) => ({
          id,
          name: nameById.get(id)?.name || 'Atleta',
          photo: nameById.get(id)?.photo || '',
        })),
      }));
    },
    enabled,
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
    // Ranking oficial: considera apenas torneios públicos e encerrados.
    mutationFn: () => recomputeAllRatings(user, { onlyPublicClosed: true }),
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
 * da plataforma usa o app, verifica se algum torneio elegível mudou desde o
 * último recálculo e, se sim, recalcula em segundo plano. O recálculo é
 * silencioso e não bloqueia a UI.
 */
export function useAutoRecomputeRatings() {
  const { isPlatformAdmin } = useAuth();
  const auto = useMaybeAutoRecomputeRatings();
  const ranRef = useRef(false);

  useEffect(() => {
    if (!isPlatformAdmin) return;
    if (ranRef.current) return;
    ranRef.current = true;
    auto.mutate({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlatformAdmin]);
}
