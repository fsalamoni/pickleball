/**
 * V2AdminBookingCalendar — Calendário ADMIN (Sprint 5).
 *
 * Funcionalidades:
 *  - Mostra slots de 1 dia com status (igual público)
 *  - Clique em slot com reserva: abre painel de ações:
 *    - Ver dados do responsável (nome, telefone)
 *    - Iniciar chat com o responsável
 *    - Alterar responsável (transferir reserva)
 *    - Alterar data/horário
 *    - Cancelar reserva
 *  - Clique em slot vazio: admin pode:
 *    - Marcar indisponibilidade (com ou sem observação)
 *    - Criar reserva manualmente em nome de alguém
 *  - Mesma navegação ←/→ e filtro por quadra
 */

import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Calendar, MessageCircle, UserCog, X, Edit3, Ban, Plus, Trash2, CheckCircle,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { cn } from '@/core/lib/utils';
import { useArena, useArenaCourts, useArenaCourtSchedules, useArenaBookings, useArenaUnavailabilities, useAddArenaUnavailability, useDeleteArenaUnavailability } from '@/modules/arenas/hooks/useArenas';
import { useUpdateBookingStatus } from '@/modules/arenas/hooks/useBookings';
import { getSlotStatus, generateTimeSlots, isSlotClickable, SLOT_STATUS_COLORS, SLOT_STATUS_LABELS, SLOT_STATUS } from '@/modules/arenas/domain/slot_status';
import { weekdayOf } from '@/modules/arenas/domain/booking';
import { BOOKING_STATUS } from '@/modules/arenas/domain/constants';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Surface, V2Skeleton, V2Textarea,
} from '@/v2/ui/primitives';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateBR(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' });
}

const STEP = 60;

