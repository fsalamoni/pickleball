/**
 * V2ArenaCalendar — visualização mensal de reservas de uma arena.
 *
 * Sprint 1 (ARE-02) do roadmap arena. Tab read-only no V2ArenaManage.
 *
 * Features:
 * - Grid 6x7 (mês completo com overflow)
 * - Navegação mês anterior/próximo + "Hoje"
 * - Filtro por quadra (se arena tem múltiplas)
 * - Cada célula mostra até 2 chips de reserva + "+N mais"
 * - Click na célula abre modal com lista completa do dia
 * - Cores por status: REQUESTED (âmbar), CONFIRMED (verde), etc
 *
 * Decisões:
 * - Read-only: ações (confirmar/recusar) ficam no V2BookingsTab.
 *   Calendário é VISÃO, não edição.
 * - Filtragem no client (não query Firestore por mês) porque
 *   `useArenaBookings` já é cacheado e arenas típicas têm < 100
 *   reservas. Pra arenas grandes, adicionar query range no service.
 */

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  buildMonthGrid, getMonthLabel, getWeekdayHeaders, groupBookingsByDate,
  todayISO, monthRangeISO,
} from '@/modules/arenas/domain/calendar';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import { useArenaCourts } from '@/modules/arenas/hooks/useArenas';
import { V2Badge, V2Button, V2Surface } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

// Tons alinhados aos suportados pelo V2Badge (neutral/acid/ink/green/blue/amber/red).
const STATUS_TONE = {
  requested: 'amber',
  negotiating: 'blue',
  confirmed: 'green',
  declined: 'red',
  cancelled: 'neutral',
  completed: 'blue',
  no_show: 'red',
};

const STATUS_LABEL = {
  requested: 'Solicitada',
  negotiating: 'Em negociação',
  confirmed: 'Confirmada',
  declined: 'Recusada',
  cancelled: 'Cancelada',
  completed: 'Concluída',
  no_show: 'Não compareceu',
};

function statusBadgeTone(status) {
  const tone = STATUS_TONE[status] || 'neutral';
  return tone === 'gray' ? 'neutral' : tone;
}

function nowYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default function V2ArenaCalendar({ arena }) {
  const initial = useMemo(nowYearMonth, []);
  const [cursor, setCursor] = useState(initial);
  const [courtFilter, setCourtFilter] = useState('');
  const [dayModal, setDayModal] = useState(null);

  const { data: bookings = [], isLoading } = useArenaBookings(arena.id);
  const { data: courts = [] } = useArenaCourts(arena.id);

  const byDate = useMemo(() => {
    return groupBookingsByDate(bookings, { courtId: courtFilter || undefined });
  }, [bookings, courtFilter]);

  const grid = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month, todayISO()),
    [cursor.year, cursor.month],
  );

  const stats = useMemo(() => {
    const monthBookings = Object.entries(byDate).filter(
      ([date]) => date.startsWith(`${cursor.year}-${String(cursor.month).padStart(2, '0')}`),
    );
    let total = 0, confirmed = 0, requested = 0;
    for (const [, slots] of monthBookings) {
      for (const s of slots) {
        total += 1;
        if (s.booking_status === 'confirmed') confirmed += 1;
        else if (s.booking_status === 'requested') requested += 1;
      }
    }
    return { total, confirmed, requested, daysWithBookings: monthBookings.length };
  }, [byDate, cursor]);

  function prevMonth() {
    const m = cursor.month - 1;
    if (m < 1) setCursor({ year: cursor.year - 1, month: 12 });
    else setCursor({ year: cursor.year, month: m });
  }
  function nextMonth() {
    const m = cursor.month + 1;
    if (m > 12) setCursor({ year: cursor.year + 1, month: 1 });
    else setCursor({ year: cursor.year, month: m });
  }
  function goToday() { setCursor(nowYearMonth()); }

  const dayBookings = dayModal ? (byDate[dayModal] || []) : [];
  const rangeInfo = useMemo(() => monthRangeISO(cursor.year, cursor.month), [cursor]);

  return (
    <V2Surface className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <V2Button variant="ghost" size="sm" onClick={prevMonth} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </V2Button>
          <h3 className="font-display text-lg font-bold text-ink min-w-[160px] text-center">
            {getMonthLabel(cursor.year, cursor.month)}
          </h3>
          <V2Button variant="ghost" size="sm" onClick={nextMonth} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </V2Button>
          <V2Button variant="ghost" size="sm" onClick={goToday}>Hoje</V2Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <V2Badge tone="blue">{stats.total} reservas</V2Badge>
          <V2Badge tone="green">{stats.confirmed} confirmadas</V2Badge>
          <V2Badge tone="amber">{stats.requested} pendentes</V2Badge>
          {courts.length > 0 && (
            <select
              value={courtFilter}
              onChange={(e) => setCourtFilter(e.target.value)}
              className="h-8 rounded-full border border-gray-200 bg-white px-2 text-xs"
            >
              <option value="">Todas as quadras</option>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Carregando reservas…</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {getWeekdayHeaders().map((d) => (
                <div key={d} className="rounded bg-gray-50 py-1.5">{d}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {grid.flat().map((cell) => {
                const slots = byDate[cell.date] || [];
                const visible = slots.slice(0, 2);
                const extra = slots.length - visible.length;
                return (
                  <button
                    key={cell.date}
                    type="button"
                    onClick={() => slots.length > 0 && setDayModal(cell.date)}
                    className={cn(
                      'min-h-[80px] rounded-2xl border p-1.5 text-left transition-colors',
                      cell.inMonth ? 'border-gray-100 bg-white' : 'border-transparent bg-gray-50/50',
                      cell.isToday && 'ring-2 ring-acid',
                      slots.length > 0 && 'hover:border-ink hover:bg-gray-50',
                    )}
                    disabled={slots.length === 0}
                  >
                    <div className={cn(
                      'text-[10px] font-bold',
                      cell.inMonth ? 'text-ink' : 'text-gray-400',
                      cell.isToday && 'text-acid',
                    )}>
                      {cell.day}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {visible.map((s, i) => (
                        <div
                          key={`${s.booking_id}_${s.start}_${i}`}
                          className={cn(
                            'truncate rounded px-1 py-0.5 text-[9px] font-semibold',
                            s.booking_status === 'confirmed' && 'bg-green-100 text-green-800',
                            s.booking_status === 'requested' && 'bg-amber-100 text-amber-800',
                            s.booking_status === 'negotiating' && 'bg-sky-100 text-sky-800',
                            (s.booking_status === 'cancelled' || s.booking_status === 'declined') && 'bg-gray-100 text-gray-500 line-through',
                            s.booking_status === 'completed' && 'bg-sky-100 text-sky-700',
                          )}
                          title={`${s.start}–${s.end} · ${s.athlete_name || 'Atleta'} (${STATUS_LABEL[s.booking_status] || s.booking_status})`}
                        >
                          {s.start}
                        </div>
                      ))}
                      {extra > 0 && (
                        <div className="text-[9px] font-semibold text-gray-500">+{extra}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="text-[10px] text-gray-400">
        Período carregado: {rangeInfo.start} → {rangeInfo.end} ({rangeInfo.dates.length} dias)
      </div>

      {dayModal && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          onClick={() => setDayModal(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl bg-paper-pure p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-display text-base font-bold text-ink">
                Reservas em {dayModal}
              </h4>
              <button
                type="button"
                onClick={() => setDayModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {dayBookings.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma reserva nesta data.</p>
            ) : (
              <ul className="space-y-2">
                {dayBookings.map((s, i) => {
                  const court = courts.find((c) => c.id === s.court_id);
                  return (
                    <li key={`${s.booking_id}_${s.start}_${i}`} className="rounded-2xl border border-gray-100 bg-paper p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-ink">{s.start}–{s.end}</div>
                          <div className="text-xs text-gray-500">
                            {s.athlete_name || 'Atleta'}
                            {court && <span> · {court.name}</span>}
                          </div>
                        </div>
                        <V2Badge tone={statusBadgeTone(s.booking_status)}>
                          {STATUS_LABEL[s.booking_status] || s.booking_status}
                        </V2Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </V2Surface>
  );
}
