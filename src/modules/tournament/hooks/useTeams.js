/**
 * Hooks React Query do formato de EQUIPES (flag team_tournaments).
 * Camada fina sobre `services/teamService.js`. Só é usada nas telas de equipes.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  registerTeam, updateTeamRoster, listTeamRegistrations, recordConfrontation,
} from '../services/teamService.js';

/** Inscrições-equipe de uma modalidade. */
export function useTeamRegistrations(modalityId) {
  return useQuery({
    queryKey: ['team-registrations', modalityId],
    queryFn: () => listTeamRegistrations(modalityId),
    enabled: !!modalityId,
    staleTime: 15_000,
  });
}

/** Inscreve uma equipe. */
export function useRegisterTeam() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tournament, modality, input }) => registerTeam({ tournament, modality, input, actor: user }),
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ['team-registrations', vars?.modality?.id] });
      qc.invalidateQueries({ queryKey: ['registrations'] });
      qc.invalidateQueries({ queryKey: ['registrations-tournament'] });
    },
  });
}

/** Edita o elenco/nome de uma equipe. */
export function useUpdateTeamRoster() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ regId, input, modality }) => updateTeamRoster(regId, input, modality, user),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ['team-registrations', vars?.modality?.id] });
    },
  });
}

/** Grava a escalação/placares de um confronto de equipes e apura o resultado. */
export function useRecordConfrontation(modalityId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, ...rest }) => recordConfrontation(matchId, rest, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-matches', modalityId] });
      qc.invalidateQueries({ queryKey: ['matches', modalityId] });
    },
  });
}
