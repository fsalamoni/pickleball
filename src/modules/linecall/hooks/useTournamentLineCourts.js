import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { listTournamentLineCourts, saveTournamentLineCourts } from '../services/tournamentLineService.js';

const key = (tid) => ['tournament-line-courts', tid];

/** `refetchInterval`: o telão relê para notar quadra ligada/desligada. */
export function useTournamentLineCourts(tournamentId, { enabled = true, refetchInterval } = {}) {
  return useQuery({
    queryKey: key(tournamentId),
    queryFn: () => listTournamentLineCourts(tournamentId),
    enabled: Boolean(enabled && tournamentId),
    refetchInterval,
  });
}

/** `mutate([{ court, patch, exists }, …])` ⇒ `{ ok, failed }` (ver `saveEach`). */
export function useSaveTournamentLineCourts(tournamentId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items) => saveTournamentLineCourts({ tournamentId, uid: user?.uid, items }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(tournamentId) }),
  });
}
