/**
 * Domínio puro de métricas de arena.
 *
 * Sprint 2 (ARE-08) do roadmap arena — `docs/arena-roadmap.md`.
 *
 * Agrega dados de bookings, vendas PDV e reviews num resumo executivo
 * pro dono da arena. Sem I/O — recebe os dados e retorna o agregado.
 *
 * Métricas calculadas:
 * - Receita confirmada: soma de `agreed_price` em bookings CONFIRMED + total
 *   de sales PAID. Tudo em reais (number).
 * - Receita pendente: soma de `proposed_price` em bookings REQUESTED/NEGOTIATING.
 * - Total de reservas: contagem por status.
 * - Taxa de conversão: CONFIRMED / (CONFIRMED + CANCELLED + DECLINED).
 * - Ocupação: soma de horas reservadas em CONFIRMED / horas disponíveis
 *   (calculado a partir de schedules × duração do mês).
 * - Rating médio: aggregateRatings das reviews.
 * - Receita por origem: bookings vs vendas.
 * - Próximas reservas: lista das próximas N reservas CONFIRMED.
 *
 * Decisões:
 * - Funções puras: recebem arrays como input, retornam agregado.
 *   Hook coleta via React Query e passa pra cá.
 * - Período é 'YYYY-MM' (mês calendário), com 'current' = mês atual.
 * - Todas as somas usam `num()` defensivo (null/undefined = 0).
 */

import { BOOKING_STATUS } from './constants.js';
import { SALE_STATUS } from './pdv.js';
import { timeToMinutes, normalizeWeekdays } from './court_schedule.js';
import { weekdayOf } from './calendar.js';

/** Converte valor em número seguro (null/undefined/NaN → 0). */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Soma defensiva de campos opcionais. */
function sumBy(arr, field) {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((acc, item) => acc + num(item?.[field]), 0);
}

/** Contagem por status. */
function countByStatus(bookings = []) {
  const out = {};
  for (const b of bookings) {
    if (!b?.status) continue;
    out[b.status] = (out[b.status] || 0) + 1;
  }
  return out;
}

/** Receita confirmada: bookings CONFIRMED + sales PAID. */
function calculateConfirmedRevenue(bookings = [], sales = []) {
  const fromBookings = sumBy(
    bookings.filter((b) => b?.status === BOOKING_STATUS.CONFIRMED),
    'agreed_price',
  );
  // Se agreed_price for 0 mas proposed_price existir, usa proposed_price
  // (fluxo de "instantâneo" onde user paga o preço sugerido)
  const proposedFromBookings = sumBy(
    bookings.filter((b) => b?.status === BOOKING_STATUS.CONFIRMED && (!b.agreed_price || b.agreed_price === 0)),
    'proposed_price',
  );
  const fromSales = sumBy(
    sales.filter((s) => s?.status === SALE_STATUS.PAID),
    'total',
  );
  return fromBookings + proposedFromBookings + fromSales;
}

/** Receita pendente: bookings REQUESTED/NEGOTIATING. */
function calculatePendingRevenue(bookings = []) {
  return sumBy(
    bookings.filter((b) => [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.NEGOTIATING].includes(b?.status)),
    'proposed_price',
  );
}

/** Taxa de conversão (% de reservas finalizadas com sucesso). */
function calculateConversionRate(bookings = []) {
  const decided = bookings.filter((b) =>
    [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.DECLINED, BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED].includes(b?.status),
  );
  if (decided.length === 0) return null;
  const confirmed = decided.filter((b) => b.status === BOOKING_STATUS.CONFIRMED || b.status === BOOKING_STATUS.COMPLETED).length;
  return Math.round((confirmed / decided.length) * 1000) / 10; // % com 1 casa decimal
}

/** Calcula horas reservadas em bookings CONFIRMED. */
function calculateBookedHours(bookings = []) {
  let totalMin = 0;
  for (const b of bookings) {
    if (b?.status !== BOOKING_STATUS.CONFIRMED && b?.status !== BOOKING_STATUS.COMPLETED) continue;
    const slots = Array.isArray(b.slots) ? b.slots : (
      b.date && b.start && b.end ? [{ date: b.date, start: b.start, end: b.end }] : []
    );
    for (const s of slots) {
      const sM = timeToMinutes(s.start);
      const eM = timeToMinutes(s.end);
      if (sM != null && eM != null && eM > sM) totalMin += eM - sM;
    }
  }
  return Math.round(totalMin / 60 * 10) / 10; // horas com 1 casa decimal
}

