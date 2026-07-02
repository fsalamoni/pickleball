import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  addTournamentPhoto,
  listTournamentPhotos,
  listModalityPhotos,
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

/** Fotos de uma modalidade específica. */
export function useModalityPhotos(modalityId, enabled = true) {
  return useQuery({
    queryKey: ['modality-photos', modalityId],
    queryFn: () => listModalityPhotos(modalityId),
    enabled: !!modalityId && enabled,
    staleTime: 60_000,
  });
}

/** Envia uma foto vinculada a uma modalidade. */
export function useAddModalityPhoto(tournamentId, modalityId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url) => addTournamentPhoto(tournamentId, url, user, modalityId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modality-photos', modalityId] });
      qc.invalidateQueries({ queryKey: ['tournament-photos', tournamentId] });
    },
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

export function useDeleteTournamentPhoto(tournamentId, modalityId = null) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => deleteTournamentPhoto(id, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tournament-photos', tournamentId] });
      if (modalityId) {
        qc.invalidateQueries({ queryKey: ['modality-photos', modalityId] });
      }
    },
  });
}
