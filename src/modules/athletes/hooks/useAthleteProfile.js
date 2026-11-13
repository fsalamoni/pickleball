import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAthlete } from '../services/athleteService.js';
import { getPlayerRating } from '@/modules/rating/services/ratingService';
import { getMyTournamentHistory } from '@/modules/tournament/services/participationService';
import { buildPlayerStats } from '@/modules/performance/domain/playerStats';
import { foldGameDayGamesIntoStats } from '@/modules/games/domain/myGames';
import { publishedGameDayGamesQuery } from '@/modules/games/hooks/usePublishedGameDayGames';
import { leagueGamesQuery } from '@/modules/leagues/hooks/useLeagues';

/**
 * Agrega tudo que a página rica do atleta precisa: perfil público, rating
 * materializado, histórico de torneios, os jogos de dia de jogo PUBLICADOS, os
 * jogos de LIGA que o ranking conta e o resumo de desempenho derivado.
 *
 * 🐞 O resumo saía SÓ dos torneios. Quem joga em dia de jogo — a maior parte
 * dos jogos da plataforma — aparecia no ranking com dezenas de jogos e, no
 * próprio perfil, com "0 jogos, aproveitamento —". Agora os jogos de dia de
 * jogo publicados entram (são os mesmos que o ranking conta; os não publicados
 * só a própria pessoa vê, em "Meu desempenho"). O mesmo vale para a liga
 * (docs/57 §14): entram os jogos que o ranking conta (`ranked`).
 *
 * @param {string} uid
 */
export function useAthleteProfile(uid) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['athlete-profile', uid],
    enabled: !!uid,
    queryFn: async () => {
      const [athlete, rating, history, diasDeJogo, ligas] = await Promise.allSettled([
        getAthlete(uid),
        getPlayerRating(uid),
        getMyTournamentHistory(uid),
        qc.fetchQuery(publishedGameDayGamesQuery(uid)),
        qc.fetchQuery(leagueGamesQuery(uid)),
      ]);
      // ⚠️ Falha não é vazio (docs/27-FALHA-NAO-E-VAZIO.md). O perfil que não
      // carregou virava `null` e a página afirmava "Atleta não encontrado — o
      // perfil não existe" para quem existe: agora a consulta FALHA e a página
      // diz que falhou. O histórico que não carregou é marcado, para os
      // números não virarem "0 torneios, 0 jogos".
      if (athlete.status === 'rejected') throw athlete.reason;
      const historico = history.status === 'fulfilled' ? history.value || [] : [];
      const jogosDoDia = diasDeJogo.status === 'fulfilled' ? diasDeJogo.value || [] : [];
      const jogosDeLiga = (ligas.status === 'fulfilled' ? ligas.value || [] : []).filter((g) => g.ranked);
      return {
        athlete: athlete.value,
        rating: rating.status === 'fulfilled' ? rating.value : null,
        history: historico,
        gameDayGames: jogosDoDia,
        leagueGames: jogosDeLiga,
        stats: foldGameDayGamesIntoStats(buildPlayerStats(historico), [...jogosDoDia, ...jogosDeLiga]),
        // Qualquer uma das três fontes de jogos faltando torna os números
        // INCOMPLETOS — e número incompleto apresentado como total é mentira.
        historicoFalhou: history.status === 'rejected' || diasDeJogo.status === 'rejected' || ligas.status === 'rejected',
      };
    },
  });
}
