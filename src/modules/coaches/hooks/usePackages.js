/**
 * Hooks de pacotes e vendas do professor (Fase C) — flag coach_lessons.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  listCoachPackages, createPackage, deletePackage,
  listCoachSales, listStudentSales, sellPackage, setSalePaid, consumeCredit,
} from '../services/packageService';

/* Pacotes */

export function useCoachPackages(coachId, opts = {}) {
  return useQuery({
    queryKey: ['coach-packages', 'list', coachId, opts],
    queryFn: () => listCoachPackages(coachId, opts),
    enabled: !!coachId,
  });
}

export function useCreatePackage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ coachId, input }) => createPackage(coachId, input, user),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['coach-packages', 'list', vars.coachId] }),
  });
}

export function useDeletePackage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pkg }) => deletePackage(pkg, user),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['coach-packages', 'list', vars.pkg?.coach_id] }),
  });
}

/* Vendas */

export function useCoachSales(coachId) {
  return useQuery({
    queryKey: ['coach-sales', 'coach', coachId],
    queryFn: () => listCoachSales(coachId),
    enabled: !!coachId,
  });
}

export function useStudentSales(studentId) {
  return useQuery({
    queryKey: ['coach-sales', 'student', studentId],
    queryFn: () => listStudentSales(studentId),
    enabled: !!studentId,
  });
}

function invalidateSales(qc, { coachId, studentId } = {}) {
  qc.invalidateQueries({ queryKey: ['coach-sales', 'coach', coachId] });
  if (studentId) qc.invalidateQueries({ queryKey: ['coach-sales', 'student', studentId] });
}

export function useSellPackage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ coachId, pkg, studentId, studentName, paid }) => sellPackage(coachId, { pkg, studentId, studentName, paid }, user),
    onSuccess: (_, vars) => invalidateSales(qc, { coachId: vars.coachId, studentId: vars.studentId }),
  });
}

export function useSetSalePaid() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sale, paid }) => setSalePaid(sale, paid, user),
    onSuccess: (_, vars) => invalidateSales(qc, { coachId: vars.sale?.coach_id, studentId: vars.sale?.student_id }),
  });
}

export function useConsumeCredit() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ saleId }) => consumeCredit(saleId, user),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['coach-sales', 'coach', vars.coachId] });
      if (vars.studentId) qc.invalidateQueries({ queryKey: ['coach-sales', 'student', vars.studentId] });
    },
  });
}
