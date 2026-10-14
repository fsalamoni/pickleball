/**
 * MERCADO no início (card "Mercado", escolhido pela pessoa): o que das COMPRAS
 * dela espera uma ação e as novidades da vitrine (lógica pura).
 *
 * A ação vem de `orderWaitingOn` (a mesma frase da tela do pedido); só entra
 * pedido em que a vez é do comprador — "esperando o vendedor" não pede nada.
 * As novidades nunca mostram o que a própria pessoa vende.
 */
import { ORDER_FINAL_STATUSES } from './constants.js';
import { orderWaitingOn } from './orderStatus.js';
import { publishedMs } from './search.js';

/** Status em que a próxima ação é de quem comprou. */
const VEZ_DO_COMPRADOR = new Set(['accepted', 'shipped', 'ready', 'delivered']);

/**
 * @param {{ orders?: object[], listings?: object[], uid?: string, limit?: number }} p
 * @returns {{ pendentes: Array<{ order: object, texto: string }>, emAndamento: number, novidades: object[] }}
 */
export function marketHomeSummary({ orders = [], listings = [], uid = '', limit = 4 } = {}) {
  const abertos = orders.filter((o) => !ORDER_FINAL_STATUSES.includes(o.status));
  const pendentes = abertos
    .filter((o) => VEZ_DO_COMPRADOR.has(o.status))
    .map((order) => ({ order, texto: orderWaitingOn(order, 'buyer') }));
  const novidades = listings
    .filter((l) => l.status === 'active' && (Number(l.quantity) || 0) > 0 && l.created_by !== uid)
    .sort((a, b) => publishedMs(b) - publishedMs(a))
    .slice(0, limit);
  return { pendentes, emAndamento: abertos.length, novidades };
}
