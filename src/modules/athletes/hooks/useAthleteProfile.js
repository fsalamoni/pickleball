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
      const [athlete, rating, history] = await Promise.all([
        getAthlete(uid).catch(() => null),
        getPlayerRating(uid).catch(() => null),
        getMyTournamentHistory(uid).catch(() => []),
      ]);
      return { athlete, rating, history, stats: buildPlayerStats(history) };
    },
  });
}
