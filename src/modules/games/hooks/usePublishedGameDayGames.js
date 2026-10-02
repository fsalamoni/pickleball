import { useQuery } from '@tanstack/react-query';
import { listPublishedGameDayGamesFor } from '../services/gameDayService.js';

/**
 * Os jogos de dia de jogo PUBLICADOS no ranking de um atleta — de qualquer
 * atleta: o espelho (`club_event_games`) é de leitura pública. São os mesmos
 * jogos que o ranking, o rating 2.0–8.0 e o ranking de duplas contam.
 *
 * O perfil público usa isto para não dizer "0 jogos" de quem joga em dia de
 * jogo; o confronto direto usa a MESMA chave (`fetchQuery`), então os dois
 * pedem uma vez só.
 *
 * @param {string} uid
 */
export function publishedGameDayGamesQuery(uid) {
  return {
    queryKey: ['game-days', 'published-games', uid],
    queryFn: () => listPublishedGameDayGamesFor(uid),
    staleTime: 60_000,
  };
}

export function usePublishedGameDayGames(uid, enabled = true) {
  return useQuery({ ...publishedGameDayGamesQuery(uid), enabled: !!uid && enabled });
}
