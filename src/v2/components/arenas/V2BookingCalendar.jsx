/**
 * V2BookingCalendar — Calendário público MENSAL interativo (Sprint 5 + sw-v73.5).
 *
 * Mostra uma grade 7×6 do mês. Cada célula representa um dia e mostra:
 *  - Número do dia
 *  - Badge de status agregado (livre / ocupado / fechado)
 *
 * Comportamento:
 *  - Navegação ←/→ entre meses
 *  - Filtro por quadra (se houver mais de 1)
 *  - Legenda no topo
 *  - Clicar num dia ABRE o <V2DaySlotsDialog> com os slots horários daquele dia
 *  - Dentro do dialog, user pode selecionar 1+ slots e clicar "Solicitar reserva"
 *  - O BookingRequestDialog é aberto com `preselectedSlots` já preenchidos
 *    (data + horário + court_id se filtrou uma quadra)
 *
 * Status agregado por dia (1 cor por dia na grade):
 *  - "Fechado" cinza: arena sem schedule aberto naquele dia OU todos os
 *    slots são CLOSED. NÃO clicável.
 *  - "Disponível" emerald: tem pelo menos 1 slot AVAILABLE
 *  - "Ocupado" amber/vermelho: tem slots mas todos PENDING/CONFIRMED.
 *    Clicável para ver detalhe (sem seleção).
 *
 * Regras de negócio (PRD):
 *  - "Apenas aparece como fechado os dias/horários que forem descritos
 *    como fechados pelos admins da arena, ou os dias/horários que não
 *    forem definidos como abertos por eles."
 *  - getSlotStatus já implementa: retorna CLOSED se NÃO tem schedule
 *    aberto para aquele dia/horário, ou se admin marcou indisponibilidade.
 *  - closed = sem schedule aberto (admin não definiu horário)
 *  - unavailable = admin marcou indisponibilidade explícita
 *  - available = schedule aberto + sem booking
 *
 * Não depende de nenhum backend novo — só usa getSlotStatus() e os hooks
 * cacheados (useArenaCourts, useArenaCourtSchedules, useArenaBookings,
 * useArenaUnavailabilities).
 */

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { cn } from '@/core/lib/utils';
import {
  useArena,
  useArenaCourts,
  useArenaCourtSchedules,
  useArenaUnavailabilities,
} from '@/modules/arenas/hooks/useArenas';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import {
  SLOT_STATUS_COLORS,
  SLOT_STATUS_LABELS,
} from '@/modules/arenas/domain/slot_status';
import { aggregateDayStatus, buildMonthGrid } from '@/modules/arenas/domain/calendar_aggregate';
import { V2Button, V2Skeleton } from '@/v2/ui/primitives';
import V2DaySlotsDialog from './V2DaySlotsDialog';

const WEEKDAY_LABELS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function addMonths(yearMonth, delta) {
  const d = new Date(yearMonth + '-01T12:00:00');
  d.setMonth(d.getMonth() + delta);
  return d.toISOString().slice(0, 7);
}

function isSameMonth(dateStr, yearMonth) {
  return dateStr.startsWith(yearMonth + '-');
}

function isPast(dateStr) {
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
}

