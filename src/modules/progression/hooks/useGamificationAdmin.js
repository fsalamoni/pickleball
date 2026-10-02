/** Hooks do painel do admin: sinais, moderação e métricas. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listFlags, listMetrics, listModerated, listReportedLettersForAdmin, resetAthleteProgress,
  reviewFlag, setModeration,
} from '@/modules/progression/services/gamificationAdminService';
import { deleteLetter } from '@/modules/progression/services/socialGamificationService';

const FLAGS_KEY = ['gamification-admin', 'flags'];
const MODERATED_KEY = ['gamification-admin', 'moderated'];

export function useAdminFlags(enabled = true) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: FLAGS_KEY, queryFn: () => listFlags(), enabled, staleTime: 30_000 });
  const review = useMutation({
    mutationFn: ({ id, status, note, actor }) => reviewFlag(id, status, note, actor),
    onSuccess: () => qc.invalidateQueries({ queryKey: FLAGS_KEY }),
  });
  return { flags: q.data || [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch, review };
}

export function useAdminModeration(enabled = true) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: MODERATED_KEY, queryFn: listModerated, enabled, staleTime: 30_000 });
  const set = useMutation({
    mutationFn: ({ uid, state, actor }) => setModeration(uid, state, actor),
    onSuccess: () => qc.invalidateQueries({ queryKey: MODERATED_KEY }),
  });
  const reset = useMutation({ mutationFn: ({ uid, actor, reason }) => resetAthleteProgress(uid, actor, reason) });
  return { moderated: q.data || [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch, set, reset };
}

export function useAdminMetrics(enabled = true) {
  const q = useQuery({ queryKey: ['gamification-admin', 'metrics'], queryFn: () => listMetrics(60), enabled, staleTime: 5 * 60_000 });
  return { metrics: q.data || [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export function useReportedLetters(enabled = true) {
  const qc = useQueryClient();
  const key = ['gamification-admin', 'reported-letters'];
  const q = useQuery({ queryKey: key, queryFn: listReportedLettersForAdmin, enabled, staleTime: 30_000 });
  const remove = useMutation({ mutationFn: (id) => deleteLetter(id), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
  return { letters: q.data || [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch, remove };
}
