/**
 * useHallOfFame — o Hall da Fama público (por UF, se pedido) e a linha da própria pessoa.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchHallOfFame, fetchMyHallRow, HALL_OF_FAME_LIMIT } from '@/modules/progression/services/hallOfFameService';

export function useHallOfFame({ limit: lim = HALL_OF_FAME_LIMIT, state = null, enabled = true } = {}) {
  return useQuery({
    queryKey: ['hall-of-fame', lim, state || 'BR'],
    queryFn: async () => fetchHallOfFame({ limit: lim, state }),
    enabled,
    staleTime: 5 * 60_000, // 5 min — é dado público, mas custa query
  });
}

/** Estou no Hall? (null = não apareço — por escolha, tier ou moderação) */
export function useMyHallRow(uid, enabled = true) {
  return useQuery({
    queryKey: ['hall-of-fame-me', uid],
    queryFn: () => fetchMyHallRow(uid),
    enabled: !!uid && enabled,
    staleTime: 5 * 60_000,
  });
}
