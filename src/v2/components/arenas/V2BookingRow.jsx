import React, { useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Repeat, CheckCircle2, XCircle, DollarSign, Pencil } from 'lucide-react';
import {
  BOOKING_STATUS,
  BOOKING_STATUS_LABELS,
  BOOKING_KIND,
  PAYMENT_STATUS,
  PAYMENT_STATUS_LABELS,
  WEEKDAY_LABELS,
} from '@/modules/arenas/domain/constants';
import { bookingSlots } from '@/modules/arenas/domain/booking';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import {
  useUpdateBookingStatus,
  useProposeBookingPrice,
  useSetBookingPayment,
} from '@/modules/arenas/hooks/useBookings';
import BookingEditDialog from '@/modules/arenas/components/BookingEditDialog';
import { V2Badge, V2Button } from '@/v2/ui/primitives';

const STATUS_TONE = {
  [BOOKING_STATUS.REQUESTED]: 'amber',
  [BOOKING_STATUS.NEGOTIATING]: 'blue',
  [BOOKING_STATUS.CONFIRMED]: 'green',
  [BOOKING_STATUS.DECLINED]: 'red',
  [BOOKING_STATUS.CANCELLED]: 'neutral',
  [BOOKING_STATUS.COMPLETED]: 'neutral',
};

function SlotSummary({ booking }) {
  const slots = bookingSlots(booking);
  if (booking.kind === BOOKING_KIND.RECURRING && booking.recurrence) {
    return (
      <span className="inline-flex items-center gap-1">
        <Repeat className="h-3.5 w-3.5" />
        {WEEKDAY_LABELS[booking.recurrence.weekday]} {booking.recurrence.start}–{booking.recurrence.end} · {slots.length} semanas
      </span>
    );
  }
  const s = slots[0];
  return (
    <span className="inline-flex items-center gap-1">
      <CalendarClock className="h-3.5 w-3.5" />
      {s ? `${s.date} · ${s.start}–${s.end}` : '—'}
    </span>
  );
}

export default function V2BookingRow({ booking, perspective }) {
  const isArena = perspective === 'arena';
  const updateStatus = useUpdateBookingStatus();
  const proposePrice = useProposeBookingPrice();
  const setPayment = useSetBookingPayment();
  const [price, setPrice] = useState(booking.proposed_price ?? '');
  const [editing, setEditing] = useState(false);
  const options = { byManager: isArena };

  const active = [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.NEGOTIATING].includes(booking.status);
  // Reserva avulsa e ainda alterável → pode editar quadra/horário.
  const editable = booking.kind !== BOOKING_KIND.RECURRING
    && [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.NEGOTIATING, BOOKING_STATUS.CONFIRMED].includes(booking.status);

  async function act(fn, okMsg) {
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível concluir a ação.');
    }
  }

  const handlePropose = () => {
    act(() => proposePrice.mutateAsync({ booking, price, options }), 'Proposta enviada.');
  };

  const handleConfirm = () => {
    const agreedPrice = price || booking.proposed_price;
    act(() => updateStatus.mutateAsync({ booking, status: BOOKING_STATUS.CONFIRMED, options: { ...options, agreedPrice } }), 'Reserva confirmada.');
  };

  const handleDecline = () => {
    act(() => updateStatus.mutateAsync({ booking, status: isArena ? BOOKING_STATUS.DECLINED : BOOKING_STATUS.CANCELLED, options }), isArena ? 'Reserva recusada.' : 'Reserva cancelada.');
  };

  const handlePayment = () => {
    const paymentStatus = booking.payment_status === PAYMENT_STATUS.PAID ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.PAID;
    act(() => setPayment.mutateAsync({ booking, paymentStatus }), 'Pagamento atualizado.');
  };

  const handleComplete = () => {
    act(() => updateStatus.mutateAsync({ booking, status: BOOKING_STATUS.COMPLETED, options }), 'Reserva concluída.');
  };

  const handleCancelConfirmed = () => {
    act(() => updateStatus.mutateAsync({ booking, status: BOOKING_STATUS.CANCELLED, options }), 'Reserva cancelada.');
  };

  return (
    <div className="rounded-4xl border border-gray-100 bg-paper-pure p-4 shadow-organic-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-base font-bold text-ink">
            {isArena ? booking.athlete_name : booking.arena_name}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            <SlotSummary booking={booking} />
          </div>
          {booking.notes && <div className="mt-1.5 text-sm text-gray-500">“{booking.notes}”</div>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <V2Badge tone={STATUS_TONE[booking.status] || 'neutral'}>
            {BOOKING_STATUS_LABELS[booking.status]}
          </V2Badge>
          {booking.payment_status && booking.payment_status !== PAYMENT_STATUS.NONE && (
            <V2Badge tone="neutral" className="text-[10px]">
              {PAYMENT_STATUS_LABELS[booking.payment_status]}
            </V2Badge>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-600">
        {booking.proposed_price != null && (
          <span>Proposto: <strong className="text-ink">{formatPrice(booking.proposed_price)}</strong></span>
        )}
        {booking.agreed_price != null && (
          <span className="text-green-700">Acordado: <strong>{formatPrice(booking.agreed_price)}</strong></span>
        )}
      </div>

      {active && (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-4">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-gray-400">Valor (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="h-10 w-28 rounded-2xl border border-gray-200 bg-paper px-3 text-sm text-ink outline-none placeholder:text-gray-400 focus-visible:ring-4 focus-visible:ring-acid/30"
            />
          </div>
          <V2Button size="sm" variant="ghost" onClick={handlePropose}>
            <DollarSign className="h-4 w-4" /> Propor
          </V2Button>
          <V2Button size="sm" onClick={handleConfirm}>
            <CheckCircle2 className="h-4 w-4" /> Confirmar
          </V2Button>
          {editable && (
            <V2Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Alterar
            </V2Button>
          )}
          <V2Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={handleDecline}>
            <XCircle className="h-4 w-4" /> {isArena ? 'Recusar' : 'Cancelar'}
          </V2Button>
        </div>
      )}

      {booking.status === BOOKING_STATUS.CONFIRMED && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          {isArena && (
            <>
              <V2Button size="sm" variant="ghost" onClick={handlePayment}>
                {booking.payment_status === PAYMENT_STATUS.PAID ? 'Marcar pendente' : 'Marcar pago'}
              </V2Button>
              <V2Button size="sm" variant="ghost" onClick={handleComplete}>
                Concluir
              </V2Button>
            </>
          )}
          {editable && (
            <V2Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Alterar
            </V2Button>
          )}
          <V2Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={handleCancelConfirmed}>
            Cancelar
          </V2Button>
        </div>
      )}

      {editing && (
        <BookingEditDialog booking={booking} open={editing} onOpenChange={setEditing} byManager={isArena} />
      )}
    </div>
  );
}
