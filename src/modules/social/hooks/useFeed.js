import { useQuery } from '@tanstack/react-query';
import { listPublicTournaments } from '@/modules/tournament/services/tournamentService';
import { listOpenGames } from '@/modules/games/services/openGameService';
import { buildFeed } from '../domain/feed.js';

/** Feed da comunidade: torneios públicos + convites de jogo, normalizados. */
export function useFeed() {
  return useQuery({
    queryKey: ['community-feed'],
    staleTime: 30_000,
    queryFn: async () => {
      const [tournaments, openGames] = await Promise.all([
        listPublicTournaments().catch(() => []),
        listOpenGames().catch(() => []),
      ]);
      return buildFeed({ tournaments, openGames });
    },
  });
}
