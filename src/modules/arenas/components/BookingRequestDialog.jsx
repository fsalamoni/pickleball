import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/core/lib/utils';
import { PlatformNotice } from '@/components/ui/platform-page';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { BOOKING_KIND, BOOKING_STATUS, WEEKDAY_LABELS } from '../domain/constants.js';
import { resolveArenaPrice, formatPrice } from '../domain/pricing.js';
import { bookingSlots, expandRecurring, hasConflictWithConfirmed, isValidSlot, sortSlots, weekdayOf } from '../domain/booking.js';
import { useArenaBookings, useCreateBooking } from '../hooks/useBookings.js';
import { useArenaCourts, useCourtSchedules } from '../hooks/useArenas.js';
import { validateBookingRequest, getCourtAvailabilityForDate, BLOCKING_STATUSES } from '../domain/booking_conflict.js';
import { normalizeTime } from '../domain/court_schedule.js';
import { canBeInstantBooking, arenaSupportsInstant, INSTANT_BOOKING_LABELS } from '../domain/instant_booking.js';
import { PAYMENT_METHOD } from '../domain/pdv.js';

function slotLabel(slot) {
  return `${slot.date} · ${slot.start}–${slot.end}`;
}

export default function BookingRequestDialog({ arena, open, onOpenChange }) {
  const { user } = useAuth();
  const createBooking = useCreateBooking();
  const { data: existingBookings = [] } = useArenaBookings(arena.id);
  const { data: courts = [] } = useArenaCourts(arena.id);
  const activeCourts = useMemo(() => courts.filter((c) => c.is_active !== false), [courts]);
  const [courtId, setCourtId] = useState('');
  const [kind, setKind] = useState(BOOKING_KIND.SINGLE);
  const [single, setSingle] = useState({ date: '', start: '18:00', end: '19:00' });
  const [recurring, setRecurring] = useState({ weekday: 1, start: '18:00', end: '19:00', weeks: 8, fromDate: '' });
  const [notes, setNotes] = useState('');
  const [isInstant, setIsInstant] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHOD.PIX);

  // Arena permite instant?
  const supportsInstant = arenaSupportsInstant(arena);

  // Reset courtId quando dialog abre/fecha
  React.useEffect(() => {
    if (open) setCourtId('');
  }, [open]);

  // Carrega schedules da quadra selecionada (ou todas se sem quadra)
  const { data: courtSchedulesData } = useCourtSchedules(courtId);
  const courtSchedules = useMemo(() => {
    if (!courtId) return [];
    return courtSchedulesData?.list || [];
  }, [courtId, courtSchedulesData]);

  // Validação em tempo real do slot (apenas SINGLE)
  const singleValidation = useMemo(() => {
    if (kind !== BOOKING_KIND.SINGLE) return { ok: true };
    if (!single.date || !normalizeTime(single.start) || !normalizeTime(single.end)) {
      return { ok: false, reason: 'incomplete', message: 'Preencha data e horários.' };
    }
    return validateBookingRequest({
      date: single.date,
      start_time: single.start,
      end_time: single.end,
      court_id: courtId || null,
      existingBookings,
      court_schedules: courtSchedules,
    });
  }, [kind, single, courtId, courtSchedules, existingBookings]);

  // Disponibilidade do dia (apenas SINGLE com data)
  const dayAvailability = useMemo(() => {
    if (kind !== BOOKING_KIND.SINGLE || !single.date || !courtId) return null;
    return getCourtAvailabilityForDate({
      date: single.date,
      court_schedules: courtSchedules,
      existingBookings,
      duration: 60,
    });
  }, [kind, single.date, courtId, courtSchedules, existingBookings]);

  const estimate = useMemo(() => {
    if (kind === BOOKING_KIND.SINGLE) {
      if (!single.date) return null;
      return resolveArenaPrice(arena, { date: single.date, weekday: weekdayOf(single.date), time: single.start, clientId: user?.uid });
    }
    return resolveArenaPrice(arena, { weekday: Number(recurring.weekday), time: recurring.start, clientId: user?.uid });
  }, [kind, single, recurring, arena, user?.uid]);

  const candidateSlots = useMemo(() => {
    if (kind === BOOKING_KIND.SINGLE) {
      const slot = { date: single.date, start: single.start, end: single.end };
      return isValidSlot(slot) ? [slot] : [];
    }
    return sortSlots(expandRecurring({
      weekday: Number(recurring.weekday),
      start: recurring.start,
      end: recurring.end,
      weeks: recurring.weeks,
      fromDate: recurring.fromDate,
    }));
  }, [kind, single, recurring]);

  const confirmedBookings = useMemo(
    () => existingBookings.filter((booking) => booking.status === BOOKING_STATUS.CONFIRMED),
    [existingBookings],
  );

  const upcomingConfirmedSlots = useMemo(
    () => sortSlots(confirmedBookings.flatMap((booking) => bookingSlots(booking))).slice(0, 8),
    [confirmedBookings],
  );

  const hasConflict = useMemo(
    () => candidateSlots.length > 0 && hasConflictWithConfirmed(candidateSlots, confirmedBookings),
    [candidateSlots, confirmedBookings],
  );

  async function handleSubmit() {
    try {
      if (kind === BOOKING_KIND.SINGLE && !singleValidation.ok) {
        toast.error(singleValidation.message);
        return;
      }
      if (isInstant && kind === BOOKING_KIND.SINGLE) {
        const instant = canBeInstantBooking(
          {
            date: single.date,
            start_time: single.start,
            end_time: single.end,
            court_id: courtId || null,
            proposed_price: estimate?.price ?? null,
            payment_method: paymentMethod,
          },
          arena,
          existingBookings,
          courtSchedules,
        );
        if (!instant.ok) {
          toast.error(instant.message);
          return;
        }
      }
      if (hasConflict) {
        toast.error('Há conflito com uma reserva já confirmada. Escolha outro horário.');
        return;
      }
      const input = kind === BOOKING_KIND.SINGLE
        ? {
            kind, ...single, court_id: courtId || null, notes,
            is_instant: isInstant,
            payment_method: isInstant ? paymentMethod : null,
            proposed_price: estimate?.price ?? null,
          }
        : { kind, recurring, court_id: courtId || null, notes, proposed_price: estimate?.price ?? null };
      await createBooking.mutateAsync({ arena, input });
      toast.success(
        isInstant
          ? 'Reserva instantânea confirmada! Compareça no horário marcado.'
          : 'Solicitação enviada! A arena vai responder em breve.',
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível solicitar a reserva.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reservar em {arena.name}</DialogTitle>
          <DialogDescription>Escolha um horário avulso ou recorrente. A arena confirma o valor.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            {[
              { k: BOOKING_KIND.SINGLE, label: 'Avulso' },
              { k: BOOKING_KIND.RECURRING, label: 'Recorrente (semanal)' },
            ].map(({ k, label }) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                  kind === k ? 'border-ink bg-ink text-white' : 'border-gray-200 text-gray-500 hover:bg-paper',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {kind === BOOKING_KIND.SINGLE && supportsInstant && (
            <div className="space-y-2">
              <Label className="text-xs">{INSTANT_BOOKING_LABELS.TITLE}</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setIsInstant(false)}
                  className={cn(
                    'rounded-2xl border p-3 text-left transition-colors',
                    !isInstant ? 'border-ink bg-ink text-white' : 'border-gray-200 bg-paper hover:border-gray-300',
                  )}
                >
                  <div className="text-sm font-bold">{INSTANT_BOOKING_LABELS.REQUEST.title}</div>
                  <div className={cn('mt-1 text-xs', !isInstant ? 'text-white/80' : 'text-gray-500')}>
                    {INSTANT_BOOKING_LABELS.REQUEST.description}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setIsInstant(true)}
                  className={cn(
                    'rounded-2xl border p-3 text-left transition-colors',
                    isInstant ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-200 bg-paper hover:border-emerald-300',
                  )}
                >
                  <div className="text-sm font-bold">⚡ {INSTANT_BOOKING_LABELS.INSTANT.title}</div>
                  <div className={cn('mt-1 text-xs', isInstant ? 'text-white/90' : 'text-gray-500')}>
                    {INSTANT_BOOKING_LABELS.INSTANT.description}
                  </div>
                </button>
              </div>
              {isInstant && (
                <div className="space-y-1">
                  <Label className="text-xs">Forma de pagamento</Label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {Object.entries({
                      pix: 'PIX (QR/código)',
                      credit_card: 'Cartão de crédito',
                      debit_card: 'Cartão de débito',
                      cash: 'Dinheiro (na arena)',
                    }).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-400">
                    Pagamento é registrado mas a confirmação na arena é manual (PIX por QR/código ou dinheiro na hora).
                  </p>
                </div>
              )}
            </div>
          )}

          {kind === BOOKING_KIND.SINGLE ? (
            <div className="space-y-2">
              {activeCourts.length > 0 && (
                <div>
                  <Label className="text-xs">Quadra</Label>
                  <select
                    value={courtId}
                    onChange={(e) => setCourtId(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Qualquer uma (sem quadra específica)</option>
                    {activeCourts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-3 sm:col-span-1">
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={single.date} onChange={(e) => setSingle((s) => ({ ...s, date: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Início</Label>
                  <Input type="time" value={single.start} onChange={(e) => setSingle((s) => ({ ...s, start: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Fim</Label>
                  <Input type="time" value={single.end} onChange={(e) => setSingle((s) => ({ ...s, end: e.target.value }))} />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Dia da semana</Label>
                <select
                  value={recurring.weekday}
                  onChange={(e) => setRecurring((s) => ({ ...s, weekday: Number(e.target.value) }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {WEEKDAY_LABELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">A partir de</Label>
                <Input type="date" value={recurring.fromDate} onChange={(e) => setRecurring((s) => ({ ...s, fromDate: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Início</Label>
                <Input type="time" value={recurring.start} onChange={(e) => setRecurring((s) => ({ ...s, start: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input type="time" value={recurring.end} onChange={(e) => setRecurring((s) => ({ ...s, end: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Nº de semanas</Label>
                <Input type="number" min="1" max="52" value={recurring.weeks} onChange={(e) => setRecurring((s) => ({ ...s, weeks: e.target.value }))} />
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs">Observações</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={600}
              placeholder="Alguma preferência de quadra, forma de pagamento, etc."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {candidateSlots.length > 0 && (
            <div className="rounded-[1rem] border border-gray-100 bg-white/75 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Prévia da agenda solicitada</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {candidateSlots.slice(0, 8).map((slot) => (
                  <span key={`${slot.date}_${slot.start}`} className="rounded-full border border-gray-100 bg-paper px-3 py-1 text-xs text-gray-600">
                    {slotLabel(slot)}
                  </span>
                ))}
                {candidateSlots.length > 8 && (
                  <span className="rounded-full border border-gray-100 bg-paper px-3 py-1 text-xs text-gray-600">
                    +{candidateSlots.length - 8} horário(s)
                  </span>
                )}
              </div>
            </div>
          )}

          {hasConflict && (
            <PlatformNotice className="border-amber-300 bg-amber-50/85 text-amber-950">
              Já existe reserva confirmada em conflito com parte dessa solicitação. Ajuste data ou horário antes de continuar.
            </PlatformNotice>
          )}

          {kind === BOOKING_KIND.SINGLE && !singleValidation.ok && singleValidation.message && (
            <PlatformNotice className="border-rose-300 bg-rose-50/85 text-rose-950">
              {singleValidation.message}
            </PlatformNotice>
          )}

          {kind === BOOKING_KIND.SINGLE && dayAvailability && dayAvailability.free.length > 0 && courtId && (
            <div className="rounded-[1rem] border border-emerald-100 bg-emerald-50/60 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Horários livres na data ({dayAvailability.free.length} janela(s) com 60+ min)
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {dayAvailability.free.slice(0, 8).map((slot, i) => (
                  <button
                    type="button"
                    key={`free_${i}`}
                    onClick={() => {
                      // Sugere 1h dentro da primeira janela livre
                      const start = slot.start;
                      const startMin = Number(start.split(':')[0]) * 60 + Number(start.split(':')[1]);
                      const endMin = Math.min(startMin + 60, Number(slot.end.split(':')[0]) * 60 + Number(slot.end.split(':')[1]));
                      const endH = String(Math.floor(endMin / 60)).padStart(2, '0');
                      const endM = String(endMin % 60).padStart(2, '0');
                      setSingle((s) => ({ ...s, start, end: `${endH}:${endM}` }));
                    }}
                    className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    {slot.start}–{slot.end}
                  </button>
                ))}
              </div>
            </div>
          )}

          {upcomingConfirmedSlots.length > 0 && (
            <div className="rounded-[1rem] border border-gray-100 bg-paper p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Próximos horários já confirmados</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {upcomingConfirmedSlots.map((slot) => (
                  <span key={`confirmed_${slot.date}_${slot.start}`} className="rounded-full border border-gray-100 bg-white/75 px-3 py-1 text-xs text-gray-600">
                    {slotLabel(slot)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {estimate && (
            <div className="rounded-lg bg-acid/10 p-3 text-sm text-ink">
              Estimativa: <strong>{formatPrice(estimate.price)}</strong>
              <span className="text-ink/70"> · {estimate.label} (por horário; a arena confirma o valor final)</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createBooking.isPending || hasConflict || candidateSlots.length === 0 || (kind === BOOKING_KIND.SINGLE && !singleValidation.ok)}>
            {createBooking.isPending ? 'Enviando…' : 'Solicitar reserva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
