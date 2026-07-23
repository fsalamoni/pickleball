/**
 * V2DaySlotsDialog — Modal com slots + detalhes do dia selecionado.
 *
 * Aberto quando o user clica num dia do V2BookingCalendar (mensal).
 * Mostra 3 seções:
 *  1. Resumo do dia (badges com contagens)
 *  2. Reservas existentes no dia (PENDING/CONFIRMED) — com nome do
 *     solicitante, horário, quadra e status
 *  3. Indisponibilidades admin (com motivo)
 *  4. Grade de slots clicáveis (apenas AVAILABLE é selecionável)
 *
 * Quando user clica em "Solicitar reserva", passa os slots selecionados
 * para o BookingRequestDialog, que já tem seleção de quadra no formulário.
 *
 * REGRA DE NEGÓCIO: slots com status REQUESTED, NEGOTIATING, CONFIRMED
 * NÃO são clicáveis (isSlotSelectable retorna true só pra AVAILABLE).
 * Quando admin marca indisponibilidade, o slot também fica não-clicável.
 *
 * IMPORTANTE: PENDING/REQUESTED aparece no calendário como "solicitação
 * em andamento" (amber). CONFIRMED aparece como "reservado" (vermelho).
 * Ambos bloqueiam o slot para novos pedidos.
 */

import React, { useMemo, useState } from 'react';
import {
  Calendar, X, ShoppingCart, Loader2, Users, Ban, Check, Clock, AlertCircle, MapPin,
} from 'lucide-react';
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
import { V2Button, V2Badge, V2EmptyState, V2Skeleton } from '@/v2/ui/primitives';
import BookingRequestDialog from '@/modules/arenas/components/BookingRequestDialog';

const STEP = 60;

const STATUS_PRIORITY = {
  [SLOT_STATUS.PENDING]: 1,
  [SLOT_STATUS.CONFIRMED]: 2,
  [SLOT_STATUS.UNAVAILABLE]: 3,
  [SLOT_STATUS.AVAILABLE]: 0,
  [SLOT_STATUS.CLOSED]: 4,
  [SLOT_STATUS.COMPLETED]: 5,
};

const BOOKING_STATUS_LABELS = {
  requested: 'Solicitação em andamento',
  negotiating: 'Em negociação',
  confirmed: 'Reservado',
  pending_payment: 'Aguardando pagamento',
  checked_in: 'Check-in feito',
  cancelled: 'Cancelada',
  withdrawn: 'Desistência',
  completed: 'Concluída',
};

function statusBadgeTone(status) {
  if (status === 'confirmed' || status === 'checked_in' || status === 'completed') return 'green';
  if (status === 'requested' || status === 'negotiating' || status === 'pending_payment') return 'amber';
  if (status === 'cancelled' || status === 'withdrawn') return 'red';
  return 'neutral';
}

function timeOverlap(slotA, slotB) {
  // slot: { date, start, end } (HH:MM)
  if (slotA.date !== slotB.date) return false;
  const toMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const aS = toMin(slotA.start), aE = toMin(slotA.end);
  const bS = toMin(slotB.start), bE = toMin(slotB.end);
  return aS < bE && bS < aE;
}

function expandBookingSlots(booking) {
  // Aceita booking com .slots (array) OU .date+start+end (legacy)
  if (Array.isArray(booking.slots) && booking.slots.length > 0) return booking.slots;
  if (booking.date) return [{ date: booking.date, start: booking.start, end: booking.end }];
  return [];
}

