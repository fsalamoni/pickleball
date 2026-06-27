import { useQuery } from '@tanstack/react-query';
import { getPlayerH2HRecords } from '../services/headToHeadService.js';
import { buildHeadToHead, topRivals } from '../domain/headToHead.js';

/**
 * Confrontos diretos de um atleta, já agregados. Só busca quando habilitado.
 * @param {string} uid
 * @param {boolean} [enabled]
 */
export function useHeadToHead(uid, enabled = true) {
  return useQuery({
    queryKey: ['head-to-head', uid],
    enabled: !!uid && enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const records = await getPlayerH2HRecords(uid);
      const h2h = buildHeadToHead(records);
      return { h2h, rivals: topRivals(h2h) };
    },
  });
}
