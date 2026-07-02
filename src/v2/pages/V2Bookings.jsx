import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CalendarClock, Repeat } from 'lucide-react';
import { useMyBookings } from '@/modules/arenas/hooks/useBookings';
import {
  BOOKING_STATUS,
  BOOKING_STATUS_LABELS,
  BOOKING_KIND,
  PAYMENT_STATUS,
  PAYMENT_STATUS_LABELS,
} from '@/modules/arenas/domain/constants';
import { bookingSlots } from '@/modules/arenas/domain/booking';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import {
  V2Badge,
  V2Button,
  V2EmptyState,
  V2PageIntro,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';

const ACTIVE = new Set([BOOKING_STATUS.REQUESTED, BOOKING_STATUS.NEGOTIATING, BOOKING_STATUS.CONFIRMED]);

const STATUS_TONE = {
  [BOOKING_STATUS.REQUESTED]: 'amber',
  [BOOKING_STATUS.NEGOTIATING]: 'blue',
  [BOOKING_STATUS.CONFIRMED]: 'green',
  [BOOKING_STATUS.DECLINED]: 'red',
  [BOOKING_STATUS.CANCELLED]: 'neutral',
  [BOOKING_STATUS.COMPLETED]: 'neutral',
};

function whenLabel(booking) {
  const slots = bookingSlots(booking);
  if (booking.kind === BOOKING_KIND.RECURRING && slots.length > 0) {
    return `${slots.length} horário(s) recorrentes`;
  }
  const s = slots[0];
  return s ? `${s.date} · ${s.start}–${s.end}` : 'Horário a combinar';
}

export default function V2Bookings() {
  const { data: bookings = [], isLoading } = useMyBookings();

  const { active, past } = useMemo(() => {
    const sorter = (a, b) => (whenLabel(a) < whenLabel(b) ? -1 : 1);
    return {
      active: bookings.filter((b) => ACTIVE.has(b.status)).sort(sorter),
      past: bookings.filter((b) => !ACTIVE.has(b.status)).sort(sorter),
    };
  }, [bookings]);

  return (
    <div className="mx-auto max-w-[900px]">
      <V2PageIntro
        title="Minhas reservas"
        subtitle="Acompanhe suas solicitações, valores e pagamentos nas arenas."
        action={<V2Button asChild variant="ghost" size="sm"><Link to="/v2/arenas"><Building2 className="h-4 w-4" /> Ver arenas</Link></V2Button>}
      />

      {isLoading ? (
        <V2Skeleton className="h-48 rounded-4xl" />
      ) : bookings.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={CalendarClock}
            title="Você ainda não solicitou reservas"
            description="Explore as arenas, compare horários e faça seu primeiro pedido de reserva."
            action={<V2Button asChild><Link to="/v2/arenas">Explorar arenas</Link></V2Button>}
          />
        </V2Surface>
      ) : (
        <div className="space-y-8">
          <BookingsGroup title="Ativas" bookings={active} emptyText="Nenhuma reserva ativa." />
          {past.length > 0 && <BookingsGroup title="Histórico" bookings={past} />}
          <V2Surface className="border-dashed bg-paper">
            <p className="text-sm text-gray-500">
              Para negociar valores, confirmar ou marcar pagamentos, abra a gestão completa no app atual.{' '}
              <Link to="/minhas-reservas" className="font-bold text-ink underline">Gerenciar reservas</Link>
            </p>
          </V2Surface>
        </div>
      )}
    </div>
  );
}

function BookingsGroup({ title, bookings, emptyText }) {
  return (
    <div>
      <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">{title}</p>
      {bookings.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const amount = b.agreed_price ?? b.proposed_price;
            return (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-3xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm">
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">{b.arena_name || 'Arena'}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                    {b.kind === BOOKING_KIND.RECURRING ? <Repeat className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
                    {whenLabel(b)}
                  </p>
                  {amount != null && <p className="mt-1 text-xs text-gray-500">Valor: <strong className="text-ink">{formatPrice(amount)}</strong></p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <V2Badge tone={STATUS_TONE[b.status] || 'neutral'}>{BOOKING_STATUS_LABELS[b.status] || b.status}</V2Badge>
                  {b.payment_status && b.payment_status !== PAYMENT_STATUS.NONE && (
                    <span className="text-[11px] text-gray-400">{PAYMENT_STATUS_LABELS[b.payment_status]}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
