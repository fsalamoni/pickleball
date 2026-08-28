import React, { useMemo } from 'react';
import { CalendarRange, DollarSign, Percent, Star, TrendingUp, UserX } from 'lucide-react';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import { useArenaReviews } from '@/modules/arenas/hooks/useArenas';
import { weekSummary, bookingsHeatmap, HEATMAP_HOURS } from '@/modules/arenas/domain/arena_week';
import { V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Painel operacional "como foi minha semana" (flag arena_ops_kpis).
 * Reúne receita, reservas, ocupação, no-show, avaliação e um mapa de calor de
 * horários — tudo derivado das reservas/avaliações que já existem.
 */
export default function V2ArenaWeekPanel({ arenaId }) {
  const { data: bookings = [], isLoading } = useArenaBookings(arenaId);
  const { data: reviews = [] } = useArenaReviews(arenaId);

  const fromISO = useMemo(() => isoDaysAgo(6), []);
  const toISO = useMemo(() => isoDaysAgo(0), []);

  const week = useMemo(() => weekSummary(bookings, { fromISO, toISO }), [bookings, fromISO, toISO]);
  const heat = useMemo(() => bookingsHeatmap(bookings), [bookings]);

  const avgRating = useMemo(() => {
    const rated = reviews.filter((r) => Number(r?.rating) > 0);
    if (rated.length === 0) return null;
    const sum = rated.reduce((a, r) => a + Number(r.rating), 0);
    return Math.round((sum / rated.length) * 10) / 10;
  }, [reviews]);

  if (isLoading) return <V2Skeleton className="mb-8 h-56 rounded-4xl" />;

  return (
    <V2Surface className="mb-8">
      <div className="mb-4 flex items-center gap-2">
        <CalendarRange className="h-5 w-5 text-acid" />
        <h2 className="font-display text-lg font-bold text-ink">Como foi sua semana</h2>
        <span className="text-xs text-gray-400">últimos 7 dias</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={DollarSign} accent="acid" label="Receita confirmada" value={BRL.format(week.revenue)} />
        <Kpi icon={CalendarRange} accent="ink" label="Reservas" value={week.bookings} hint={`${week.confirmed} confirmada(s)`} />
        <Kpi icon={TrendingUp} accent="ink" label="Horas ocupadas" value={`${week.bookedHours}h`} />
        <Kpi icon={UserX} accent="ink" label="No-show" value={week.noShowRate == null ? '—' : `${week.noShowRate}%`} hint={`${week.noShows} falta(s)`} />
        <Kpi icon={Star} accent="acid" label="Avaliação" value={avgRating == null ? '—' : avgRating.toFixed(1)} hint={reviews.length ? `${reviews.length} avaliações` : 'sem avaliações'} />
      </div>

      {/* Mapa de calor de horários (padrão geral das reservas confirmadas) */}
      <div className="mt-6">
        <div className="mb-2 flex items-center gap-2">
          <Percent className="h-4 w-4 text-ink" />
          <h3 className="text-sm font-bold text-ink">Mapa de calor · horários mais cheios</h3>
        </div>
        {heat.max === 0 ? (
          <p className="text-sm text-gray-500">Ainda sem reservas confirmadas para desenhar o mapa.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="flex">
                <div className="w-10 shrink-0" />
                {heat.hours.map((h) => (
                  <div key={h} className="w-7 shrink-0 text-center text-[10px] text-gray-400">{h}h</div>
                ))}
              </div>
              {heat.grid.map((row, dow) => (
                <div key={dow} className="flex items-center">
                  <div className="w-10 shrink-0 text-[11px] font-semibold text-gray-500">{WEEKDAYS[dow]}</div>
                  {row.map((v, col) => {
                    const intensity = heat.max > 0 ? v / heat.max : 0;
                    return (
                      <div key={col} className="p-0.5">
                        <div
                          className={cn('h-6 w-6 rounded-md', v === 0 ? 'bg-paper' : '')}
                          style={v > 0 ? { backgroundColor: `rgba(166, 226, 46, ${0.25 + intensity * 0.75})` } : undefined}
                          title={`${WEEKDAYS[dow]} ${heat.hours[col]}h · ${v} reserva(s)`}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </V2Surface>
  );
}

function Kpi({ icon: Icon, accent = 'ink', label, value, hint }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-paper-pure p-4 shadow-organic-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
        <Icon className={cn('h-4 w-4', accent === 'acid' ? 'text-acid' : 'text-ink')} />
      </div>
      <div className="font-display text-xl font-black text-ink tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-gray-500">{hint}</div>}
    </div>
  );
}