export default function V2DaySlotsDialog({ arena, arenaId, date, courtId: initialCourtId, courts = [], onClose }) {
  const { isAuthenticated } = useAuth();
  const { data: schedules = [], isLoading: loadingSchedules } = useArenaCourtSchedules(arenaId);
  const { data: bookings = [], isLoading: loadingBookings } = useArenaBookings(arenaId);
  const { data: unavailabilities = [], isLoading: loadingUnav } = useArenaUnavailabilities(arenaId);

  const [courtId, setCourtId] = useState(initialCourtId || '');
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [bookingOpen, setBookingOpen] = useState(false);

  const weekday = weekdayOf(date);
  const dateLabel = useMemo(() => {
    const d = new Date(date + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }, [date]);

  // Reservas ATIVAS do dia (REQUESTED, NEGOTIATING, CONFIRMED, PENDING_PAYMENT)
  const activeBookingsOfDay = useMemo(() => {
    if (!bookings) return [];
    return bookings
      .filter((b) => ['requested', 'negotiating', 'confirmed', 'pending_payment'].includes(b.status))
      .map((b) => ({ ...b, _slots: expandBookingSlots(b) }))
      .filter((b) => b._slots.some((s) => s.date === date))
      // Filtra por quadra se selecionada
      .filter((b) => !courtId || !b.court_id || b.court_id === courtId);
  }, [bookings, date, courtId]);

  // Indisponibilidades admin do dia
  const unavailabilitiesOfDay = useMemo(() => {
    if (!unavailabilities) return [];
    return unavailabilities
      .filter((u) => u.date === date)
      .filter((u) => !courtId || !u.court_id || u.court_id === courtId);
  }, [unavailabilities, date, courtId]);

  // Slots do dia (1h cada, dentro dos schedules)
  const slotsWithStatus = useMemo(() => {
    if (loadingSchedules || loadingBookings || loadingUnav || weekday == null) return [];
    const daySchedules = schedules.filter(
      (s) => s.is_active !== false && Array.isArray(s.weekdays) && s.weekdays.includes(weekday),
    );
    if (daySchedules.length === 0) return [];

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

    // Filtra bookings/unavs por court
    const dayBookings = activeBookingsOfDay.map((b) => ({ ...b, slots: b._slots }));
    const dayUnavs = unavailabilitiesOfDay;

    return times.map((time) => {
      const slot = { date, start: time, end: `${String(parseInt(time.split(':')[0]) + 1).padStart(2, '0')}:00` };
      const result = getSlotStatus({
        date, time,
        courtId: courtId || null,
        schedules: filteredSchedules,
        bookings: dayBookings,
        unavailabilities: dayUnavs,
      });

      // Encontra o booking específico (se houver) — pega o primeiro que cobre o slot
      const coveringBooking = dayBookings.find((b) =>
        b._slots.some((s) => timeOverlap(s, slot)),
      );
      // Encontra a unavailability que cobre
      const coveringUnav = dayUnavs.find((u) => {
        const uSlot = { date, start: u.start_time, end: u.end_time };
        return timeOverlap(uSlot, slot);
      });

      return {
        time,
        ...result,
        booking: coveringBooking || result.booking,
        unavailability: coveringUnav || result.unavailability,
      };
    });
  }, [loadingSchedules, loadingBookings, loadingUnav, weekday, date, courtId, schedules, activeBookingsOfDay, unavailabilitiesOfDay]);

  const price = useBookingPrice(arena, courtId || null, selectedSlots);

  // Resumo do dia
  const summary = useMemo(() => {
    const counts = { available: 0, pending: 0, confirmed: 0, unavailable: 0, closed: 0 };
    for (const s of slotsWithStatus) {
      if (s.status === SLOT_STATUS.AVAILABLE) counts.available += 1;
      else if (s.status === SLOT_STATUS.PENDING) counts.pending += 1;
      else if (s.status === SLOT_STATUS.CONFIRMED) counts.confirmed += 1;
      else if (s.status === SLOT_STATUS.UNAVAILABLE) counts.unavailable += 1;
      else counts.closed += 1;
    }
    return counts;
  }, [slotsWithStatus]);

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
        <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-paper shadow-organic-md sm:rounded-3xl" style={{ maxHeight: '90vh' }}>
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
              <label className="block text-xs font-bold text-gray-500">Filtrar por quadra</label>
              <select
                value={courtId}
                onChange={(e) => { setCourtId(e.target.value); setSelectedSlots([]); }}
                className="mt-1 w-full rounded-2xl border border-gray-200 bg-paper-pure px-3 py-2 text-sm"
              >
                <option value="">Todas as quadras</option>
                {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Body scrollable */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : (
              <>
                {/* Resumo do dia */}
                <div className="border-b border-gray-100 bg-paper-pure p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Resumo do dia</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <V2Badge tone="green">
                      <Check className="h-3 w-3" /> {summary.available} horário{summary.available === 1 ? '' : 's'} disponível{summary.available === 1 ? '' : 'is'}
                    </V2Badge>
                    {summary.pending > 0 && (
                      <V2Badge tone="amber">
                        <AlertCircle className="h-3 w-3" /> {summary.pending} solicitação{summary.pending === 1 ? '' : 'es'} em andamento
                      </V2Badge>
                    )}
                    {summary.confirmed > 0 && (
                      <V2Badge tone="red">
                        <Check className="h-3 w-3" /> {summary.confirmed} já reservado
                      </V2Badge>
                    )}
                    {summary.unavailable > 0 && (
                      <V2Badge tone="amber">
                        <Ban className="h-3 w-3" /> {summary.unavailable} indisponível
                      </V2Badge>
                    )}
                    {summary.closed > 0 && (
                      <V2Badge tone="neutral">
                        <X className="h-3 w-3" /> {summary.closed} fechado (sem horário)
                      </V2Badge>
                    )}
                  </div>
                </div>

                {/* Reservas existentes */}
                {activeBookingsOfDay.length > 0 && (
                  <div className="border-b border-gray-100 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      <Users className="mr-1 inline h-3 w-3" /> Reservas neste dia ({activeBookingsOfDay.length})
                    </p>
                    <ul className="mt-2 space-y-2">
                      {activeBookingsOfDay
                        .sort((a, b) => {
                          // Ordena por horário do primeiro slot + status
                          const aTime = a._slots[0]?.start || '';
                          const bTime = b._slots[0]?.start || '';
                          if (aTime !== bTime) return aTime.localeCompare(bTime);
                          return (STATUS_PRIORITY[a.status] || 9) - (STATUS_PRIORITY[b.status] || 9);
                        })
                        .map((b) => {
                          const slotsText = b._slots
                            .map((s) => `${s.start}–${s.end}`)
                            .join(', ');
                          const courtName = b.court_id
                            ? courts.find((c) => c.id === b.court_id)?.name || 'Quadra'
                            : 'Qualquer quadra';
                          return (
                            <li key={b.id} className={cn(
                              'rounded-2xl border p-3 text-sm',
                              b.status === 'confirmed' ? 'border-red-200 bg-red-50/40' :
                              b.status === 'requested' || b.status === 'negotiating' ? 'border-amber-200 bg-amber-50/40' :
                              'border-gray-200 bg-paper',
                            )}>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-ink">{b.athlete_name || 'Atleta'}</span>
                                <V2Badge tone={statusBadgeTone(b.status)}>
                                  {BOOKING_STATUS_LABELS[b.status] || b.status}
                                </V2Badge>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> {slotsText}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" /> {courtName}
                                </span>
                              </div>
                              {b.proposed_price != null && (
                                <div className="mt-1 text-xs font-bold text-emerald-700">
                                  {formatPrice(b.proposed_price)}
                                </div>
                              )}
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                )}

                {/* Indisponibilidades admin */}
                {unavailabilitiesOfDay.length > 0 && (
                  <div className="border-b border-gray-100 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      <Ban className="mr-1 inline h-3 w-3" /> Indisponibilidades ({unavailabilitiesOfDay.length})
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-gray-600">
                      {unavailabilitiesOfDay.map((u) => {
                        const courtName = u.court_id
                          ? courts.find((c) => c.id === u.court_id)?.name || 'Quadra'
                          : 'Todas as quadras';
                        return (
                          <li key={u.id} className="flex items-center gap-2">
                            <Ban className="h-3 w-3 shrink-0 text-orange-500" />
                            <span><strong>{u.start_time}–{u.end_time}</strong> · {courtName}</span>
                            {u.notes && <span className="italic text-gray-500">— {u.notes}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Grade de slots */}
                <div className="p-4">
                  {noSchedule ? (
                    <V2EmptyState
                      icon={Calendar}
                      title="Arena fechada neste dia"
                      description={
                        courtId
                          ? 'Esta arena não definiu horários abertos para esta quadra neste dia da semana.'
                          : 'A arena não definiu horários abertos para este dia da semana. Tente outro dia ou outra quadra.'
                      }
                    />
                  ) : !hasAvailable ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      <p className="font-bold">Sem horários disponíveis neste dia.</p>
                      <p className="mt-1 text-xs">Todos os horários estão reservados, com solicitação em andamento ou marcados como indisponíveis pelo admin. Tente outro dia ou outra quadra.</p>
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
                          const tooltip = (() => {
                            if (status === SLOT_STATUS.UNAVAILABLE) {
                              const reason = unavailability?.notes || 'Indisponível';
                              return `${time} · Indisponível: ${reason}`;
                            }
                            if (status === SLOT_STATUS.PENDING) {
                              return `${time} · Solicitação: ${booking?.athlete_name || 'outro atleta'}`;
                            }
                            if (status === SLOT_STATUS.CONFIRMED) {
                              return `${time} · Reservado: ${booking?.athlete_name || 'outro atleta'}`;
                            }
                            if (status === SLOT_STATUS.COMPLETED) {
                              return `${time} · Concluído`;
                            }
                            if (status === SLOT_STATUS.CLOSED) {
                              return `${time} · Fechado (sem horário)`;
                            }
                            return `${time} · ${SLOT_STATUS_LABELS[status]}`;
                          })();
                          return (
                            <button
                              key={time}
                              type="button"
                              disabled={!canSelect}
                              onClick={() => toggleSlot(time)}
                              title={tooltip}
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
                              {(status === SLOT_STATUS.PENDING || status === SLOT_STATUS.CONFIRMED) && booking?.athlete_name && (
                                <div className="mt-1 truncate text-[9px] italic text-gray-600">
                                  {booking.athlete_name}
                                </div>
                              )}
                              {isSelected && <div className="mt-1 text-[10px] font-bold text-emerald-700">✓ Selecionado</div>}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
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
                {hasAvailable
                  ? 'Selecione um ou mais horários disponíveis para reservar.'
                  : 'Sem horários disponíveis para selecionar neste dia.'}
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
