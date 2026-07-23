/**
 * V2DaySlotsDialog — Modal com slots horários de 1 dia.
 *
 * Aberto quando o user clica num dia do V2BookingCalendar (mensal).
 * Mostra os slots do dia em grid, permite selecionar 1+ slots disponíveis
 * e abre o BookingRequestDialog com `preselectedSlots` preenchidos.
 *
 * Status por slot (mesma paleta do calendário):
 *  - closed: dia/horário sem schedule aberto (admin não definiu)
 *  - unavailable: admin marcou indisponibilidade
 *  - pending/confirmed: reserva ativa
 *  - available: clicável
 *
 * Quando user clica em "Solicitar reserva", passa os slots selecionados
 * para o BookingRequestDialog, que já tem seleção de quadra no formulário.
 */

import React, { useMemo, useState } from 'react';
import { Calendar, X, ShoppingCart, Loader2 } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { cn } from '@/core/lib/utils';
import {
  useArenaCourtSchedules,
  useArenaUnavailabilities,
} from '@/modules/arenas/hooks/useArenas';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import {
  getSlotStatus,
  generateTimeSlots,
  isSlotSelectable,
  SLOT_STATUS_COLORS,
  SLOT_STATUS_LABELS,
  SLOT_STATUS,
} from '@/modules/arenas/domain/slot_status';
import { weekdayOf } from '@/modules/arenas/domain/booking';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { useBookingPrice } from '@/modules/arenas/hooks/useBookingPrice';
import { V2Badge, V2Button, V2EmptyState, V2Skeleton } from '@/v2/ui/primitives';
import BookingRequestDialog from '@/modules/arenas/components/BookingRequestDialog';

const STEP = 60;

