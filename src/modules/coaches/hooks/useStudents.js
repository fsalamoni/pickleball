/**
 * Hooks do roster de alunos do professor (Fase B) — flag coach_lessons.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  listCoachStudents, listStudentCoaches, getStudent,
  upsertStudent, setStudentStatus, removeStudent,
} from '../services/studentService';

export function useCoachStudents(coachId) {
  return useQuery({
    queryKey: ['coach-students', 'coach', coachId],
    queryFn: () => listCoachStudents(coachId),
    enabled: !!coachId,
  });
}

export function useStudentCoaches(studentId) {
  return useQuery({
    queryKey: ['coach-students', 'student', studentId],
    queryFn: () => listStudentCoaches(studentId),
    enabled: !!studentId,
  });
}

export function useStudent(coachId, studentId) {
  return useQuery({
    queryKey: ['coach-students', 'detail', coachId, studentId],
    queryFn: () => getStudent(coachId, studentId),
    enabled: !!coachId && !!studentId,
  });
}

function invalidate(qc, { coachId, studentId } = {}) {
  qc.invalidateQueries({ queryKey: ['coach-students', 'coach', coachId] });
  if (studentId) qc.invalidateQueries({ queryKey: ['coach-students', 'student', studentId] });
}

export function useUpsertStudent() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ coachId, input }) => upsertStudent(coachId, input, user),
    onSuccess: (_, vars) => invalidate(qc, { coachId: vars.coachId, studentId: vars.input?.student_id }),
  });
}

export function useSetStudentStatus() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ student, nextStatus }) => setStudentStatus(student, nextStatus, user),
    onSuccess: (_, vars) => invalidate(qc, { coachId: vars.student?.coach_id, studentId: vars.student?.student_id }),
  });
}

export function useRemoveStudent() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ student }) => removeStudent(student, user),
    onSuccess: (_, vars) => invalidate(qc, { coachId: vars.student?.coach_id, studentId: vars.student?.student_id }),
  });
}
