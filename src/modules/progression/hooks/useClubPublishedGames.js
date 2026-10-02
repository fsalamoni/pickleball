import { useQuery } from '@tanstack/react-query';
import { listClubPublishedGames } from '@/modules/progression/services/clubGamesService';

/** Os jogos publicados de um clube (para a atividade e as metas dele). */
export function useClubPublishedGames(clubId, enabled = true) {
  return useQuery({
    queryKey: ['club-published-games', clubId],
    queryFn: () => listClubPublishedGames(clubId),
    enabled: !!clubId && enabled,
    staleTime: 5 * 60_000,
  });
}
