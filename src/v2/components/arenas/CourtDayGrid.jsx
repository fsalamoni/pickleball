/**
 * CourtDayGrid — grade do dia por quadra: linhas = horários, colunas = quadras.
 * Cada célula mostra a disponibilidade da quadra naquele horário (livre,
 * pendente, reservado, concluído, indisponível, fechado) e a reserva quando há.
 * Clicar numa célula seleciona (quadra + horário) para as ações do calendário.
 *
 * Puro de UI: recebe dados por props (o componente pai já os carrega).
 */

import React, { useMemo } from 'react';
import { cn } from '@/core/lib/utils';
import { weekdayOf } from '@/modules/arenas/domain/booking';
import { getSlotStatus, SLOT_STATUS, SLOT_STATUS_COLORS, SLOT_STATUS_LABELS } from '@/modules/arenas/domain/slot_status';

function hourRange(schedules, date) {
  const weekday = weekdayOf(date);
  const active = (schedules || []).filter((s) => s.is_active !== false
    && Array.isArray(s.weekdays) && s.weekdays.includes(weekday));
  if (active.length === 0) return { min: 6, max: 22 };
  const starts = active.map((s) => parseInt(String(s.start_time).split(':')[0], 10)).filter(Number.isFinite);
  const ends = active.map((s) => parseInt(String(s.end_time).split(':')[0], 10)).filter(Number.isFinite);
  const min = starts.length ? Math.min(...starts) : 6;
  const max = ends.length ? Math.max(...ends) : 22;
  return { min: Math.max(0, min), max: Math.min(24, Math.max(min + 1, max)) };
}

export default function CourtDayGrid({
  courts = [], activeBookings = [], completedBookings = [], schedules = [], unavailabilities = [],
  date, onSelectCell, selected,
}) {
  const cols = useMemo(() => courts.filter((c) => c.is_active !== false), [courts]);
  const times = useMemo(() => {
    const { min, max } = hourRange(schedules, date);
    const out = [];
    for (let h = min; h < max; h += 1) out.push(`${String(h).padStart(2, '0')}:00`);
    return out;
  }, [schedules, date]);

  if (cols.length === 0) {
    return <p className="rounded-2xl border border-gray-100 bg-paper p-4 text-sm text-gray-500">Cadastre quadras (aba Estrutura → Quadras) para ver o calendário por quadra.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100">
      <table className="w-full border-collapse text-center text-xs">
        <thead>
          <tr className="bg-paper">
            <th className="sticky left-0 z-10 bg-paper px-2 py-2 text-left font-bold text-gray-500">Horário</th>
            {cols.map((c) => (
              <th key={c.id} className="min-w-[92px] px-2 py-2 font-bold text-ink">{c.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((time) => (
            <tr key={time} className="border-t border-gray-100">
              <td className="sticky left-0 z-10 bg-paper-pure px-2 py-1.5 text-left font-bold text-gray-600">{time}</td>
              {cols.map((court) => {
                const slot = getSlotStatus({
                  date, time, courtId: court.id,
                  schedules, bookings: activeBookings, unavailabilities, bookings_completed: completedBookings,
                });
                const color = SLOT_STATUS_COLORS[slot.status];
                const isSel = selected && selected.time === time && selected.courtId === court.id;
                const label = slot.booking?.athlete_name
                  ? slot.booking.athlete_name.split(' ')[0]
                  : SLOT_STATUS_LABELS[slot.status];
                return (
                  <td key={court.id} className="p-0.5">
                    <button
                      type="button"
                      onClick={() => onSelectCell?.(court, { time, ...slot })}
                      title={`${court.name} · ${time} · ${SLOT_STATUS_LABELS[slot.status]}${slot.booking?.athlete_name ? ` — ${slot.booking.athlete_name}` : ''}`}
                      className={cn(
                        'flex h-11 w-full flex-col items-center justify-center rounded-lg border transition-all',
                        color.bg, color.border, color.text,
                        'hover:scale-[1.04] hover:ring-2 hover:ring-ink/20',
                        isSel && 'ring-2 ring-ink',
                      )}
                    >
                      <span className="truncate px-1 text-[10px] font-semibold leading-tight">{label}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-3 border-t border-gray-100 bg-paper px-3 py-2 text-[11px]">
        {Object.entries(SLOT_STATUS_LABELS).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className={cn('h-2.5 w-2.5 rounded-full', SLOT_STATUS_COLORS[k].dot)} />
            <span className="text-gray-600">{v}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
