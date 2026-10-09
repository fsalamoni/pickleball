import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTrainingSettings, saveTrainingSettings, setProfessorVerified } from '../services/settingsService';
import { normalizeTrainingSettings } from '../domain/settings';
import { trainingKeys } from './trainingKeys';

/**
 * Configuração do treino. Enquanto carrega (ou se falhar) as telas usam os
 * padrões — a regra usa os mesmos, então nada fica "aberto demais".
 */
export function useTrainingSettings() {
  const q = useQuery({ queryKey: trainingKeys.settings, queryFn: getTrainingSettings, staleTime: 5 * 60_000 });
  return { ...q, settings: q.data || normalizeTrainingSettings(null) };
}

export function useSaveTrainingSettings(identity) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, current }) => saveTrainingSettings(input, current, { identity }),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingKeys.settings }),
  });
}

/** `mutate({ uid, verified, name })` — só o admin. */
export function useSetProfessorVerified(identity) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, verified, name }) => setProfessorVerified(uid, verified, { identity, name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingKeys.settings }),
  });
}
