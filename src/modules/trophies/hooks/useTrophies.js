import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAllModalityMatches, useRegistrations } from '@/modules/tournament/hooks/useTournament';
import { modalityPodium } from '@/modules/tournament/domain/podium.js';
import { listMyTrophies } from '../services/trophyService.js';

export const trophiesKey = (uid) => ['trophies', uid];

/** A coleção de troféus de uma pessoa (a dela ou a de um perfil público). */
export function useTrophies(uid, { enabled = true } = {}) {
  return useQuery({
    queryKey: trophiesKey(uid),
    queryFn: () => listMyTrophies(uid),
    enabled: Boolean(uid) && enabled,
    staleTime: 5 * 60_000,
  });
}

/**
 * O pódio de uma categoria, com as mesmas consultas da aba de resultados
 * (cache compartilhado). `podium.complete` só com a categoria encerrada.
 */
export function useModalityPodium(tournament, modality) {
  const matches = useAllModalityMatches(modality?.id);
  const registrations = useRegistrations(modality?.id);
  const podium = useMemo(() => modalityPodium({
    modality, tournament, matches: matches.data || [], registrations: registrations.data || [],
  }), [modality, tournament, matches.data, registrations.data]);
  return {
    podium,
    isLoading: matches.isLoading || registrations.isLoading,
    isError: matches.isError || registrations.isError,
    refetch: () => { matches.refetch(); registrations.refetch(); },
  };
}
