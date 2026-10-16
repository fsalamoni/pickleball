/**
 * Hooks da lista de espera do professor (React Query sobre `waitlistService`).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  joinCoachWaitlist, leaveCoachWaitlist, listCoachWaitlist, listMyWaitlists,
} from '../services/waitlistService';

const KEY = ['coach-waitlist'];

/** As listas em que EU estou (aluno). */
export function useMyCoachWaitlists() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...KEY, 'mine', user?.uid],
    queryFn: () => listMyWaitlists(user.uid),
    enabled: !!user?.uid,
  });
}

/** A lista de espera do professor (painel dele). */
export function useCoachWaitlist(coachId) {
  return useQuery({
    queryKey: [...KEY, 'coach', coachId],
    queryFn: () => listCoachWaitlist(coachId),
    enabled: !!coachId,
  });
}

export function useJoinCoachWaitlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ coachId, input, existing }) => joinCoachWaitlist(coachId, user, input, { existing }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Sai da lista (`uid` omitido = eu) ou, para o professor, tira alguém dela. */
export function useLeaveCoachWaitlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ coachId, uid }) => leaveCoachWaitlist(coachId, uid || user?.uid),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