/** Calcula horas disponíveis (soma de janelas de schedule que cobrem o mês). */
function calculateAvailableHours(schedules = [], year, month) {
  if (!year || !month) return 0;
  // Pega todos os dias do mês
  const daysInMonth = new Date(year, month, 0).getDate();
  let totalMin = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dateISO = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dow = weekdayOf(dateISO);
    if (dow == null) continue;
    for (const s of schedules) {
      if (s?.is_active === false) continue;
      const wd = normalizeWeekdays(s.weekdays);
      if (!wd || !wd.includes(dow)) continue;
      const sM = timeToMinutes(s.start_time);
      const eM = timeToMinutes(s.end_time);
      if (sM != null && eM != null && eM > sM) totalMin += eM - sM;
    }
  }
  return Math.round(totalMin / 60 * 10) / 10;
}

/** Calcula taxa de ocupação (% de horas reservadas / disponíveis). */
function calculateOccupancyRate(bookings = [], schedules = [], year, month) {
  const booked = calculateBookedHours(bookings);
  const available = calculateAvailableHours(schedules, year, month);
  if (available === 0) return null;
  return Math.min(100, Math.round((booked / available) * 1000) / 10);
}

/** Distribuição de receita por origem. */
function revenueBySource(bookings = [], sales = []) {
  const bookingsRevenue = sumBy(
    bookings.filter((b) => b?.status === BOOKING_STATUS.CONFIRMED || b?.status === BOOKING_STATUS.COMPLETED),
    'agreed_price',
  );
  const salesRevenue = sumBy(
    sales.filter((s) => s?.status === SALE_STATUS.PAID),
    'total',
  );
  return {
    bookings: bookingsRevenue,
    sales: salesRevenue,
    total: bookingsRevenue + salesRevenue,
  };
}

/** Próximas N reservas (futuras, CONFIRMED, ordenadas por data). */
function upcomingBookings(bookings = [], limit = 5) {
  const today = new Date().toISOString().slice(0, 10);
  return bookings
    .filter((b) => b?.status === BOOKING_STATUS.CONFIRMED)
    .filter((b) => {
      const slots = Array.isArray(b.slots) ? b.slots : (b.date ? [{ date: b.date }] : []);
      return slots.some((s) => s.date >= today);
    })
    .map((b) => {
      const slots = Array.isArray(b.slots) ? b.slots : (b.date ? [{ date: b.date }] : []);
      const first = slots.find((s) => s.date >= today);
      return { ...b, next_date: first?.date, next_start: first?.start, next_end: first?.end };
    })
    .sort((a, b) => String(a.next_date).localeCompare(String(b.next_date)))
    .slice(0, limit);
}

/** Aggregate principal — retorna objeto pronto pra UI. */
export function calculateArenaMetrics({
  bookings = [],
  sales = [],
  reviews = [],
  schedules = [],
  courts = [],
  year,
  month,
  upcomingLimit = 5,
} = {}) {
  const byStatus = countByStatus(bookings);
  const confirmedRevenue = calculateConfirmedRevenue(bookings, sales);
  const pendingRevenue = calculatePendingRevenue(bookings);
  const conversionRate = calculateConversionRate(bookings);
  const bookedHours = calculateBookedHours(bookings);
  const availableHours = calculateAvailableHours(schedules, year, month);
  const occupancyRate = calculateOccupancyRate(bookings, schedules, year, month);
  const by_source = revenueBySource(bookings, sales);
  const upcoming = upcomingBookings(bookings, upcomingLimit);

  // Rating (reusa padrão se reviews tem rating)
  const ratingSum = reviews.reduce((acc, r) => acc + num(r?.rating), 0);
  const ratingCount = reviews.filter((r) => num(r?.rating) > 0).length;
  const avgRating = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null;

  return {
    revenue: {
      confirmed: confirmedRevenue,
      pending: pendingRevenue,
      total_potential: confirmedRevenue + pendingRevenue,
    },
    bookings: {
      total: bookings.length,
      by_status: byStatus,
      conversion_rate: conversionRate,
      upcoming: upcoming,
    },
    sales: {
      total: sales.length,
      paid: sales.filter((s) => s?.status === SALE_STATUS.PAID).length,
      revenue: by_source.sales,
    },
    occupancy: {
      booked_hours: bookedHours,
      available_hours: availableHours,
      rate: occupancyRate,
    },
    courts: {
      total: courts.length,
      active: courts.filter((c) => c?.is_active !== false).length,
    },
    revenue_by_source: by_source,
    rating: {
      average: avgRating,
      count: ratingCount,
    },
    period: { year, month },
  };
}

/** Formata mês/ano em pt-BR (ex: 'Agosto 2026'). */
const MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
export function formatPeriodLabel(year, month) {
  if (!year || !month) return 'Período';
  return `${MONTH_LABELS[month - 1] || ''} ${year}`;
}

/** Mês/ano atual. */
export function nowYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}
