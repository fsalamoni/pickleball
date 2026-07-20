import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { V2Button, V2EmptyState, V2Surface } from '@/v2/ui/primitives';
import {
  AGENDA_TONE,
  buildWeekAgenda,
  formatWeekRange,
  shiftWeekStart,
  weekStartOf,
} from '@/modules/arenas/domain/availability';
import { cn } from '@/core/lib/utils';

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const HOUR_STEP = 2;

const TONE_CLASSES = {
  [AGENDA_TONE.CONFIRMED]: 'bg-ink text-white border-ink',
  [AGENDA_TONE.PENDING]: 'border-amber-300 bg-amber-100 text-amber-900',
};

function dayNumber(iso) {
  return iso.slice(8, 10);
}

function isToday(iso) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return iso === today;
}

/**
 * Agenda semanal da arena (flag arena_calendar): grade somente-leitura com
 * os horários ocupados (reservas confirmadas) e pendentes (solicitações em
 * análise), navegável por semana.
 */
export default function V2ArenaWeekAgenda({ bookings = [] }) {
  const [weekStart, setWeekStart] = useState(() => weekStartOf(new Date()));
  const agenda = useMemo(
    () => buildWeekAgenda({ weekStart, bookings }),
    [weekStart, bookings],
  );
  const windowSpan = agenda.windowEnd - agenda.windowStart;
  const gridHeight = (windowSpan / 60) * 36; // 36px por hora

  const hourMarks = useMemo(() => {
    const marks = [];
    for (let m = agenda.windowStart; m <= agenda.windowEnd; m += HOUR_STEP * 60) {
      marks.push(m);
    }
    return marks;
  }, [agenda.windowStart, agenda.windowEnd]);

  return (
    <V2Surface className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-gray-400" />
          <h3 className="font-display text-lg font-bold text-ink">Agenda da semana</h3>
          <span className="text-sm font-medium text-gray-500">{formatWeekRange(weekStart)}</span>
        </div>
        <div className="flex items-center gap-2">
          <V2Button variant="ghost" size="sm" aria-label="Semana anterior" onClick={() => setWeekStart((w) => shiftWeekStart(w, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </V2Button>
          <V2Button variant="subtle" size="sm" onClick={() => setWeekStart(weekStartOf(new Date()))}>Hoje</V2Button>
          <V2Button variant="ghost" size="sm" aria-label="Próxima semana" onClick={() => setWeekStart((w) => shiftWeekStart(w, 1))}>
            <ChevronRight className="h-4 w-4" />
          </V2Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-medium text-gray-500">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-ink" /> Confirmada</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-amber-300 bg-amber-100" /> Pendente</span>
      </div>

      {agenda.totalEntries === 0 ? (
        <V2EmptyState
          icon={CalendarDays}
          title="Semana livre"
          description="Nenhuma reserva confirmada ou pendente nesta semana."
          className="py-10"
        />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <div className="flex min-w-[760px]">
            {/* Eixo de horários */}
            <div className="relative w-12 shrink-0" style={{ height: gridHeight + 28 }}>
              {hourMarks.map((m) => (
                <span
                  key={m}
                  className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-gray-400"
                  style={{ top: 28 + ((m - agenda.windowStart) / windowSpan) * gridHeight }}
                >
                  {String(Math.floor(m / 60)).padStart(2, '0')}h
                </span>
              ))}
            </div>

            {agenda.days.map((day, index) => (
              <div key={day.date} className="min-w-0 flex-1 border-l border-gray-100">
                <div
                  className={cn(
                    'flex h-7 items-center justify-center gap-1 text-xs font-bold',
                    isToday(day.date) ? 'text-ink' : 'text-gray-500',
                  )}
                >
                  {DAY_LABELS[index]} {dayNumber(day.date)}
                  {isToday(day.date) && <span className="h-1.5 w-1.5 rounded-full bg-acid" />}
                </div>
                <div className="relative" style={{ height: gridHeight }}>
                  {hourMarks.map((m) => (
                    <div
                      key={m}
                      className="absolute inset-x-0 border-t border-dashed border-gray-100"
                      style={{ top: ((m - agenda.windowStart) / windowSpan) * gridHeight }}
                    />
                  ))}
                  {day.entries.map((entry, i) => {
                    const top = ((entry.startMinutes - agenda.windowStart) / windowSpan) * gridHeight;
                    const height = Math.max(18, ((entry.endMinutes - entry.startMinutes) / windowSpan) * gridHeight);
                    return (
                      <div
                        key={`${entry.bookingId || 'b'}-${i}`}
                        title={`${entry.label} · ${entry.start}–${entry.end}`}
                        className={cn(
                          'absolute inset-x-0.5 overflow-hidden rounded-lg border px-1.5 py-0.5 text-[10px] font-semibold leading-tight',
                          TONE_CLASSES[entry.tone],
                        )}
                        style={{ top, height }}
                      >
                        <div className="truncate">{entry.start} {entry.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </V2Surface>
  );
}