export default function V2AdminBookingCalendar({ arenaId, embedded = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: arena } = useArena(arenaId);
  const { data: courts = [] } = useArenaCourts(arenaId);
  const { data: schedules = [] } = useArenaCourtSchedules(arenaId);
  const { data: bookings = [] } = useArenaBookings(arenaId);
  const { data: unavailabilities = [] } = useArenaUnavailabilities(arenaId);
  const addUnav = useAddArenaUnavailability(arenaId);
  const removeUnav = useDeleteArenaUnavailability(arenaId);
  const updateStatus = useUpdateBookingStatus();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [courtId, setCourtId] = useState('all');
  const [selectedSlot, setSelectedSlot] = useState(null); // { time, status, booking, unavailability }
  const [unavForm, setUnavForm] = useState({ notes: '' });
  const [transferOpen, setTransferOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  const filtered = useMemo(() => {
    const filterByCourt = (list) => list.filter((it) => {
      if (courtId === 'all') return true;
      if (!it.court_id) return true;
      return it.court_id === courtId;
    });
    return {
      schedules: filterByCourt(schedules),
      bookings: filterByCourt(bookings.filter((b) =>
        b.status === BOOKING_STATUS.REQUESTED ||
        b.status === BOOKING_STATUS.NEGOTIATING ||
        b.status === BOOKING_STATUS.CONFIRMED
      )),
      completed: filterByCourt(bookings.filter((b) => b.status === BOOKING_STATUS.COMPLETED)),
      unavailabilities: filterByCourt(unavailabilities.filter((u) => u.date === date)),
    };
  }, [courtId, schedules, bookings, unavailabilities, date]);

  const daySlots = useMemo(() => {
    if (!date) return [];
    const weekday = weekdayOf(date);
    const ranges = filtered.schedules.filter((s) => Array.isArray(s.weekdays) && s.weekdays.includes(weekday))
      .map((s) => ({ start: s.start_time, end: s.end_time }));
    const minStart = ranges.length > 0 ? Math.min(...ranges.map((r) => parseInt(r.start.split(':')[0]))) : 6;
    const maxEnd = ranges.length > 0 ? Math.max(...ranges.map((r) => parseInt(r.end.split(':')[0]))) : 23;
    const extended = [];
    for (let h = 0; h < 24; h += STEP / 60) {
      const t = `${String(h).padStart(2, '0')}:00`;
      const isForced = h < minStart || h >= maxEnd;
      extended.push({ time: t, forcedClosed: isForced });
    }
    return extended;
  }, [date, filtered.schedules]);

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
        bookings_completed: filtered.completed,
      }) };
    });
  }, [daySlots, date, courtId, filtered]);

  function onSlotClick(time) {
    const slot = slotsWithStatus.find((s) => s.time === time);
    if (!slot || !isSlotClickable(slot.status)) return;
    setSelectedSlot(slot);
    setUnavForm({ notes: '' });
  }

  async function handleMarkUnavailable() {
    if (!selectedSlot) return;
    try {
      const cid = courtId === 'all' ? null : courtId;
      await addUnav.mutateAsync({
        date, court_id: cid,
        start_time: selectedSlot.time,
        end_time: `${String(parseInt(selectedSlot.time.split(':')[0]) + 1).padStart(2, '0')}:00`,
        notes: unavForm.notes,
      });
      toast.success('Horário marcado como indisponível.');
      setSelectedSlot(null);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleRemoveUnavailability() {
    if (!selectedSlot?.unavailability) return;
    try {
      await removeUnav.mutateAsync(selectedSlot.unavailability.id);
      toast.success('Indisponibilidade removida.');
      setSelectedSlot(null);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleCancelBooking() {
    if (!selectedSlot?.booking) return;
    try {
      await updateStatus.mutateAsync({ booking: selectedSlot.booking, status: BOOKING_STATUS.CANCELLED });
      toast.success('Reserva cancelada.');
      setSelectedSlot(null);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleConfirmBooking() {
    if (!selectedSlot?.booking) return;
    try {
      await updateStatus.mutateAsync({ booking: selectedSlot.booking, status: BOOKING_STATUS.CONFIRMED });
      toast.success('Reserva confirmada.');
      setSelectedSlot(null);
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (!arena) return <V2Skeleton lines={4} />;

  return (
    <div className="space-y-3">
      {/* Header */}
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
        <select value={courtId} onChange={(e) => setCourtId(e.target.value)}
          className="rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm">
          <option value="all">Todas as quadras</option>
          {courts.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {slotsWithStatus.map(({ time, status, booking, unavailability }) => {
          const c = SLOT_STATUS_COLORS[status];
          const clickable = isSlotClickable(status);
          return (
            <button
              key={time}
              type="button"
              disabled={!clickable}
              onClick={() => onSlotClick(time)}
              title={
                status === SLOT_STATUS.UNAVAILABLE ? unavailability?.notes :
                (booking?.athlete_name ? `${booking.athlete_name}${booking.notes ? ' · ' + booking.notes : ''}` : undefined)
              }
              className={cn(
                'flex flex-col items-center justify-center rounded-2xl border-2 p-3 transition-all',
                c.bg, c.border,
                clickable ? 'hover:scale-[1.03] cursor-pointer' : 'cursor-not-allowed opacity-60',
              )}
            >
              <div className={cn('font-display text-base font-bold', c.text)}>{time}</div>
              <div className={cn('text-[10px] uppercase tracking-widest', c.text)}>
                {SLOT_STATUS_LABELS[status]}
              </div>
              {booking?.athlete_name && (
                <div className="mt-0.5 truncate text-[10px] text-gray-600 max-w-full">
                  {booking.athlete_name.split(' ')[0]}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Painel de ações do slot selecionado */}
      {selectedSlot && (
        <V2Surface className="mt-4 border-2 border-emerald-300">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-display text-base font-bold text-ink">
                {selectedSlot.time} · {SLOT_STATUS_LABELS[selectedSlot.status]}
              </h3>
              <p className="text-xs text-gray-500">{formatDateBR(date)}</p>
            </div>
            <button onClick={() => setSelectedSlot(null)} className="text-gray-500 hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Reserva existente */}
          {selectedSlot.booking && (
            <div className="mt-3 space-y-2">
              <div className="rounded-2xl border border-gray-100 bg-paper p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-amber-500 text-sm font-bold text-white">
                    {selectedSlot.booking.athlete_name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-ink">{selectedSlot.booking.athlete_name || 'Atleta'}</div>
                    <div className="text-xs text-gray-500">
                      Status: {selectedSlot.booking.status}
                      {selectedSlot.booking.proposed_price != null && ` · R$ ${Number(selectedSlot.booking.proposed_price).toFixed(2)}`}
                    </div>
                  </div>
                </div>
                {selectedSlot.booking.notes && (
                  <p className="mt-2 text-xs text-gray-600">"{selectedSlot.booking.notes}"</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {selectedSlot.booking.athlete_id && (
                  <V2Button size="sm" variant="secondary" onClick={() => navigate(`/chat?with=${selectedSlot.booking.athlete_id}`)}>
                    <MessageCircle className="h-3.5 w-3.5" /> Chat
                  </V2Button>
                )}
                <V2Button size="sm" variant="secondary" onClick={() => setTransferOpen(true)}>
                  <UserCog className="h-3.5 w-3.5" /> Transferir
                </V2Button>
                <V2Button size="sm" variant="secondary" onClick={() => setRescheduleOpen(true)}>
                  <Edit3 className="h-3.5 w-3.5" /> Remarcar
                </V2Button>
                {selectedSlot.booking.status !== BOOKING_STATUS.CONFIRMED && (
                  <V2Button size="sm" onClick={handleConfirmBooking} disabled={updateStatus.isPending}>
                    <CheckCircle className="h-3.5 w-3.5" /> Confirmar
                  </V2Button>
                )}
              </div>
              <ConfirmDialog
                open={true}
                onOpenChange={(o) => !o && setSelectedSlot(null)}
                title="Cancelar reserva?"
                description="A reserva será marcada como cancelada e o horário ficará disponível."
                confirmLabel="Cancelar reserva"
                onConfirm={handleCancelBooking}
                loading={updateStatus.isPending}
              />
            </div>
          )}

          {/* Indisponibilidade existente */}
          {selectedSlot.unavailability && (
            <div className="mt-3 space-y-2">
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3">
                <p className="text-xs font-bold uppercase text-orange-700">Indisponibilidade</p>
                {selectedSlot.unavailability.notes && <p className="mt-1 text-sm text-orange-900">{selectedSlot.unavailability.notes}</p>}
              </div>
              <V2Button size="sm" variant="ghost" onClick={handleRemoveUnavailability}>
                <Trash2 className="h-3.5 w-3.5 text-red-500" /> Remover indisponibilidade
              </V2Button>
            </div>
          )}

          {/* Slot vazio (disponível): admin pode marcar indisponibilidade */}
          {selectedSlot.status === SLOT_STATUS.AVAILABLE && !selectedSlot.booking && !selectedSlot.unavailability && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-gray-500">Slot livre. O que deseja fazer?</p>
              <V2Field label="Observação (opcional)">
                <V2Textarea
                  value={unavForm.notes}
                  onChange={(e) => setUnavForm({ notes: e.target.value })}
                  rows={2}
                  maxLength={500}
                  placeholder="Ex: Manutenção, evento privado..."
                />
              </V2Field>
              <div className="flex flex-wrap gap-2">
                <V2Button size="sm" onClick={handleMarkUnavailable} disabled={addUnav.isPending}>
                  <Ban className="h-3.5 w-3.5" /> Marcar indisponível
                </V2Button>
                <V2Button size="sm" variant="secondary" onClick={() => {/* TODO: criar reserva manual */ toast.info('Em breve: criar reserva manual')}}>
                  <Plus className="h-3.5 w-3.5" /> Criar reserva
                </V2Button>
              </div>
            </div>
          )}
        </V2Surface>
      )}

      {/* Dialogs de transferência/remarcação: em produção usam service próprio */}
      {transferOpen && selectedSlot?.booking && (
        <Dialog open onOpenChange={onClose => setTransferOpen(false)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Transferir reserva</DialogTitle><DialogDescription>Em construção: integração com diretório de atletas.</DialogDescription></DialogHeader>
            <div className="flex justify-end"><V2Button variant="ghost" size="sm" onClick={() => setTransferOpen(false)}>Fechar</V2Button></div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

