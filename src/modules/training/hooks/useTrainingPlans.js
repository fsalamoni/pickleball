import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPlan, deletePlan, listMyPlans, setPlanStatus, updatePlan } from '../services/planService';
import { trainingKeys } from './trainingKeys';

export function useMyTrainingPlans(uid) {
  return useQuery({ queryKey: trainingKeys.plans(uid), queryFn: () => listMyPlans(uid), enabled: !!uid });
}

/** `plans` = a lista atual (para pausar o ativo anterior ao ativar outro). */
export function usePlanActions(identity, plans = []) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: trainingKeys.plans(identity.uid) });
  return {
    create: useMutation({ mutationFn: (input) => createPlan(input, { identity, plans }), onSuccess: inv }),
    update: useMutation({ mutationFn: ({ plan, input }) => updatePlan(plan, input), onSuccess: inv }),
    setStatus: useMutation({ mutationFn: ({ plan, status }) => setPlanStatus(plan, status, { plans }), onSuccess: inv }),
    remove: useMutation({ mutationFn: deletePlan, onSuccess: inv }),
  };
}
