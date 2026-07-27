/**
 * V2CoachAvailabilityCalendar — Calendário público de disponibilidade
 * do professor (item 3.1).
 *
 * Mostra, para os próximos 14 dias, os slots livres derivados da
 * disponibilidade semanal do professor (descontando aulas já marcadas).
 * Reusa o domínio `generateWeekSlots` (puro, testado) e os hooks
 * `useCoachAvailability` + `useCoachBusySlots` — sem dependência de
 * componentes de gestão.
 *
 * Clicar em um slot abre o `RequestLessonDialog` (se o user estiver
 * autenticado e não for o próprio professor). É a porta de entrada
 * pública para "marcar aula", análoga ao calendar de arenas.
 *
 * Wave B.4.
 */

import React, { useMemo, useState } from 'react';
import { CalendarDays, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useCoachAvailability, useCoachBusySlots } from '@/modules/coaches/hooks/useLessons';
import { generateWeekSlots } from '@/modules/coaches/domain/availability';
import {
  V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY_SHORT[date.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

export default function V2CoachAvailabilityCalendar({ coach, onRequestLesson }) {
  const coachId = coach?.id;
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const lessonsOn = useFeatureFlag(FEATURE_FLAG.COACH_LESSONS);

  const { data: availability, isLoading: loadingAvailability } = useCoachAvailability(coachId);
  const { data: busy = [], isLoading: loadingBusy } = useCoachBusySlots(coachId);

  const [expanded, setExpanded] = useState(false);

  const freeDays = useMemo(() => {
    if (!availability) return [];
    return generateWeekSlots(availability, todayISO(), { days: 14, busy });
  }, [availability, busy]);

  const isOwn = user?.uid === coachId;

  if (!lessonsOn) return null;
  if (loadingAvailability || loadingBusy) {
    return <V2Skeleton className="h-32" />;
  }

  if (freeDays.length === 0) {
    return (
      <V2Surface>
        <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
          <CalendarDays className="h-4 w-4" /> Disponibilidade
        </h3>
        <div className="mt-3">
          <V2EmptyState
            icon={Clock}
            title="Horários em breve"
            description="Este professor ainda não publicou uma agenda. Você pode propor um horário mesmo assim."
            compact
          />
        </div>
      </V2Surface>
    );
  }

  const visibleDays = expanded ? freeDays : freeDays.slice(0, 5);
  const hasMore = freeDays.length > 5;

  function handleSlotClick(slot) {
    if (isOwn) {
      toast.info('Você não pode marcar aula com você mesmo.');
      return;
    }
    if (!isAuthenticated) {
      toast.info('Entre na plataforma para marcar uma aula.');
      navigate('/login');
      return;
    }
    if (typeof onRequestLesson === 'function') {
      onRequestLesson(slot);
    }
  }

  return (
    <V2Surface>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
          <CalendarDays className="h-4 w-4" /> Disponibilidade
        </h3>
        <span className="text-xs text-gray-400">próximos 14 dias</span>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Selecione um horário livre e o professor confirma a aula.
      </p>

      <div className="mt-3 space-y-3">
        {visibleDays.map((day) => (
          <div key={day.date} className="rounded-2xl border border-gray-100 bg-paper p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                {fmtDay(day.date)}
              </span>
              <V2Badge tone="green">{day.slots.length} livre(s)</V2Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {day.slots.map((s) => (
                <button
                  key={`${s.date}_${s.start}`}
                  type="button"
                  onClick={() => handleSlotClick(s)}
                  disabled={isOwn}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 transition-colors hover:border-green-300 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {s.start}–{s.end}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="mt-3 flex justify-center">
          <V2Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)}>
            {expanded ? 'Mostrar menos' : `Mostrar todos (${freeDays.length} dias)`}
          </V2Button>
        </div>
      )}

      {!isOwn && isAuthenticated && (
        <div className="mt-4">
          <V2Button onClick={() => onRequestLesson && onRequestLesson(null)} variant="secondary" className="w-full">
            Propor outro horário
          </V2Button>
        </div>
      )}
    </V2Surface>
  );
}
