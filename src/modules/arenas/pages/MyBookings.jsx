import React, { useMemo } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { CalendarClock, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { sortBookings } from '../domain/booking.js';
import { BOOKING_STATUS } from '../domain/constants.js';
import { useMyBookings } from '../hooks/useBookings.js';
import BookingRow from '../components/BookingRow.jsx';

export default function MyBookings() {
  const enabled = useFeatureFlag(FEATURE_FLAG.ARENAS);
  const { data: bookings = [], isLoading } = useMyBookings();

  const grouped = useMemo(() => {
    const active = sortBookings(bookings.filter((b) => [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.NEGOTIATING, BOOKING_STATUS.CONFIRMED].includes(b.status)));
    const past = sortBookings(bookings.filter((b) => [BOOKING_STATUS.DECLINED, BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED].includes(b.status)));
    return { active, past };
  }, [bookings]);

  if (!enabled) return <Navigate to="/inicio" replace />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-slate-600"><CalendarClock className="h-4 w-4 text-emerald-600" /> Suas reservas em arenas.</p>
        <Button asChild size="sm" variant="outline"><Link to="/arenas"><Building2 className="h-4 w-4" /> <span className="ml-1">Ver arenas</span></Link></Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : bookings.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-slate-500">
          Você ainda não solicitou reservas. Explore as <Link to="/arenas" className="text-emerald-700 underline">arenas</Link>.
        </CardContent></Card>
      ) : (
        <>
          <Card><CardContent className="space-y-2 p-4">
            <h3 className="text-sm font-semibold text-slate-800">Ativas</h3>
            {grouped.active.length === 0 ? <p className="text-sm text-slate-500">Nenhuma reserva ativa.</p>
              : grouped.active.map((b) => <BookingRow key={b.id} booking={b} perspective="athlete" />)}
          </CardContent></Card>
          {grouped.past.length > 0 && (
            <Card><CardContent className="space-y-2 p-4">
              <h3 className="text-sm font-semibold text-slate-800">Histórico</h3>
              {grouped.past.map((b) => <BookingRow key={b.id} booking={b} perspective="athlete" />)}
            </CardContent></Card>
          )}
        </>
      )}
    </div>
  );
}
