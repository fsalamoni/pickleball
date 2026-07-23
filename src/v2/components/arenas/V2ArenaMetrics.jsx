/**
 * V2ArenaMetrics — painel do proprietário (Sprint 2 ARE-08).
 *
 * Tab read-only no /arenas/:id/gerir. Agrega:
 * - Receita (confirmada + pendente)
 * - Reservas (total, conversão, próximas)
 * - Vendas (PDV)
 * - Ocupação (horas reservadas vs disponíveis)
 * - Rating médio
 *
 * Carrega via hooks existentes (useArenaBookings, useArenaSales,
 * useArenaCourtSchedules, useArenaCourts, useArenaReviews).
 * Filtra período no client (mês calendário).
 *
 * Decisões:
 * - Não usa Firestore range query (carrega tudo do mês via hooks já
 *   cacheados). Pra arenas grandes (>1000 reservas), adicionar
 *   query range no service.
 * - Métricas calculadas no client via `calculateArenaMetrics`
 *   (domain puro, testado).
 */

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, Users, Clock, Star, ShoppingBag, Calendar } from 'lucide-react';
import { calculateArenaMetrics, formatPeriodLabel, nowYearMonth } from '@/modules/arenas/domain/arena_metrics';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import { useArenaSales } from '@/modules/arenas/hooks/useArenaV3';
import { useArenaReviews } from '@/modules/arenas/hooks/useArenas';
import { useArenaCourtSchedules, useArenaCourts } from '@/modules/arenas/hooks/useArenas';
import { V2Badge, V2Button, V2Surface } from '@/v2/ui/primitives';
import { formatPrice } from '@/modules/arenas/domain/pricing';

