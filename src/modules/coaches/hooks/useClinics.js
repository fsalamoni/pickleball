/**
 * Hooks de clínicas/workshops do professor — flag coach_clinics.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  listCoachClinics, listClinicSignups, listMyClinicSignups,
  createClinic, updateClinic, cancelClinic, deleteClinic,
  enrollInClinic, cancelEnrollment,
} from '../services/clinicService';

export function useCoachClinics(coachId) {
  return useQuery({
    queryKey: ['coach-clinics', 'coach', coachId],
    queryFn: () => listCoachClinics(coachId),
    enabled: !!coachId,
  });
}

export function useClinicSignups(clinicId) {
  return useQuery({
    queryKey: ['coach-clinics', 'signups', clinicId],
    queryFn: () => listClinicSignups(clinicId),
    enabled: !!clinicId,
  });
}

export function useMyClinicSignups(athleteId) {
  return useQuery({
    queryKey: ['coach-clinics', 'mine', athleteId],
    queryFn: () => listMyClinicSignups(athleteId),
    enabled: !!athleteId,
  });
}

function invalidateCoach(qc, coachId) {
  qc.invalidateQueries({ queryKey: ['coach-clinics', 'coach', coachId] });
}

export function useCreateClinic() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => createClinic(input, user),
    onSuccess: (_, vars) => invalidateCoach(qc, vars?.coach_id),
  });
}

export function useUpdateClinic() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clinicId, input }) => updateClinic(clinicId, input, user),
    onSuccess: (_, vars) => invalidateCoach(qc, vars?.input?.coach_id ?? user?.uid),
  });
}

export function useCancelClinic() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clinicId }) => cancelClinic(clinicId, user),
    onSuccess: () => invalidateCoach(qc, user?.uid),
  });
}

export function useDeleteClinic() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clinicId }) => deleteClinic(clinicId, user),
    onSuccess: () => invalidateCoach(qc, user?.uid),
  });
}

export function useEnrollInClinic() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clinic) => enrollInClinic(clinic, user),
    onSuccess: (_, clinic) => {
      qc.invalidateQueries({ queryKey: ['coach-clinics', 'signups', clinic?.id] });
      qc.invalidateQueries({ queryKey: ['coach-clinics', 'mine', user?.uid] });
    },
  });
}

export function useCancelEnrollment() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clinic, athleteId }) => cancelEnrollment(clinic, athleteId, user),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['coach-clinics', 'signups', vars?.clinic?.id] });
      qc.invalidateQueries({ queryKey: ['coach-clinics', 'mine', user?.uid] });
    },
  });
}