export default function V2DaySlotsDialog({ arena, arenaId, date, courtId: initialCourtId, courts = [], onClose }) {
  const { user, isAuthenticated } = useAuth();
  const { data: schedules = [], isLoading: loadingSchedules } = useArenaCourtSchedules(arenaId);
  const { data: bookings = [], isLoading: loadingBookings } = useArenaBookings(arenaId);
  const { data: unavailabilities = [], isLoading: loadingUnav } = useArenaUnavailabilities(arenaId);

  // Quadra pode ser trocada DENTRO do dialog (se arena tem > 1)
  const [courtId, setCourtId] = useState(initialCourtId || '');
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [bookingOpen, setBookingOpen] = useState(false);

  const weekday = weekdayOf(date);
  const dateLabel = useMemo(() => {
    const d = new Date(date + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }, [date]);

  // Slots do dia
  const slotsWithStatus = useMemo(() => {
    if (loadingSchedules || loadingBookings || loadingUnav || weekday == null) return [];
    const daySchedules = schedules.filter(
      (s) => s.is_active !== false && Array.isArray(s.weekdays) && s.weekdays.includes(weekday),
    );
    if (daySchedules.length === 0) return [];

    // Filtra por quadra
    const filteredSchedules = courtId
      ? daySchedules.filter((s) => !s.court_id || s.court_id === courtId)
      : daySchedules;
    if (filteredSchedules.length === 0) return [];

    const ranges = filteredSchedules.map((s) => ({ start: s.start_time, end: s.end_time }));
    const allTimes = new Set();
    for (const r of ranges) {
      const slots = generateTimeSlots(r.start, r.end, STEP);
      slots.forEach((t) => allTimes.add(t));
    }
    const times = Array.from(allTimes).sort();
    return times.map((time) => {
      const result = getSlotStatus({
        date,
        time,
        courtId: courtId || null,
        schedules: filteredSchedules,
        bookings: bookings.filter((b) => ['requested', 'negotiating', 'confirmed'].includes(b.status)),
        unavailabilities: courtId
          ? unavailabilities.filter((u) => !u.court_id || u.court_id === courtId)
          : unavailabilities,
      });
      return { time, ...result };
    });
  }, [loadingSchedules, loadingBookings, loadingUnav, weekday, date, courtId, schedules, bookings, unavailabilities]);

  const price = useBookingPrice(arena, courtId || null, selectedSlots);

  function toggleSlot(time) {
    const slot = slotsWithStatus.find((s) => s.time === time);
    if (!slot || !isSlotSelectable(slot.status)) return;
    setSelectedSlots((prev) => {
      const exists = prev.find((s) => s.start === time);
      if (exists) return prev.filter((s) => s.start !== time);
      const idx = slotsWithStatus.findIndex((s) => s.time === time);
      const next = slotsWithStatus[idx + 1];
      const end = next?.time || `${String(parseInt(time.split(':')[0]) + 1).padStart(2, '0')}:00`;
      return [...prev, { date, start: time, end, courtId: courtId || null }].sort((a, b) => a.start.localeCompare(b.start));
    });
  }

  function clearSelection() { setSelectedSlots([]); }

  function handleConfirm() {
    if (!isAuthenticated) return;
    if (selectedSlots.length === 0) return;
    setBookingOpen(true);
  }

  const loading = loadingSchedules || loadingBookings || loadingUnav;
  const hasAvailable = slotsWithStatus.some((s) => s.status === SLOT_STATUS.AVAILABLE);
  const noSchedule = !loading && slotsWithStatus.length === 0;

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-2xl overflow-hidden rounded-t-3xl bg-paper shadow-organic-md sm:rounded-3xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-700" />
              <h3 className="font-display text-lg font-bold text-ink capitalize">{dateLabel}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-ink"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Filtro de quadra */}
          {courts.length > 1 && (
            <div className="border-b border-gray-100 p-4">
              <label className="block text-xs font-bold text-gray-500">Quadra</label>
              <select
                value={courtId}
                onChange={(e) => { setCourtId(e.target.value); setSelectedSlots([]); }}
                className="mt-1 w-full rounded-2xl border border-gray-200 bg-paper-pure px-3 py-2 text-sm"
              >
                <option value="">Qualquer uma (sem quadra específica)</option>
                {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Body: grade de slots */}
          <div className="max-h-[60vh] overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando horários…
              </div>
            ) : noSchedule ? (
              <V2EmptyState
                icon={Calendar}
                title="Arena fechada neste dia"
                description={
                  courtId
                    ? 'Esta arena não definiu horários abertos para esta quadra neste dia da semana.'
                    : 'A arena não definiu horários abertos para este dia da semana. Tente outro dia.'
                }
              />
            ) : !hasAvailable ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-bold">Sem horários disponíveis neste dia.</p>
                <p className="mt-1 text-xs">Todos os horários estão reservados ou marcados como indisponíveis pelo admin. Tente outro dia ou outra quadra.</p>
              </div>
            ) : (
              <>
                {/* Legenda compacta */}
                <div className="mb-3 flex flex-wrap gap-2 text-[10px]">
                  {Object.entries(SLOT_STATUS_LABELS).map(([k, v]) => {
                    const c = SLOT_STATUS_COLORS[k];
                    return (
                      <div key={k} className="flex items-center gap-1">
                        <span className={cn('h-2.5 w-2.5 rounded-full', c.dot)} />
                        <span className="text-gray-600">{v}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
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
                          status === SLOT_STATUS.PENDING || status === SLOT_STATUS.CONFIRMED
                            ? `Reserva de ${booking?.athlete_name || 'outro atleta'}`
                            : undefined
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
              </>
            )}
          </div>

          {/* Footer: seleção + ação */}
          <div className="border-t border-gray-100 bg-paper p-4">
            {selectedSlots.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                <V2Button onClick={handleConfirm}>
                  Solicitar reserva
                </V2Button>
              </div>
            ) : (
              <p className="text-center text-xs text-gray-400">
                Selecione um ou mais horários disponíveis para reservar.
              </p>
            )}
          </div>
        </div>
      </div>

      {bookingOpen && (
        <BookingRequestDialog
          arena={arena}
          court={selectedSlots[0]?.courtId ? courts.find((c) => c.id === selectedSlots[0].courtId) : null}
          preselectedSlots={selectedSlots}
          onClose={() => {
            setBookingOpen(false);
            clearSelection();
            onClose();
          }}
        />
      )}
    </>
  );
}
