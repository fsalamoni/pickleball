/**
 * V2BookingCalendar — Calendário público interativo (Sprint 5).
 *
 * Funcionalidades:
 *  - Mostra slots de 1 dia (navegação ←/→)
 *  - Filtro por quadra
 *  - Multi-seleção de slots disponíveis (clica para selecionar)
 *  - Marcação visual: fechado, indisponível, pendente, reservado, disponível
 *  - Botão "Solicitar reserva" abre BookingRequestDialog com slots + preço
 *  - Auto-calcula preço total ao selecionar slots
 *
 * Rota: embutido em /arenas/:arenaId (público)
 */

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Calendar, ShoppingCart, X } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { cn } from '@/core/lib/utils';
import { useArena, useArenaCourts, useArenaCourtSchedules, useArenaUnavailabilities } from '@/modules/arenas/hooks/useArenas';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import { getSlotStatus, generateTimeSlots, isSlotSelectable, SLOT_STATUS_COLORS, SLOT_STATUS_LABELS, SLOT_STATUS } from '@/modules/arenas/domain/slot_status';
import { useBookingPrice } from '@/modules/arenas/hooks/useBookingPrice';
import { weekdayOf } from '@/modules/arenas/domain/booking';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { V2Badge, V2Button, V2Surface, V2EmptyState, V2Skeleton } from '@/v2/ui/primitives';
import BookingRequestDialog from '@/modules/arenas/components/BookingRequestDialog';

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateBR(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' });
}

const STEP = 60; // min — 1 hora

