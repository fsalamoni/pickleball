/**
 * V2StudentLessons — "Minhas aulas" do aluno: aulas solicitadas/agendadas
 * com professores. Gated pela flag coach_lessons.
 *
 * Rota: /minhas-aulas
 * Aditivo.
 */

import React, { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarDays, GraduationCap } from 'lucide-react';
import { FEATURE_FLAG } from '@/core/featureFlags';
import FeatureFlagGuard from '@/v2/components/FeatureFlagGuard';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useStudentLessons, useRespondLesson } from '@/modules/coaches/hooks/useLessons';
import {
  partitionLessons, availableActions, lessonStatusLabel, lessonStatusTone,
  lessonFormatLabel, lessonSlots, LESSON_STATUS,
} from '@/modules/coaches/domain/lesson';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  V2Badge, V2EmptyState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY_SHORT[date.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

function StudentLessonCard({ lesson, onCancel, isPending }) {
  const slots = lessonSlots(lesson);
  const first = slots[0];
  const canCancel = availableActions(lesson, 'student').some((a) => a.to === LESSON_STATUS.CANCELLED);
  return (
    <div className="rounded-2xl border border-gray-100 bg-paper p-3">
      <div className="flex flex-wrap items-center gap-2">
        <V2Badge tone={lessonStatusTone(lesson.status)}>{lessonStatusLabel(lesson.status)}</V2Badge>
        <V2Badge tone="neutral">{lessonFormatLabel(lesson.format)}</V2Badge>
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
        <CalendarDays className="h-3.5 w-3.5" />
        {first ? `${fmtDate(first.date)} · ${first.start}–${first.end}` : 'Horário a combinar'}
        {slots.length > 1 && <span className="ml-1">+{slots.length - 1} data(s)</span>}
      </div>
      {lesson.location && <p className="mt-1 text-xs text-gray-500">📍 {lesson.location}</p>}
      {canCancel && (
        <div className="mt-3 flex justify-end">
          <ConfirmDialog
            title="Cancelar aula?"
            description="A aula será cancelada e o professor avisado."
            confirmLabel="Cancelar aula"
            onConfirm={() => onCancel(lesson)}
            trigger={(
              <button type="button" disabled={isPending} className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50">
                Cancelar
              </button>
            )}
          />
        </div>
      )}
    </div>
  );
}

function V2StudentLessonsContent() {
  const { user, isAuthenticated } = useAuth();
  const { data: lessons = [], isLoading } = useStudentLessons(user?.uid);
  const respond = useRespondLesson();

  const { upcoming, history } = useMemo(() => partitionLessons(lessons), [lessons]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const handleCancel = async (lesson) => {
    try {
      await respond.mutateAsync({ lesson, nextStatus: LESSON_STATUS.CANCELLED });
      toast.success('Aula cancelada.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível cancelar.');
    }
  };

  return (
    <div className="mx-auto max-w-[800px] space-y-6 p-4">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Minhas aulas</h1>
        <p className="mt-2 font-medium text-gray-500">Acompanhe suas aulas com professores.</p>
      </div>

      <V2Surface>
        <h2 className="mb-4 font-display text-lg font-bold text-ink">Próximas</h2>
        {isLoading ? (
          <V2Skeleton lines={3} />
        ) : upcoming.length === 0 ? (
          <V2EmptyState
            icon={GraduationCap}
            title="Nenhuma aula agendada"
            description="Encontre um professor no diretório e solicite sua primeira aula."
            action={<Link to="/coaches" className="text-sm font-bold text-ink underline">Ver professores →</Link>}
          />
        ) : (
          <div className="space-y-2">
            {upcoming.map((l) => <StudentLessonCard key={l.id} lesson={l} onCancel={handleCancel} isPending={respond.isPending} />)}
          </div>
        )}
      </V2Surface>

      {history.length > 0 && (
        <V2Surface>
          <h2 className="mb-4 font-display text-lg font-bold text-ink">Histórico</h2>
          <div className="space-y-2">
            {history.map((l) => <StudentLessonCard key={l.id} lesson={l} onCancel={handleCancel} isPending={respond.isPending} />)}
          </div>
        </V2Surface>
      )}
    </div>
  );
}

export default function V2StudentLessons() {
  return (
    <FeatureFlagGuard
      flag={FEATURE_FLAG.COACH_LESSONS}
      label="Aulas de professores"
      description="A área de aulas fica disponível quando a flag Aulas de professores está ligada."
    >
      <V2StudentLessonsContent />
    </FeatureFlagGuard>
  );
}
