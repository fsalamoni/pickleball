import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CalendarClock, Repeat } from 'lucide-react';
import { useMyBookings } from '@/modules/arenas/hooks/useBookings';
import { useMyBookingInvites, useMyParticipations } from '@/modules/arenas/hooks/useSharedBookings';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import BookingParticipantsPanel from '@/modules/arenas/components/BookingParticipantsPanel';
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

import V2BookingRow from '@/v2/components/arenas/V2BookingRow';

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
  const sharedOn = useFeatureFlag(FEATURE_FLAG.SHARED_BOOKINGS);
  const { data: myBookings = [], isLoading } = useMyBookings();
  const { data: invites = [] } = useMyBookingInvites();
  const { data: participations = [] } = useMyParticipations();

  // Une as reservas próprias com aquelas em que o usuário é co-proprietário
  // (reservas compartilhadas que ele aceitou), sem duplicar.
  const bookings = useMemo(() => {
    const map = new Map();
    [...myBookings, ...(sharedOn ? participations : [])].forEach((b) => map.set(b.id, b));
    return [...map.values()];
  }, [myBookings, participations, sharedOn]);

  const { active, past } = useMemo(() => {
    const sorter = (a, b) => (whenLabel(a) < whenLabel(b) ? -1 : 1);
    return {
      active: bookings.filter((b) => ACTIVE.has(b.status)).sort(sorter),
      past: bookings.filter((b) => !ACTIVE.has(b.status)).sort(sorter),
    };
  }, [bookings]);

  const pendingInvites = sharedOn ? invites.filter((b) => ACTIVE.has(b.status)) : [];

  return (
    <div className="mx-auto max-w-[900px]">
      <V2PageIntro
        title="Minhas reservas"
        subtitle="Acompanhe suas solicitações, valores e pagamentos nas arenas."
        action={<V2Button asChild variant="ghost" size="sm"><Link to="/arenas"><Building2 className="h-4 w-4" /> Ver arenas</Link></V2Button>}
      />

      {sharedOn && pendingInvites.length > 0 && (
        <div className="mb-8">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-amber-500">Convites de reserva</p>
          <div className="space-y-3">
            {pendingInvites.map((b) => (
              <V2Surface key={b.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-ink">{b.arena_name}</p>
                    <p className="text-xs text-gray-500">{whenLabel(b)}</p>
                  </div>
                </div>
                <BookingParticipantsPanel booking={b} />
              </V2Surface>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <V2Skeleton className="h-48 rounded-4xl" />
      ) : bookings.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={CalendarClock}
            title="Você ainda não solicitou reservas"
            description="Explore as arenas, compare horários e faça seu primeiro pedido de reserva."
            action={<V2Button asChild><Link to="/arenas">Explorar arenas</Link></V2Button>}
          />
        </V2Surface>
      ) : (
        <div className="space-y-8">
          <BookingsGroup title="Ativas" bookings={active} emptyText="Nenhuma reserva ativa." sharedOn={sharedOn} />
          {past.length > 0 && <BookingsGroup title="Histórico" bookings={past} sharedOn={sharedOn} />}
        </div>
      )}
    </div>
  );
}

function BookingsGroup({ title, bookings, emptyText, sharedOn }) {
  return (
    <div>
      <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">{title}</p>
      {bookings.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <div key={b.id}>
              <V2BookingRow booking={b} perspective="athlete" />
              {sharedOn && b.shared && <BookingParticipantsPanel booking={b} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
