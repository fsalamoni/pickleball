/**
 * Hooks do produto de aulas do professor (Fase A) — atrás da flag
 * `coach_lessons`. React Query sobre o lessonService.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  getAvailability, saveAvailability,
  getLesson, listCoachLessons, listStudentLessons, getBusySlots,
  requestLesson, respondLesson,
} from '../services/lessonService';

/* --------------------------- Disponibilidade --------------------------- */

export function useCoachAvailability(coachId) {
  return useQuery({
    queryKey: ['coach-lessons', 'availability', coachId],
    queryFn: () => getAvailability(coachId),
    enabled: !!coachId,
  });
}

export function useSaveAvailability() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ coachId, input }) => saveAvailability(coachId, input, user),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['coach-lessons', 'availability', vars.coachId] });
    },
  });
}

/** Slots ocupados (aulas confirmadas) do professor — para calcular horários livres. */
export function useCoachBusySlots(coachId) {
  return useQuery({
    queryKey: ['coach-lessons', 'busy', coachId],
    queryFn: () => getBusySlots(coachId),
    enabled: !!coachId,
  });
}

/* -------------------------------- Aulas -------------------------------- */

export function useLesson(lessonId) {
  return useQuery({
    queryKey: ['coach-lessons', 'detail', lessonId],
    queryFn: () => getLesson(lessonId),
    enabled: !!lessonId,
  });
}

/** Agenda do professor (aulas que ele leciona). */
export function useCoachLessons(coachId) {
  return useQuery({
    queryKey: ['coach-lessons', 'coach', coachId],
    queryFn: () => listCoachLessons(coachId),
    enabled: !!coachId,
  });
}

/** "Minhas aulas" do aluno. */
export function useStudentLessons(studentId) {
  return useQuery({
    queryKey: ['coach-lessons', 'student', studentId],
    queryFn: () => listStudentLessons(studentId),
    enabled: !!studentId,
  });
}

function invalidateLesson(qc, { coachId, studentId } = {}) {
  qc.invalidateQueries({ queryKey: ['coach-lessons', 'coach', coachId] });
  qc.invalidateQueries({ queryKey: ['coach-lessons', 'busy', coachId] });
  if (studentId) qc.invalidateQueries({ queryKey: ['coach-lessons', 'student', studentId] });
}

export function useRequestLesson() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ coachId, input }) => requestLesson(coachId, user, input),
    onSuccess: (_, vars) => invalidateLesson(qc, { coachId: vars.coachId, studentId: user?.uid }),
  });
}

export function useRespondLesson() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lesson, nextStatus }) => respondLesson(lesson, nextStatus, user),
    onSuccess: (_, vars) => {
      invalidateLesson(qc, { coachId: vars.lesson?.coach_id, studentId: vars.lesson?.student_id });
      qc.invalidateQueries({ queryKey: ['coach-lessons', 'detail', vars.lesson?.id] });
    },
  });
}
