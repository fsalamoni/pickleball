import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  addTournamentPhoto,
  listTournamentPhotos,
  deleteTournamentPhoto,
} from '../services/photoService.js';

/** Fotos da galeria de um torneio. */
export function useTournamentPhotos(tournamentId, enabled = true) {
  return useQuery({
    queryKey: ['tournament-photos', tournamentId],
    queryFn: () => listTournamentPhotos(tournamentId),
    enabled: !!tournamentId && enabled,
    staleTime: 60_000,
  });
}

export function useAddTournamentPhoto(tournamentId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url) => addTournamentPhoto(tournamentId, url, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tournament-photos', tournamentId] }),
  });
}

export function useDeleteTournamentPhoto(tournamentId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => deleteTournamentPhoto(id, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tournament-photos', tournamentId] }),
  });
}
