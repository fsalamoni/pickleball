/**
 * Hooks do nível validado por professor — flag coach_leveling.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  listCoachValidations, listAthleteValidations,
  upsertValidation, removeValidation,
} from '../services/validationService';

export function useCoachValidations(coachId) {
  return useQuery({
    queryKey: ['coach-validations', 'coach', coachId],
    queryFn: () => listCoachValidations(coachId),
    enabled: !!coachId,
  });
}

export function useAthleteValidations(studentId) {
  return useQuery({
    queryKey: ['coach-validations', 'athlete', studentId],
    queryFn: () => listAthleteValidations(studentId),
    enabled: !!studentId,
  });
}

function invalidate(qc, { coachId, studentId } = {}) {
  qc.invalidateQueries({ queryKey: ['coach-validations', 'coach', coachId] });
  if (studentId) qc.invalidateQueries({ queryKey: ['coach-validations', 'athlete', studentId] });
}

export function useUpsertValidation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => upsertValidation(input, user),
    onSuccess: (_, vars) => invalidate(qc, { coachId: vars?.coach_id, studentId: vars?.student_id }),
  });
}

export function useRemoveValidation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ coachId, studentId }) => removeValidation(coachId, studentId, user),
    onSuccess: (_, vars) => invalidate(qc, { coachId: vars?.coachId, studentId: vars?.studentId }),
  });
}
