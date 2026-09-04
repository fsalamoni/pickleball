/**
 * useHallOfFame — hook que lê o Hall da Fama público.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchHallOfFame, HALL_OF_FAME_LIMIT } from '@/modules/progression/services/hallOfFameService';

export function useHallOfFame({ limit: lim = HALL_OF_FAME_LIMIT, enabled = true } = {}) {
  return useQuery({
    queryKey: ['hall-of-fame', lim],
    queryFn: async () => fetchHallOfFame({ limit: lim }),
    enabled,
    staleTime: 5 * 60_000, // 5 min — é dado público, mas custa query
  });
}
