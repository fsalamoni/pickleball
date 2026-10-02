/** useGoals — as metas do mês de um professor, uma arena ou um clube. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getGoals, saveGoals } from '@/modules/progression/services/goalsService';

export function useGoals(ownerType, ownerId, monthKey, enabled = true) {
  const qc = useQueryClient();
  const key = ['gamification-goals', ownerType, ownerId, monthKey];
  const q = useQuery({ queryKey: key, queryFn: () => getGoals(ownerType, ownerId, monthKey), enabled: !!ownerType && !!ownerId && !!monthKey && enabled, staleTime: 60_000 });
  const save = useMutation({
    mutationFn: (goals) => saveGoals(ownerType, ownerId, monthKey, goals),
    onSuccess: (goals) => qc.setQueryData(key, goals),
  });
  return { goals: q.data || [], isLoading: q.isLoading, isError: q.isError, save };
}
