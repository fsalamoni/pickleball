/**
 * MERCADO — os números do painel do admin, a partir dos pedidos (lógica pura).
 * Valor movimentado só conta o que CONCLUIU: pedido cancelado não vendeu.
 */
import { ORDER_FINAL_STATUSES } from './constants.js';

const DIA = 86400000;

/**
 * @param {Array<{status: string, total_cents?: number, placed_at_ms?: number}>} orders
 * @param {{ now?: number, days?: number }} [opts]
 */
export function marketMetrics(orders = [], { now = Date.now(), days = 30 } = {}) {
  const desde = now - days * DIA;
  const concluidos = orders.filter((o) => o.status === 'completed');
  const perdidos = orders.filter((o) => o.status === 'cancelled' || o.status === 'expired');
  const soma = (xs) => xs.reduce((t, o) => t + (Number(o.total_cents) || 0), 0);
  const recentes = concluidos.filter((o) => (o.placed_at_ms || 0) >= desde);
  const decididos = concluidos.length + perdidos.length;
  return {
    total: orders.length,
    completedCount: concluidos.length,
    completedCents: soma(concluidos),
    recentCompletedCents: soma(recentes),
    recentCompletedCount: recentes.length,
    activeCount: orders.filter((o) => !ORDER_FINAL_STATUSES.includes(o.status) && o.status !== 'disputed').length,
    disputedCount: orders.filter((o) => o.status === 'disputed').length,
    lostCount: perdidos.length,
    completionRate: decididos ? concluidos.length / decididos : null,
    avgTicketCents: concluidos.length ? Math.round(soma(concluidos) / concluidos.length) : null,
  };
}
