import { useMemo } from 'react';
import { useMyTournamentHistory } from '@/modules/tournament/hooks/useTournament';
import { useMyGameDayGames } from '@/modules/games/hooks/useGameDays';
import { foldGameDayGamesIntoStats } from '@/modules/games/domain/myGames';
import { buildPlayerStats } from '../domain/playerStats.js';
import { rankingCoverageSummary } from '../domain/rankingCoverage.js';

/**
 * Desempenho pessoal consolidado do usuário autenticado.
 *
 * Reaproveita o histórico de participações (`useMyTournamentHistory`) e funde
 * TODOS os jogos de dia de jogo em que o atleta participou (`useMyGameDayGames`)
 * — sempre, independente de publicação no ranking. Assim "Meu desempenho"
 * reflete literalmente todos os jogos do atleta.
 *
 * `coverage` diz quantos desses jogos NÃO estão no ranking e por quê
 * (`domain/rankingCoverage.js`). `isError` cobre as DUAS fontes: com uma delas
 * faltando, o total seria parcial apresentado como total.
 *
 * @returns {{ stats, history, gameDayGames, coverage, isLoading, isError, refetch }}
 */
export function usePlayerStats() {
  const {
    data: history = [], isLoading, isError: falhouTorneios, refetch: recarregarTorneios,
  } = useMyTournamentHistory();
  const {
    data: gameDayGames = [], isLoading: loadingGd, isError: falhouDias, refetch: recarregarDias,
  } = useMyGameDayGames();
  const stats = useMemo(
    () => foldGameDayGamesIntoStats(buildPlayerStats(history), gameDayGames),
    [history, gameDayGames],
  );
  const coverage = useMemo(
    () => rankingCoverageSummary({ history, gameDayGames }),
    [history, gameDayGames],
  );
  const refetch = () => {
    if (falhouTorneios) recarregarTorneios();
    if (falhouDias) recarregarDias();
  };
  return {
    stats,
    history,
    gameDayGames,
    coverage,
    isLoading: isLoading || loadingGd,
    isError: falhouTorneios || falhouDias,
    refetch,
  };
}
