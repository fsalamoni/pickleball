/**
 * Hooks da biblioteca de conteúdo do professor (Fase D) — flag coach_lessons.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  listCoachContent, listPublicCoachContent, createContent, updateContent, deleteContent,
} from '../services/contentService';

/**
 * Conteúdo do professor. Quando `full` é true (dono ou aluno vinculado), lê
 * tudo; caso contrário lê apenas o conteúdo público (seguro para visitantes,
 * evita a query ser rejeitada pelas regras).
 */
export function useCoachContent(coachId, { full = false } = {}) {
  return useQuery({
    queryKey: ['coach-content', coachId, full ? 'full' : 'public'],
    queryFn: () => (full ? listCoachContent(coachId) : listPublicCoachContent(coachId)),
    enabled: !!coachId,
  });
}

function invalidate(qc, coachId) {
  // Invalida ambas as variantes (full/public) do professor.
  qc.invalidateQueries({ queryKey: ['coach-content', coachId] });
}

export function useCreateContent() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ coachId, input }) => createContent(coachId, input, user),
    onSuccess: (_, vars) => invalidate(qc, vars.coachId),
  });
}

export function useUpdateContent() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ content, input }) => updateContent(content, input, user),
    onSuccess: (_, vars) => invalidate(qc, vars.content?.coach_id),
  });
}

export function useDeleteContent() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ content }) => deleteContent(content, user),
    onSuccess: (_, vars) => invalidate(qc, vars.content?.coach_id),
  });
}
