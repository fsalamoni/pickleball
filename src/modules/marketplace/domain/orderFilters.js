/**
 * MERCADO — os filtros de "Minhas compras" (lógica pura): o status do pedido
 * agrupado em cinco situações que a pessoa entende, e a busca por código,
 * título do item e nome do vendedor.
 */
import { normalizeSearchText } from './listing.js';
import { tk } from '@/core/i18n';

export const ORDER_FILTERS = Object.freeze([
  { id: 'vendedor', label: tk('Aguardando o vendedor'), statuses: ['placed'] },
  { id: 'pagamento', label: tk('Aguardando pagamento'), statuses: ['accepted', 'payment_review'] },
  { id: 'caminho', label: tk('A caminho'), statuses: ['paid', 'shipped', 'ready', 'delivered', 'disputed'] },
  { id: 'concluidos', label: tk('Concluídos'), statuses: ['completed'] },
  { id: 'cancelados', label: tk('Cancelados'), statuses: ['cancelled', 'expired'] },
]);

/** O filtro em que o status cai (`null` para status desconhecido). */
export function orderFilterOf(status) {
  return ORDER_FILTERS.find((f) => f.statuses.includes(status))?.id || null;
}

/** Pedidos pelo filtro (`f`, vazio = todos) e pela busca (`q`). */
export function filterOrders(orders, { q = '', f = '' } = {}) {
  const texto = normalizeSearchText(q);
  const filtro = ORDER_FILTERS.find((x) => x.id === f);
  return (orders || []).filter((o) => {
    if (filtro && !filtro.statuses.includes(o.status)) return false;
    if (!texto) return true;
    const campos = [o.code, o.seller_name, ...(o.items || []).map((i) => i.title)];
    return campos.some((c) => normalizeSearchText(c).includes(texto));
  });
}
