/**
 * MERCADO — os números do painel do admin, a partir dos pedidos (lógica pura).
 * Valor movimentado só conta o que CONCLUIU: pedido cancelado não vendeu.
 */
import { ORDER_FINAL_STATUSES } from './constants.js';
import { couponLive } from './promotions.js';

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

/**
 * Cupons e vales do Mercado inteiro, para o admin. O saldo EM ABERTO dos vales
 * é o que as lojas ainda devem em mercadoria: só vale ativo, não vencido, com
 * saldo. O vencido com saldo é contado à parte (é o que alguém perdeu).
 */
export function promoOverview(coupons = [], giftCards = [], { now = Date.now() } = {}) {
  const vivo = (c) => couponLive(c, now);
  const ativos = coupons.filter(vivo);
  const saldo = (g) => Number(g.balance_cents) || 0;
  const valendo = giftCards.filter((g) => g.status === 'active' && saldo(g) > 0 && !(Number(g.expires_at_ms) && now > Number(g.expires_at_ms)));
  const vencidos = giftCards.filter((g) => g.status === 'active' && saldo(g) > 0 && Number(g.expires_at_ms) && now > Number(g.expires_at_ms));
  const porLoja = new Map();
  valendo.forEach((g) => {
    const k = g.seller_key || '';
    const a = porLoja.get(k) || { seller_key: k, seller_name: g.seller_name || '', count: 0, balance_cents: 0 };
    a.count += 1;
    a.balance_cents += saldo(g);
    porLoja.set(k, a);
  });
  return {
    couponsActive: ativos.length,
    couponUses: coupons.reduce((t, c) => t + (Number(c.uses_count) || 0), 0),
    topCoupons: [...coupons].sort((a, b) => (Number(b.uses_count) || 0) - (Number(a.uses_count) || 0)),
    isLive: vivo,
    giftCardsActive: valendo.length,
    openBalanceCents: valendo.reduce((t, g) => t + saldo(g), 0),
    expiredBalanceCents: vencidos.reduce((t, g) => t + saldo(g), 0),
    giftCardsByStore: [...porLoja.values()].sort((a, b) => b.balance_cents - a.balance_cents),
  };
}
