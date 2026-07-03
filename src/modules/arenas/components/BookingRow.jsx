import React, { useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Repeat, CheckCircle2, XCircle, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  BOOKING_STATUS,
  BOOKING_STATUS_LABELS,
  BOOKING_KIND,
  PAYMENT_STATUS,
  PAYMENT_STATUS_LABELS,
  WEEKDAY_LABELS,
} from '../domain/constants.js';
import { bookingSlots } from '../domain/booking.js';
import { formatPrice } from '../domain/pricing.js';
import {
  useUpdateBookingStatus,
  useProposeBookingPrice,
  useSetBookingPayment,
} from '../hooks/useBookings.js';

const STATUS_STYLE = {
  [BOOKING_STATUS.REQUESTED]: 'bg-amber-100 text-amber-800',
  [BOOKING_STATUS.NEGOTIATING]: 'bg-blue-100 text-blue-800',
  [BOOKING_STATUS.CONFIRMED]: 'bg-green-100 text-green-700',
  [BOOKING_STATUS.DECLINED]: 'bg-red-100 text-red-700',
  [BOOKING_STATUS.CANCELLED]: 'bg-paper text-gray-500',
  [BOOKING_STATUS.COMPLETED]: 'bg-paper text-gray-600',
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

/**
 * @param {{ booking: object, perspective: 'athlete'|'arena' }} props
 */
export default function BookingRow({ booking, perspective }) {
  const isArena = perspective === 'arena';
  const updateStatus = useUpdateBookingStatus();
  const proposePrice = useProposeBookingPrice();
  const setPayment = useSetBookingPayment();
  const [price, setPrice] = useState(booking.proposed_price ?? '');
  const options = { byManager: isArena };

  const active = [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.NEGOTIATING].includes(booking.status);

  async function act(fn, okMsg) {
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível concluir a ação.');
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink">
            {isArena ? booking.athlete_name : booking.arena_name}
          </div>
          <div className="mt-0.5 text-xs text-gray-500"><SlotSummary booking={booking} /></div>
          {booking.notes && <div className="mt-1 text-xs text-gray-500">“{booking.notes}”</div>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge className={STATUS_STYLE[booking.status]}>{BOOKING_STATUS_LABELS[booking.status]}</Badge>
          {booking.payment_status && booking.payment_status !== PAYMENT_STATUS.NONE && (
            <Badge variant="secondary" className="text-[11px]">{PAYMENT_STATUS_LABELS[booking.payment_status]}</Badge>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        {booking.proposed_price != null && <span>Proposto: <strong>{formatPrice(booking.proposed_price)}</strong></span>}
        {booking.agreed_price != null && <span className="text-green-700">Acordado: <strong>{formatPrice(booking.agreed_price)}</strong></span>}
      </div>

      {/* Negociação de valor (ambos podem propor enquanto ativa) */}
      {active && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <label className="text-[11px] text-gray-500">Valor (R$)</label>
            <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="h-9 w-28" />
          </div>
          <Button size="sm" variant="outline" onClick={() => act(() => proposePrice.mutateAsync({ booking, price, options }), 'Proposta enviada.')}>
            <DollarSign className="h-4 w-4" /> Propor
          </Button>
          <Button
            size="sm"
            onClick={() => act(() => updateStatus.mutateAsync({ booking, status: BOOKING_STATUS.CONFIRMED, options: { ...options, agreedPrice: price || booking.proposed_price } }), 'Reserva confirmada.')}
          >
            <CheckCircle2 className="h-4 w-4" /> Confirmar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600"
            onClick={() => act(() => updateStatus.mutateAsync({ booking, status: isArena ? BOOKING_STATUS.DECLINED : BOOKING_STATUS.CANCELLED, options }), isArena ? 'Reserva recusada.' : 'Reserva cancelada.')}
          >
            <XCircle className="h-4 w-4" /> {isArena ? 'Recusar' : 'Cancelar'}
          </Button>
        </div>
      )}

      {/* Pós-confirmação */}
      {booking.status === BOOKING_STATUS.CONFIRMED && (
        <div className="mt-2 flex flex-wrap gap-2">
          {isArena && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => act(() => setPayment.mutateAsync({ booking, paymentStatus: booking.payment_status === PAYMENT_STATUS.PAID ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.PAID }), 'Pagamento atualizado.')}
              >
                {booking.payment_status === PAYMENT_STATUS.PAID ? 'Marcar pendente' : 'Marcar pago'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => act(() => updateStatus.mutateAsync({ booking, status: BOOKING_STATUS.COMPLETED, options }), 'Reserva concluída.')}>
                Concluir
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-red-600"
            onClick={() => act(() => updateStatus.mutateAsync({ booking, status: BOOKING_STATUS.CANCELLED, options }), 'Reserva cancelada.')}
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}
