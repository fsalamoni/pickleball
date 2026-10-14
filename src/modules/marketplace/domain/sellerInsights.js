/**
 * MERCADO — os números de quem vende (lógica pura): o desempenho dos últimos
 * dias e a planilha das vendas. Tudo sai dos pedidos já lidos pela aba de
 * vendas — nada gravado, nada a mais lido.
 */
import { ORDER_STATUS_LABELS } from './constants.js';

const DIA = 86400000;
const VENDIDO = ['paid', 'shipped', 'ready', 'delivered', 'completed'];
const PERDIDO = ['cancelled', 'expired'];

/**
 * @param {object[]} orders os pedidos do vendedor
 * @param {{ now?: number, days?: number }} [o]
 */
export function sellerMetrics(orders = [], { now = Date.now(), days = 30 } = {}) {
  const desde = now - days * DIA;
  const janela = orders.filter((o) => (Number(o.placed_at_ms) || 0) >= desde);
  const vendidos = janela.filter((o) => VENDIDO.includes(o.status));
  const perdidos = janela.filter((o) => PERDIDO.includes(o.status));
  const decididos = vendidos.length + perdidos.length;
  const receita = vendidos.reduce((n, o) => n + (Number(o.total_cents) || 0) + (Number(o.gift_card_cents) || 0), 0);
  return {
    days,
    orders: janela.length,
    sold: vendidos.length,
    lost: perdidos.length,
    revenue_cents: receita,
    // Ticket = o que a venda valeu (o vale-presente usado também é venda da loja).
    avg_ticket_cents: vendidos.length ? Math.round(receita / vendidos.length) : 0,
    // `null` = ainda nada decidido: a tela diz "—", nunca 0%.
    completion_rate: decididos ? vendidos.length / decididos : null,
    coupon_discount_cents: vendidos.reduce((n, o) => n + (Number(o.discount_cents) || 0) + (Number(o.shipping_discount_cents) || 0), 0),
    gift_cards_sold_cents: vendidos.filter((o) => o.source === 'gift_card').reduce((n, o) => n + (Number(o.total_cents) || 0), 0),
  };
}

/** Os anúncios que mais venderam na janela: `[{ title, quantity, revenue_cents }]`. */
export function topSellingItems(orders = [], { now = Date.now(), days = 30, limit = 5 } = {}) {
  const desde = now - days * DIA;
  const porItem = new Map();
  orders.filter((o) => VENDIDO.includes(o.status) && (Number(o.placed_at_ms) || 0) >= desde).forEach((o) => {
    (o.items || []).forEach((i) => {
      const k = i.listing_id || i.title;
      const x = porItem.get(k) || { title: i.title, quantity: 0, revenue_cents: 0 };
      x.quantity += Number(i.quantity) || 0;
      x.revenue_cents += (Number(i.unit_price_cents) || 0) * (Number(i.quantity) || 0);
      porItem.set(k, x);
    });
  });
  return [...porItem.values()].sort((a, b) => b.revenue_cents - a.revenue_cents).slice(0, limit);
}

const reais = (c) => ((Number(c) || 0) / 100).toFixed(2).replace('.', ',');
const celula = (v) => {
  const s = String(v ?? '');
  // Contra fórmula injetada na planilha (=, +, -, @ no começo).
  const seguro = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[";\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
};
const dataBR = (ms) => {
  if (!ms) return '';
  const d = new Date(Number(ms) - 3 * 3600000);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
};

/** A planilha das vendas (CSV com `;`, que o Excel em português abre direto). */
export function salesCsv(orders = []) {
  const cab = ['Pedido', 'Data', 'Situação', 'Comprador', 'Itens', 'Unidades', 'Produtos (R$)', 'Frete (R$)', 'Cupom', 'Desconto (R$)', 'Vale-presente (R$)', 'Total pago (R$)', 'Entrega'];
  const linhas = [...orders]
    .sort((a, b) => (Number(b.placed_at_ms) || 0) - (Number(a.placed_at_ms) || 0))
    .map((o) => [
      o.code, dataBR(o.placed_at_ms), ORDER_STATUS_LABELS[o.status] || o.status, o.buyer_name,
      (o.items || []).map((i) => `${i.quantity}× ${i.title}`).join(' | '),
      (o.items || []).reduce((n, i) => n + (Number(i.quantity) || 0), 0),
      reais(o.subtotal_cents), reais(o.shipping_cents), o.coupon?.code || '',
      reais((Number(o.discount_cents) || 0) + (Number(o.shipping_discount_cents) || 0)), reais(o.gift_card_cents), reais(o.total_cents),
      o.fulfillment || '',
    ].map(celula).join(';'));
  return `\uFEFF${[cab.join(';'), ...linhas].join('\n')}`;
}
