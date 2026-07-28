/**
 * Hook admin para recalcular o ranking de TODOS os clubes
 * (Wave C.3) — usado para backfill inicial ou após correção.
 *
 * O fluxo normal é automático (Cloud Functions em
 * `functions/index.js`). Este hook é para o admin master, na
 * página de Métricas, disparar um `recomputeAllClubs` se precisar.
 */

import { useMutation } from '@tanstack/react-query';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/core/config/firebase';

export function useRecomputeAllClubRankings() {
  return useMutation({
    mutationFn: async () => {
      const fn = httpsCallable(functions, 'recomputeAllClubInternalRankings');
      const res = await fn({});
      return res.data;
    },
  });
}

/** Hook para recalcular 1 clube (admin). */
export function useRecomputeOneClubRanking() {
  return useMutation({
    mutationFn: async (clubId) => {
      const fn = httpsCallable(functions, 'recomputeOneClubInternalRanking');
      const res = await fn({ clubId });
      return res.data;
    },
  });
}
