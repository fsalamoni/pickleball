import React, { useMemo } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { CalendarClock, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PlatformSectionHeader, PlatformSurfaceCard } from '@/components/ui/platform-page';
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
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <Card className="bg-ink text-white overflow-hidden rounded-[1.25rem] border-0 sm:rounded-[2rem]">
          <CardContent className="p-5 sm:p-8 lg:p-10">
            <PlatformSectionHeader
              eyebrow="Reservas"
              title="Acompanhe suas negociações e confirmações com as arenas."
              description="Tudo o que você pediu para reservar fica visível aqui, com status, histórico e andamento do pagamento."
              titleClassName="mt-4 text-3xl leading-tight text-white sm:text-4xl"
              descriptionClassName="mt-3 text-sm leading-7 text-white/70 sm:text-base"
            />
          </CardContent>
        </Card>

        <PlatformSurfaceCard>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Ação rápida</div>
              <div className="mt-2 text-lg font-semibold text-ink">Voltar ao catálogo de arenas</div>
            </div>
            <Button asChild size="sm" variant="outline"><Link to="/arenas"><Building2 className="h-4 w-4" /> <span className="ml-1">Ver arenas</span></Link></Button>
          </div>
        </PlatformSurfaceCard>
      </section>

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : bookings.length === 0 ? (
        <PlatformSurfaceCard contentClassName="p-2">
          <EmptyState
            icon={CalendarClock}
            title="Você ainda não solicitou reservas"
            description="Explore as arenas, compare horários e faça seu primeiro pedido de reserva quando encontrar a melhor opção."
            action={<Button asChild><Link to="/arenas">Explorar arenas</Link></Button>}
          />
        </PlatformSurfaceCard>
      ) : (
        <>
          <PlatformSurfaceCard contentClassName="space-y-2 p-4">
            <h3 className="text-sm font-semibold text-ink">Ativas</h3>
            {grouped.active.length === 0 ? <p className="text-sm text-gray-500">Nenhuma reserva ativa.</p>
              : grouped.active.map((b) => <BookingRow key={b.id} booking={b} perspective="athlete" />)}
          </PlatformSurfaceCard>
          {grouped.past.length > 0 && (
            <PlatformSurfaceCard contentClassName="space-y-2 p-4">
              <h3 className="text-sm font-semibold text-ink">Histórico</h3>
              {grouped.past.map((b) => <BookingRow key={b.id} booking={b} perspective="athlete" />)}
            </PlatformSurfaceCard>
          )}
        </>
      )}
    </div>
  );
}