function Stat({ label, value, sub, tone = 'default', icon: Icon }) {
  const toneColors = {
    default: 'text-ink',
    success: 'text-green-700',
    warning: 'text-amber-700',
    info: 'text-blue-700',
    danger: 'text-red-600',
  };
  return (
    <V2Surface className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs text-gray-500">{label}</div>
        {Icon && <Icon className="h-4 w-4 text-gray-400" />}
      </div>
      <div className={`mt-1 font-display text-2xl font-bold ${toneColors[tone]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-400">{sub}</div>}
    </V2Surface>
  );
}

function getNowYearMonth() {
  return nowYearMonth();
}

function prevMonth({ year, month }) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function nextMonth({ year, month }) {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

export default function V2ArenaMetrics({ arena }) {
  const [cursor, setCursor] = useState(() => getNowYearMonth());

  // Carrega tudo via hooks já cacheados
  const { data: bookings = [], isLoading: loadingBookings } = useArenaBookings(arena.id);
  const { data: sales = [], isLoading: loadingSales } = useArenaSales(arena.id);
  const { data: courts = [] } = useArenaCourts(arena.id);
  const { data: reviews = [] } = useArenaReviews(arena.id);
  const { data: schedulesData } = useArenaCourtSchedules(arena.id);
  const schedules = useMemo(() => {
    if (!schedulesData) return [];
    return Array.isArray(schedulesData) ? schedulesData : [];
  }, [schedulesData]);

  // Filtra bookings e sales pelo mês selecionado
  const monthPrefix = `${cursor.year}-${String(cursor.month).padStart(2, '0')}`;
  const bookingsInMonth = useMemo(
    () => bookings.filter((b) => {
      const slots = Array.isArray(b.slots) ? b.slots : (b.date ? [{ date: b.date }] : []);
      return slots.some((s) => s.date?.startsWith(monthPrefix));
    }),
    [bookings, monthPrefix],
  );
  const salesInMonth = useMemo(
    () => sales.filter((s) => {
      const ts = s?.created_at_ms || s?.created_at?.seconds * 1000 || 0;
      if (ts) {
        const d = new Date(ts);
        return d.getFullYear() === cursor.year && d.getMonth() + 1 === cursor.month;
      }
      return false;
    }),
    [sales, cursor.year, cursor.month],
  );

  const metrics = useMemo(() => calculateArenaMetrics({
    bookings: bookingsInMonth,
    sales: salesInMonth,
    reviews,
    schedules,
    courts,
    year: cursor.year,
    month: cursor.month,
  }), [bookingsInMonth, salesInMonth, reviews, schedules, courts, cursor.year, cursor.month]);

  const isLoading = loadingBookings || loadingSales;

  return (
    <V2Surface className="space-y-4 p-4 sm:p-6">
      {/* Header: navegação de mês */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <V2Button variant="ghost" size="sm" onClick={() => setCursor((c) => prevMonth(c))} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </V2Button>
          <h3 className="font-display text-lg font-bold text-ink min-w-[160px] text-center">
            {formatPeriodLabel(cursor.year, cursor.month)}
          </h3>
          <V2Button variant="ghost" size="sm" onClick={() => setCursor((c) => nextMonth(c))} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </V2Button>
        </div>
        <div className="text-xs text-gray-500">
          {isLoading ? 'Carregando…' : `${bookingsInMonth.length} reservas · ${salesInMonth.length} vendas no mês`}
        </div>
      </div>

      {/* Stats principais */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Receita confirmada"
          value={formatPrice(metrics.revenue.confirmed)}
          tone="success"
          icon={TrendingUp}
          sub={metrics.revenue.pending > 0 ? `+ ${formatPrice(metrics.revenue.pending)} pendente` : null}
        />
        <Stat
          label="Reservas"
          value={metrics.bookings.total}
          sub={metrics.bookings.conversion_rate != null ? `${metrics.bookings.conversion_rate}% conversão` : 'sem dados'}
          icon={Calendar}
        />
        <Stat
          label="Ocupação"
          value={metrics.occupancy.rate != null ? `${metrics.occupancy.rate}%` : '—'}
          sub={metrics.occupancy.booked_hours != null ? `${metrics.occupancy.booked_hours}h / ${metrics.occupancy.available_hours}h` : null}
          tone="info"
          icon={Clock}
        />
        <Stat
          label="Rating"
          value={metrics.rating.average != null ? metrics.rating.average.toFixed(1) : '—'}
          sub={metrics.rating.count > 0 ? `${metrics.rating.count} avaliações` : 'sem reviews'}
          tone="warning"
          icon={Star}
        />
      </div>

      {/* Receita por origem */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <V2Surface className="p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <Calendar className="h-4 w-4 text-gray-500" />
            Receita de reservas
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-ink">
            {formatPrice(metrics.revenue_by_source.bookings)}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Soma de agreed_price em bookings CONFIRMED/COMPLETED
          </div>
        </V2Surface>
        <V2Surface className="p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <ShoppingBag className="h-4 w-4 text-gray-500" />
            Receita de vendas (PDV)
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-ink">
            {formatPrice(metrics.revenue_by_source.sales)}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {metrics.sales.paid} de {metrics.sales.total} vendas pagas
          </div>
        </V2Surface>
      </div>

      {/* Status das reservas */}
      <V2Surface className="p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-ink">
          <Users className="h-4 w-4 text-gray-500" />
          Status das reservas no mês
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(metrics.bookings.by_status).map(([status, count]) => (
            <V2Badge key={status} tone={count > 0 ? 'blue' : 'neutral'}>
              {status}: {count}
            </V2Badge>
          ))}
          {Object.keys(metrics.bookings.by_status).length === 0 && (
            <span className="text-sm text-gray-500">Nenhuma reserva no período.</span>
          )}
        </div>
      </V2Surface>

      {/* Próximas reservas */}
      <V2Surface className="p-4">
        <div className="text-sm font-bold text-ink">Próximas reservas confirmadas</div>
        {metrics.bookings.upcoming.length === 0 ? (
          <div className="mt-2 text-sm text-gray-500">Nenhuma reserva futura.</div>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {metrics.bookings.upcoming.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-semibold text-ink">
                    {b.next_date} {b.next_start && `· ${b.next_start}–${b.next_end}`}
                  </div>
                  <div className="text-xs text-gray-500">{b.athlete_name || 'Atleta'}</div>
                </div>
                <div className="text-xs font-semibold text-green-700">
                  {b.agreed_price ? formatPrice(b.agreed_price) : b.proposed_price ? formatPrice(b.proposed_price) : '—'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </V2Surface>
    </V2Surface>
  );
}
