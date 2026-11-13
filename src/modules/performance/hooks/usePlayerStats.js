import { useMemo } from 'react';
import { useMyTournamentHistory } from '@/modules/tournament/hooks/useTournament';
import { useMyGameDayGames } from '@/modules/games/hooks/useGameDays';
import { useMyLeagueGames } from '@/modules/leagues/hooks/useLeagues';
import { foldGameDayGamesIntoStats } from '@/modules/games/domain/myGames';
import { buildPlayerStats } from '../domain/playerStats.js';
import { rankingCoverageSummary } from '../domain/rankingCoverage.js';

/**
 * Desempenho pessoal consolidado do usuário autenticado.
 *
 * Reaproveita o histórico de participações (`useMyTournamentHistory`) e funde
 * TODOS os jogos de dia de jogo em que o atleta participou (`useMyGameDayGames`)
 * — sempre, independente de publicação no ranking — e os jogos de LIGA
 * (`useMyLeagueGames`, no mesmo formato). Assim "Meu desempenho" reflete
 * literalmente todos os jogos do atleta.
 *
 * `coverage` diz quantos desses jogos NÃO estão no ranking e por quê
 * (`domain/rankingCoverage.js`). `isError` cobre as TRÊS fontes: com uma delas
 * faltando, o total seria parcial apresentado como total.
 *
 * @returns {{ stats, history, gameDayGames, leagueGames, coverage, isLoading, isError, refetch }}
 */
export function usePlayerStats() {
  const {
    data: history = [], isLoading, isError: falhouTorneios, refetch: recarregarTorneios,
  } = useMyTournamentHistory();
  const {
    data: gameDayGames = [], isLoading: loadingGd, isError: falhouDias, refetch: recarregarDias,
  } = useMyGameDayGames();
  const {
    data: leagueGames = [], isLoading: loadingLigas, isError: falhouLigas, refetch: recarregarLigas,
  } = useMyLeagueGames();
  const stats = useMemo(
    () => foldGameDayGamesIntoStats(buildPlayerStats(history), [...gameDayGames, ...leagueGames]),
    [history, gameDayGames, leagueGames],
  );
  const coverage = useMemo(
    () => rankingCoverageSummary({ history, gameDayGames, leagueGames }),
    [history, gameDayGames, leagueGames],
  );
  const refetch = () => {
    if (falhouTorneios) recarregarTorneios();
    if (falhouDias) recarregarDias();
    if (falhouLigas) recarregarLigas();
  };
  return {
    stats,
    history,
    gameDayGames,
    leagueGames,
    coverage,
    isLoading: isLoading || loadingGd || loadingLigas,
    isError: falhouTorneios || falhouDias || falhouLigas,
    refetch,
  };
}
