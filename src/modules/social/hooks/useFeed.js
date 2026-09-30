import { useQuery } from '@tanstack/react-query';
import { listPublicTournaments } from '@/modules/tournament/services/tournamentService';
import { listOpenGames } from '@/modules/games/services/openGameService';
import { feedDasFontes } from '../domain/feed.js';

/**
 * Feed da comunidade: torneios públicos + convites de jogo, normalizados.
 * Devolve `{ items, incompleto }` — uma fonte que falha não vira "nada".
 */
export function useFeed() {
  return useQuery({
    queryKey: ['community-feed'],
    staleTime: 30_000,
    queryFn: async () => {
      const [torneios, convites] = await Promise.allSettled([listPublicTournaments(), listOpenGames()]);
      return feedDasFontes(torneios, convites);
    },
  });
}
