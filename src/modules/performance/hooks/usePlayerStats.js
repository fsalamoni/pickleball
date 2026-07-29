import { useMemo } from 'react';
import { useMyTournamentHistory } from '@/modules/tournament/hooks/useTournament';
import { useMyGameDayGames } from '@/modules/games/hooks/useGameDays';
import { foldGameDayGamesIntoStats } from '@/modules/games/domain/myGames';
import { buildPlayerStats } from '../domain/playerStats.js';

/**
 * Desempenho pessoal consolidado do usuário autenticado.
 *
 * Reaproveita o histórico de participações (`useMyTournamentHistory`) e funde
 * TODOS os jogos de dia de jogo em que o atleta participou (`useMyGameDayGames`)
 * — sempre, independente de publicação no ranking. Assim "Meu desempenho"
 * reflete literalmente todos os jogos do atleta.
 *
 * @returns {{ stats, history, gameDayGames, isLoading, isError, refetch }}
 */
export function usePlayerStats() {
  const { data: history = [], isLoading, isError, refetch } = useMyTournamentHistory();
  const { data: gameDayGames = [], isLoading: loadingGd } = useMyGameDayGames();
  const stats = useMemo(
    () => foldGameDayGamesIntoStats(buildPlayerStats(history), gameDayGames),
    [history, gameDayGames],
  );
  return { stats, history, gameDayGames, isLoading: isLoading || loadingGd, isError, refetch };
}
