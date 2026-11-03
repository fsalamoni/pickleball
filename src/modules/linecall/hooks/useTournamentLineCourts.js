import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { listTournamentLineCourts, saveTournamentLineCourt } from '../services/tournamentLineService.js';

const key = (tid) => ['tournament-line-courts', tid];

export function useTournamentLineCourts(tournamentId, { enabled = true } = {}) {
  return useQuery({
    queryKey: key(tournamentId),
    queryFn: () => listTournamentLineCourts(tournamentId),
    enabled: Boolean(enabled && tournamentId),
  });
}

/** `mutate({ court, patch, exists })`. */
export function useSaveTournamentLineCourt(tournamentId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v) => saveTournamentLineCourt({ tournamentId, uid: user?.uid, ...v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(tournamentId) }),
  });
}
