import { useQuery } from '@tanstack/react-query';
import {
  listNationalRanking,
  getRatingHistory,
  listFinishedEngineMatches,
  getRankingWorkerStatus,
  getPlayerRating,
} from '../services/ratingService.js';
import { computeDoublesRanking } from '../domain/doublesRanking.js';
import { listDoublesRanking, listMyDoublesRankings } from '../services/doublesRankingService.js';
import { useAuth } from '@/core/lib/FirebaseAuthContext';

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

/**
 * Quando o SERVIDOR recalculou os rankings pela última vez (e se falhou).
 * Para o painel do admin — é o que deixa visível um servidor parado.
 */
export function useRankingWorkerStatus(enabled = true) {
  return useQuery({
    queryKey: ['ranking-worker-status'],
    queryFn: getRankingWorkerStatus,
    enabled,
    staleTime: 60_000,
  });
}

/**
 * O MEU rating nacional (um documento, `player_ratings/{uid}`), com a posição
 * já gravada pelo servidor. Para a tela inicial, que só precisa de uma linha —
 * `useNationalRanking` lê a coleção inteira para desenhar a tabela.
 */
export function useMyPlayerRating({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['player-rating', user?.uid],
    queryFn: () => getPlayerRating(user?.uid),
    enabled: enabled && !!user?.uid,
    staleTime: 60_000,
  });
}

/** As MINHAS parcerias no ranking de duplas (melhor posição primeiro). */
export function useMyDoublesRankings({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['doubles-ranking', 'mine', user?.uid],
    queryFn: () => listMyDoublesRankings(user?.uid),
    enabled: enabled && !!user?.uid,
    staleTime: 60_000,
  });
}