export default function V2BookingCalendar({ arenaId, arena: arenaProp, embedded = false }) {
  const { user, isAuthenticated } = useAuth();
  const { data: arenaData } = useArena(arenaId);
  const arena = arenaProp || arenaData;
  const { data: courts = [] } = useArenaCourts(arenaId);
  const { data: schedules = [] } = useArenaCourtSchedules(arenaId);
  const { data: bookings = [] } = useArenaBookings(arenaId);
  const { data: unavailabilities = [] } = useArenaUnavailabilities(arenaId);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [courtId, setCourtId] = useState('all');
  const [selectedSlots, setSelectedSlots] = useState([]); // [{ date, start, end, courtId }]
  const [bookingOpen, setBookingOpen] = useState(false);

  // Filtra schedules + bookings + unavailabilities pela quadra selecionada
  const filtered = useMemo(() => {
    const filterByCourt = (list) => list.filter((it) => {
      if (courtId === 'all') return true;
      if (!it.court_id) return true; // legado: sem court_id aparece pra todas
      return it.court_id === courtId;
    });
    return {
      schedules: filterByCourt(schedules),
      bookings: filterByCourt(bookings.filter((b) => b.status === 'requested' || b.status === 'negotiating' || b.status === 'confirmed')),
      unavailabilities: filterByCourt(unavailabilities.filter((u) => u.date === date)),
    };
  }, [courtId, schedules, bookings, unavailabilities, date]);

  // Gera slots do dia baseado nos schedules
  const daySlots = useMemo(() => {
    if (!date) return [];
    const weekday = weekdayOf(date);
    // Pega todos os ranges de tempo cobertos por schedules deste dia
    const ranges = filtered.schedules
      .filter((s) => Array.isArray(s.weekdays) && s.weekdays.includes(weekday))
      .map((s) => ({ start: s.start_time, end: s.end_time }));
    if (ranges.length === 0) return [];
    // Junta ranges e gera slots
    const allTimes = new Set();
    for (const r of ranges) {
      for (const t of generateTimeSlots(r.start, r.end, STEP)) {
        allTimes.add(t);
      }
    }
    // Adiciona também horário 'fechado' (manhã cedo + noite) pra dar contexto
    const all = Array.from(allTimes).sort();
    if (all.length === 0) return [];
    // Adiciona slots fechados nas bordas
    const minStart = Math.min(...ranges.map((r) => parseInt(r.start.split(':')[0])));
    const maxEnd = Math.max(...ranges.map((r) => parseInt(r.end.split(':')[0])));
    const extended = [];
    for (let h = 0; h < 24; h += STEP / 60) {
      const t = `${String(h).padStart(2, '0')}:00`;
      if (h < minStart || h >= maxEnd) {
        extended.push({ time: t, forcedClosed: true });
      } else {
        extended.push({ time: t, forcedClosed: false });
      }
    }
    return extended;
  }, [date, filtered.schedules]);

  // Aplica status
  const slotsWithStatus = useMemo(() => {
    return daySlots.map(({ time, forcedClosed }) => {
      if (forcedClosed) {
        return { time, status: SLOT_STATUS.CLOSED, booking: null, schedule: null, unavailability: null };
      }
      const cid = courtId === 'all' ? null : courtId;
      return { time, ...getSlotStatus({
        date, time, courtId: cid,
        schedules: filtered.schedules,
        bookings: filtered.bookings,
        unavailabilities: filtered.unavailabilities,
      }) };
    });
  }, [daySlots, date, courtId, filtered]);

  // Toggle slot na seleção
  function toggleSlot(time) {
    if (!isAuthenticated) {
      toast.error('Faça login para reservar.');
      return;
    }
    const slot = slotsWithStatus.find((s) => s.time === time);
    if (!slot || !isSlotSelectable(slot.status)) return;
    setSelectedSlots((prev) => {
      const exists = prev.find((s) => s.start === time);
      if (exists) return prev.filter((s) => s.start !== time);
      // Constrói slot com end = próximo slot ou +1h
      const idx = slotsWithStatus.findIndex((s) => s.time === time);
      const next = slotsWithStatus[idx + 1];
      const end = next?.time || `${String(parseInt(time.split(':')[0]) + 1).padStart(2, '0')}:00`;
      return [...prev, { date, start: time, end, courtId: courtId === 'all' ? null : courtId }].sort((a, b) => a.start.localeCompare(b.start));
    });
  }

  const price = useBookingPrice(arena, courtId === 'all' ? null : courtId, selectedSlots);

  function clearSelection() { setSelectedSlots([]); }

  if (!arena) return <V2Skeleton lines={4} />;

  const activeCourts = courts.filter((c) => c.is_active);
  const showCourtFilter = activeCourts.length > 1;

  return (
    <div className="space-y-3">
      {/* Header: navegação de data + filtro quadra */}
      <div className="flex flex-wrap items-center gap-2">
        <V2Button size="sm" variant="ghost" onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft className="h-4 w-4" /> Anterior
        </V2Button>
        <div className="flex items-center gap-1.5 rounded-2xl border border-gray-200 bg-paper px-3 py-1.5 text-sm font-bold text-ink">
          <Calendar className="h-4 w-4 text-emerald-700" />
          {formatDateBR(date)}
        </div>
        <V2Button size="sm" variant="ghost" onClick={() => setDate(addDays(date, 1))}>
          Próximo <ChevronRight className="h-4 w-4" />
        </V2Button>
        {showCourtFilter && (
          <select value={courtId} onChange={(e) => setCourtId(e.target.value)}
            className="rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm">
            <option value="all">Todas as quadras</option>
            {activeCourts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(SLOT_STATUS_LABELS).map(([k, v]) => {
          const c = SLOT_STATUS_COLORS[k];
          return (
            <div key={k} className="flex items-center gap-1">
              <span className={cn('h-3 w-3 rounded-full', c.dot)} />
              <span className="text-gray-600">{v}</span>
            </div>
          );
        })}
      </div>

      {/* Grid de slots */}
      {daySlots.length === 0 || (daySlots.every((s) => s.forcedClosed)) ? (
        <V2EmptyState icon={Calendar} title="Arena fechada nesta data" description="Tente outra data." />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {slotsWithStatus.map(({ time, status, booking, unavailability }) => {
            const c = SLOT_STATUS_COLORS[status];
            const isSelected = selectedSlots.some((s) => s.start === time);
            const canSelect = isSlotSelectable(status);
            return (
              <button
                key={time}
                type="button"
                disabled={!canSelect}
                onClick={() => toggleSlot(time)}
                title={
                  status === SLOT_STATUS.UNAVAILABLE ? unavailability?.notes :
                  status === SLOT_STATUS.PENDING || status === SLOT_STATUS.CONFIRMED ? `Reserva de ${booking?.athlete_name || 'outro atleta'}` :
                  undefined
                }
                className={cn(
                  'flex flex-col items-center justify-center rounded-2xl border-2 p-3 transition-all',
                  c.bg, c.border,
                  isSelected && 'ring-2 ring-emerald-500 ring-offset-1',
                  canSelect ? 'hover:scale-[1.03] cursor-pointer' : 'cursor-not-allowed opacity-70',
                )}
              >
                <div className={cn('font-display text-base font-bold', c.text)}>{time}</div>
                <div className={cn('text-[10px] uppercase tracking-widest', c.text)}>
                  {SLOT_STATUS_LABELS[status]}
                </div>
                {isSelected && <div className="mt-1 text-[10px] font-bold text-emerald-700">✓ Selecionado</div>}
              </button>
            );
          })}
        </div>
      )}

      {/* Footer: seleção atual + preço + ação */}
      {selectedSlots.length > 0 && (
        <div className="sticky bottom-0 z-10 mt-3 rounded-3xl border-2 border-emerald-300 bg-white p-3 shadow-organic-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-emerald-700" />
                <span className="text-sm font-bold text-ink">
                  {selectedSlots.length} horário{selectedSlots.length > 1 ? 's' : ''} selecionado{selectedSlots.length > 1 ? 's' : ''}
                </span>
                <button onClick={clearSelection} className="text-xs text-gray-500 underline">
                  Limpar
                </button>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {selectedSlots.map((s) => s.start).join(' · ')} · {price.durationMinutes}min
              </div>
              <div className="mt-1 text-base font-bold text-emerald-700">
                Total: {formatPrice(price.total)}
              </div>
            </div>
            <V2Button onClick={() => setBookingOpen(true)} disabled={!isAuthenticated}>
              Solicitar reserva
            </V2Button>
          </div>
        </div>
      )}

      {!isAuthenticated && (
        <p className="text-center text-xs text-gray-400">
          <Link to="/login" className="text-emerald-700 underline">Faça login</Link> para reservar.
        </p>
      )}

      {bookingOpen && (
        <BookingRequestDialog
          arena={arena}
          court={selectedSlots[0]?.courtId ? courts.find((c) => c.id === selectedSlots[0].courtId) : null}
          preselectedSlots={selectedSlots}
          onClose={() => { setBookingOpen(false); clearSelection(); }}
        />
      )}
    </div>
  );
}