export default function V2BookingCalendar({ arenaId, arena: arenaProp }) {
  const { isAuthenticated } = useAuth();
  const { data: arenaData } = useArena(arenaId);
  const arena = arenaProp || arenaData;
  const { data: courts = [] } = useArenaCourts(arenaId);
  const { data: schedules = [] } = useArenaCourtSchedules(arenaId);
  const { data: bookings = [] } = useArenaBookings(arenaId);
  const { data: unavailabilities = [] } = useArenaUnavailabilities(arenaId);

  const today = new Date().toISOString().slice(0, 10);
  const [yearMonth, setYearMonth] = useState(today.slice(0, 7));
  const [courtId, setCourtId] = useState('all');
  const [selectedDate, setSelectedDate] = useState(null);

  const activeCourts = useMemo(() => courts.filter((c) => c.is_active !== false), [courts]);
  const showCourtFilter = activeCourts.length > 1;

  const grid = useMemo(() => buildMonthGrid(yearMonth), [yearMonth]);

  // Filtra schedules por quadra selecionada (se for uma)
  const filteredSchedules = useMemo(() => {
    if (courtId === 'all') return schedules;
    return schedules.filter((s) => !s.court_id || s.court_id === courtId);
  }, [courtId, schedules]);

  // Filtra bookings/unavailabilities por quadra (filtro client-side)
  const filteredBookings = useMemo(() => {
    const active = bookings.filter((b) => ['requested', 'negotiating', 'confirmed'].includes(b.status));
    if (courtId === 'all') return active;
    return active.filter((b) => !b.court_id || b.court_id === courtId);
  }, [bookings, courtId]);

  const filteredUnavailabilities = useMemo(() => {
    if (courtId === 'all') return unavailabilities;
    return unavailabilities.filter((u) => !u.court_id || u.court_id === courtId);
  }, [unavailabilities, courtId]);

  // Para cada dia do mês, calcula status agregado
  const dayStatusMap = useMemo(() => {
    const map = new Map();
    for (const date of grid) {
      map.set(date, aggregateDayStatus({
        date,
        courtId: courtId === 'all' ? null : courtId,
        schedules: filteredSchedules,
        bookings: filteredBookings,
        unavailabilities: filteredUnavailabilities,
      }));
    }
    return map;
  }, [grid, courtId, filteredSchedules, filteredBookings, filteredUnavailabilities]);

  function handleDayClick(date) {
    if (!isAuthenticated) {
      toast.error('Faça login para reservar.');
      return;
    }
    const meta = dayStatusMap.get(date);
    if (!meta || meta.isAllClosed) return; // dia fechado
    setSelectedDate(date);
  }

  if (!arena) return <V2Skeleton lines={4} />;

  const [year, month] = yearMonth.split('-').map(Number);
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-3">
      {/* Header: navegação de mês + filtro de quadra */}
      <div className="flex flex-wrap items-center gap-2">
        <V2Button size="sm" variant="ghost" onClick={() => setYearMonth(addMonths(yearMonth, -1))}>
          <ChevronLeft className="h-4 w-4" /> Mês anterior
        </V2Button>
        <div className="flex items-center gap-1.5 rounded-2xl border border-gray-200 bg-paper px-3 py-1.5 text-sm font-bold text-ink capitalize">
          <Calendar className="h-4 w-4 text-emerald-700" />
          {monthLabel}
        </div>
        <V2Button size="sm" variant="ghost" onClick={() => setYearMonth(addMonths(yearMonth, 1))}>
          Próximo mês <ChevronRight className="h-4 w-4" />
        </V2Button>
        {showCourtFilter && (
          <select
            value={courtId}
            onChange={(e) => setCourtId(e.target.value)}
            className="rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm"
          >
            <option value="all">Todas as quadras</option>
            {activeCourts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full bg-emerald-500" />
          <span className="text-gray-600">Tem horário livre</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full bg-amber-500" />
          <span className="text-gray-600">Reservas pendentes</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          <span className="text-gray-600">Reservado</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full bg-orange-500" />
          <span className="text-gray-600">Indisponível (admin)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full bg-gray-300" />
          <span className="text-gray-600">Fechado (sem horário)</span>
        </div>
      </div>

      {/* Grade do mês */}
      <div className="overflow-hidden rounded-3xl border border-gray-100 bg-paper">
        {/* Header da semana */}
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
          {WEEKDAY_LABELS_PT.map((wd) => (
            <div key={wd} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {wd}
            </div>
          ))}
        </div>
        {/* Dias */}
        <div className="grid grid-cols-7">
          {grid.map((date) => {
            const meta = dayStatusMap.get(date);
            const inMonth = isSameMonth(date, yearMonth);
            const past = isPast(date);
            const isToday = date === today;
            const c = SLOT_STATUS_COLORS[meta.dayStatus];
            const closed = meta.isAllClosed;
            const clickable = inMonth && !past && !closed;

            return (
              <button
                key={date}
                type="button"
                disabled={!clickable}
                onClick={() => handleDayClick(date)}
                className={cn(
                  'flex min-h-[68px] flex-col items-center justify-start gap-1 border-b border-r border-gray-100 p-2 text-left transition-all',
                  !inMonth && 'bg-gray-50/50 text-gray-300',
                  inMonth && !past && !closed && 'hover:bg-emerald-50 cursor-pointer',
                  inMonth && past && 'bg-gray-50/30 text-gray-300 cursor-not-allowed',
                  inMonth && !past && closed && 'bg-gray-50/70 text-gray-400 cursor-not-allowed',
                  isToday && 'ring-2 ring-inset ring-emerald-500',
                )}
              >
                <span className={cn(
                  'text-xs font-bold',
                  isToday && 'text-emerald-700',
                  inMonth ? 'text-ink' : 'text-gray-300',
                )}>
                  {Number(date.slice(-2))}
                </span>
                {inMonth && !past && !closed && (
                  <span className={cn('h-2 w-2 rounded-full', c.dot)} aria-label={SLOT_STATUS_LABELS[meta.dayStatus]} />
                )}
                {inMonth && past && (
                  <span className="text-[9px] text-gray-300">passou</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {!isAuthenticated && (
        <p className="text-center text-xs text-gray-400">
          <Link to="/login" className="text-emerald-700 underline">Faça login</Link> para reservar.
        </p>
      )}

      {/* Dialog de slots do dia selecionado */}
      {selectedDate && (
        <V2DaySlotsDialog
          arena={arena}
          arenaId={arenaId}
          date={selectedDate}
          courtId={courtId === 'all' ? null : courtId}
          courts={activeCourts}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}
