import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
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
import { bookingSlots, expandRecurring, isValidSlot, sortSlots, weekdayOf } from '../domain/booking.js';
import { pickAvailableCourtForSlots, unavailableCourtsForSlots } from '../domain/court_assignment.js';
import { useArenaBookings, useCreateBooking } from '../hooks/useBookings.js';
import { useArenaCourts, useArenaCourtSchedules } from '../hooks/useArenas.js';
import { validateBookingRequest, getCourtAvailabilityForDate, checkBookingConflict, BLOCKING_STATUSES } from '../domain/booking_conflict.js';
import { normalizeTime } from '../domain/court_schedule.js';
import { canBeInstantBooking, arenaSupportsInstant, INSTANT_BOOKING_LABELS } from '../domain/instant_booking.js';
import { PAYMENT_METHOD } from '../domain/pdv.js';

function slotLabel(slot) {
  return `${slot.date} · ${slot.start}–${slot.end}`;
}

export default function BookingRequestDialog({ arena, open, onOpenChange, court: initialCourt, preselectedSlots = [], onClose }) {
  // Compat: se open prop não for passado, usar onClose como fallback
  const _open = open !== undefined ? open : true;
  const _onOpenChange = onOpenChange || onClose || (() => {});
  const { user } = useAuth();
  const createBooking = useCreateBooking();
  const { data: existingBookings = [] } = useArenaBookings(arena.id);
  const { data: courts = [] } = useArenaCourts(arena.id);
  const { data: allSchedules = [] } = useArenaCourtSchedules(arena.id);
  const activeCourts = useMemo(() => courts.filter((c) => c.is_active !== false), [courts]);
  // Seleção de quadra: 'any' (a arena atribui uma livre), 'specific' (uma ou
  // mais escolhidas) ou 'all' (todas — cada quadra vira uma reserva).
  const [courtMode, setCourtMode] = useState(initialCourt?.id ? 'specific' : 'any');
  const [selectedCourtIds, setSelectedCourtIds] = useState(initialCourt?.id ? [initialCourt.id] : []);
  const [kind, setKind] = useState(preselectedSlots.length > 0 ? 'multi' : BOOKING_KIND.SINGLE);
  // Se veio do calendário, pode ter múltiplos slots
  const initialMultiSlots = preselectedSlots.length > 0 ? preselectedSlots : [];
  const firstSlot = preselectedSlots[0] || { date: '', start: '18:00', end: '19:00' };
  const [single, setSingle] = useState({ date: firstSlot.date, start: firstSlot.start, end: firstSlot.end });
  const [multiSlots, setMultiSlots] = useState(initialMultiSlots);
  const [recurring, setRecurring] = useState({ weekday: 1, start: '18:00', end: '19:00', weeks: 8, fromDate: '' });
  const [notes, setNotes] = useState('');
  const [isInstant, setIsInstant] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHOD.PIX);

  // Arena permite instant?
  const supportsInstant = arenaSupportsInstant(arena);

  // Reset da seleção quando o dialog reabre.
  React.useEffect(() => {
    if (open) {
      setCourtMode(initialCourt?.id ? 'specific' : 'any');
      setSelectedCourtIds(initialCourt?.id ? [initialCourt.id] : []);
    }
  }, [open, initialCourt?.id]);

  // Quadras-alvo efetivas conforme o modo escolhido. Vazio em 'any' (a arena
  // atribui automaticamente) e quando não há quadras cadastradas.
  const effectiveCourtIds = useMemo(() => {
    if (activeCourts.length === 0) return [];
    if (courtMode === 'all') return activeCourts.map((c) => c.id);
    if (courtMode === 'specific') return selectedCourtIds.filter((id) => activeCourts.some((c) => c.id === id));
    return [];
  }, [courtMode, selectedCourtIds, activeCourts]);
  const isMultiCourt = effectiveCourtIds.length > 1;

  // Schedules relevantes a uma quadra (inclui janelas gerais da arena sem court_id).
  const schedulesForCourt = React.useCallback(
    (cid) => allSchedules.filter((s) => !s.court_id || s.court_id === cid),
    [allSchedules],
  );

  // Validação em tempo real do slot (apenas SINGLE). Em 'any', o conflito é
  // tratado por hasConflict (atribuição automática). Com quadras escolhidas,
  // valida CADA uma (todas precisam estar dentro da janela e livres).
  const singleValidation = useMemo(() => {
    if (kind !== BOOKING_KIND.SINGLE) return { ok: true };
    if (!single.date || !normalizeTime(single.start) || !normalizeTime(single.end)) {
      return { ok: false, reason: 'incomplete', message: 'Preencha data e horários.' };
    }
    if (effectiveCourtIds.length === 0) return { ok: true };
    for (const cid of effectiveCourtIds) {
      const v = validateBookingRequest({
        date: single.date, start_time: single.start, end_time: single.end,
        court_id: cid, existingBookings, court_schedules: schedulesForCourt(cid),
      });
      if (!v.ok) {
        const name = activeCourts.find((c) => c.id === cid)?.name;
        return { ok: false, message: effectiveCourtIds.length > 1 && name ? `${name}: ${v.message}` : v.message };
      }
    }
    return { ok: true };
  }, [kind, single, effectiveCourtIds, schedulesForCourt, existingBookings, activeCourts]);

  // Disponibilidade do dia (apenas SINGLE com data e UMA quadra escolhida)
  const dayAvailability = useMemo(() => {
    if (kind !== BOOKING_KIND.SINGLE || !single.date || effectiveCourtIds.length !== 1) return null;
    return getCourtAvailabilityForDate({
      date: single.date,
      court_schedules: schedulesForCourt(effectiveCourtIds[0]),
      existingBookings,
      duration: 60,
    });
  }, [kind, single.date, effectiveCourtIds, schedulesForCourt, existingBookings]);

  const estimate = useMemo(() => {
    if (kind === BOOKING_KIND.SINGLE) {
      if (!single.date) return null;
      return resolveArenaPrice(arena, { date: single.date, weekday: weekdayOf(single.date), time: single.start, clientId: user?.uid });
    }
    return resolveArenaPrice(arena, { weekday: Number(recurring.weekday), time: recurring.start, clientId: user?.uid });
  }, [kind, single, recurring, arena, user?.uid]);

  const candidateSlots = useMemo(() => {
    if (kind === 'multi' || (multiSlots && multiSlots.length > 0)) {
      return sortSlots(multiSlots);
    }
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
  }, [kind, single, recurring, multiSlots]);

  const confirmedBookings = useMemo(
    () => existingBookings.filter((booking) => booking.status === BOOKING_STATUS.CONFIRMED),
    [existingBookings],
  );

  const upcomingConfirmedSlots = useMemo(
    () => sortSlots(confirmedBookings.flatMap((booking) => bookingSlots(booking))).slice(0, 8),
    [confirmedBookings],
  );

  // Conflito POR-QUADRA:
  //  - quadras escolhidas (específicas/todas): conflito se QUALQUER uma delas
  //    não estiver livre para todos os slots (todas precisam ser reserváveis);
  //  - "qualquer disponível": só há conflito se NENHUMA quadra estiver livre;
  //  - sem quadras cadastradas: cai no conflito por horário.
  const hasConflict = useMemo(() => {
    if (candidateSlots.length === 0) return false;
    if (effectiveCourtIds.length > 0) {
      return unavailableCourtsForSlots(effectiveCourtIds, candidateSlots, existingBookings, allSchedules).length > 0;
    }
    if (activeCourts.length === 0) {
      const cand = candidateSlots.map((s) => ({ ...s, court_id: null }));
      return checkBookingConflict(cand, existingBookings).hasConflict;
    }
    return !pickAvailableCourtForSlots(activeCourts, candidateSlots, existingBookings, allSchedules);
  }, [candidateSlots, effectiveCourtIds, existingBookings, activeCourts, allSchedules]);

  async function handleSubmit() {
    try {
      if (kind === BOOKING_KIND.SINGLE && !singleValidation.ok) {
        toast.error(singleValidation.message);
        return;
      }
      if (courtMode === 'specific' && activeCourts.length > 0 && effectiveCourtIds.length === 0) {
        toast.error('Marque ao menos uma quadra.');
        return;
      }
      const instantEligible = isInstant && !isMultiCourt;
      if (instantEligible && kind === BOOKING_KIND.SINGLE) {
        const instantCourtId = effectiveCourtIds[0] || null;
        const instant = canBeInstantBooking(
          {
            date: single.date,
            start_time: single.start,
            end_time: single.end,
            court_id: instantCourtId,
            proposed_price: estimate?.price ?? null,
            payment_method: paymentMethod,
          },
          arena,
          existingBookings,
          schedulesForCourt(instantCourtId),
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
            kind, ...single, court_ids: effectiveCourtIds, notes,
            is_instant: instantEligible,
            payment_method: instantEligible ? paymentMethod : null,
            proposed_price: estimate?.price ?? null,
          }
        : { kind, recurring, court_ids: effectiveCourtIds, notes, proposed_price: estimate?.price ?? null };
      await createBooking.mutateAsync({ arena, input });
      toast.success(
        isMultiCourt
          ? `Solicitação enviada para ${effectiveCourtIds.length} quadras! A arena vai responder em breve.`
          : instantEligible
            ? 'Reserva instantânea confirmada! Compareça no horário marcado.'
            : 'Solicitação enviada! A arena vai responder em breve.',
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível solicitar a reserva.');
    }
  }

  return (
    <Dialog open={_open} onOpenChange={_onOpenChange}>
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

          {kind === BOOKING_KIND.SINGLE && supportsInstant && !isMultiCourt && (
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
                    isInstant ? 'border-green-500 bg-green-500 text-white' : 'border-gray-200 bg-paper hover:border-green-300',
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

          {activeCourts.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Quadras</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { m: 'any', label: 'Qualquer disponível' },
                  { m: 'specific', label: 'Específicas' },
                  { m: 'all', label: `Todas (${activeCourts.length})` },
                ].map(({ m, label }) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setCourtMode(m); if (m !== 'specific') setSelectedCourtIds([]); }}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      courtMode === m ? 'border-ink bg-ink text-white' : 'border-gray-200 text-gray-500 hover:bg-paper',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {courtMode === 'specific' && (
                <div className="grid grid-cols-2 gap-1.5">
                  {activeCourts.map((c) => {
                    const checked = selectedCourtIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCourtIds((prev) => (checked ? prev.filter((id) => id !== c.id) : [...prev, c.id]))}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                          checked ? 'border-ink bg-ink/5 text-ink' : 'border-gray-200 text-gray-600 hover:bg-paper',
                        )}
                      >
                        <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', checked ? 'border-ink bg-ink text-white' : 'border-gray-300')}>
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                        <span className="truncate">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-gray-400">
                {courtMode === 'all'
                  ? `Reserva as ${activeCourts.length} quadras — uma reserva por quadra.`
                  : courtMode === 'specific'
                    ? (selectedCourtIds.length > 0
                        ? `${selectedCourtIds.length} quadra(s) selecionada(s) — uma reserva por quadra.`
                        : 'Marque uma ou mais quadras.')
                    : 'A arena atribui automaticamente uma quadra livre.'}
              </p>
            </div>
          )}

          {kind === BOOKING_KIND.SINGLE ? (
            <div className="space-y-2">
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

          {kind === BOOKING_KIND.SINGLE && dayAvailability && dayAvailability.free.length > 0 && (
            <div className="rounded-[1rem] border border-green-100 bg-green-50/60 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
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
                    className="rounded-full border border-green-200 bg-white px-3 py-1 text-xs font-semibold text-green-800 hover:bg-green-100"
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
          <Button onClick={handleSubmit} disabled={createBooking.isPending || hasConflict || candidateSlots.length === 0 || (kind === BOOKING_KIND.SINGLE && !singleValidation.ok) || (courtMode === 'specific' && activeCourts.length > 0 && effectiveCourtIds.length === 0)}>
            {createBooking.isPending ? 'Enviando…' : (isMultiCourt ? `Solicitar ${effectiveCourtIds.length} reservas` : 'Solicitar reserva')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
