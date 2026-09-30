import { useQuery } from '@tanstack/react-query';
import { getAthlete } from '../services/athleteService.js';
import { getPlayerRating } from '@/modules/rating/services/ratingService';
import { getMyTournamentHistory } from '@/modules/tournament/services/participationService';
import { buildPlayerStats } from '@/modules/performance/domain/playerStats';

/**
 * Agrega tudo que a página rica do atleta precisa: perfil público, rating
 * materializado, histórico de torneios e o resumo de desempenho derivado.
 * Reaproveita serviços/domínios já existentes — sem I/O novo de baixo nível.
 *
 * @param {string} uid
 */
export function useAthleteProfile(uid) {
  return useQuery({
    queryKey: ['athlete-profile', uid],
    enabled: !!uid,
    queryFn: async () => {
      const [athlete, rating, history] = await Promise.allSettled([
        getAthlete(uid),
        getPlayerRating(uid),
        getMyTournamentHistory(uid),
      ]);
      // ⚠️ Falha não é vazio (docs/27-FALHA-NAO-E-VAZIO.md). O perfil que não
      // carregou virava `null` e a página afirmava "Atleta não encontrado — o
      // perfil não existe" para quem existe: agora a consulta FALHA e a página
      // diz que falhou. O histórico que não carregou é marcado, para os
      // números não virarem "0 torneios, 0 jogos".
      if (athlete.status === 'rejected') throw athlete.reason;
      const historico = history.status === 'fulfilled' ? history.value || [] : [];
      return {
        athlete: athlete.value,
        rating: rating.status === 'fulfilled' ? rating.value : null,
        history: historico,
        stats: buildPlayerStats(historico),
        historicoFalhou: history.status === 'rejected',
      };
    },
  });
}
