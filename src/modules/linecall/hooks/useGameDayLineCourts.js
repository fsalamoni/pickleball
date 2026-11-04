import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { listGameDayLineCourts, saveGameDayLineCourts } from '../services/gameDayLineService.js';

const key = (gameDayId) => ['game-day-line-courts', gameDayId];

/** As quadras configuradas do dia. `refetchInterval`: o telão relê para notar quadra ligada/desligada. */
export function useGameDayLineCourts(gameDayId, { enabled = true, refetchInterval } = {}) {
  return useQuery({
    queryKey: key(gameDayId),
    queryFn: () => listGameDayLineCourts(gameDayId),
    enabled: Boolean(enabled && gameDayId),
    refetchInterval,
  });
}

/**
 * `mutate([{ gameDayId, courtId, patch }, …])` ⇒ `{ ok, failed }`. Serve para
 * uma quadra, para todas as do dia e para copiar aos próximos dias.
 */
export function useSaveGameDayLineCourts() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items) => saveGameDayLineCourts(items, user?.uid),
    onSuccess: (_r, items) => {
      new Set(items.map((i) => i.gameDayId)).forEach((id) => qc.invalidateQueries({ queryKey: key(id) }));
    },
  });
}
