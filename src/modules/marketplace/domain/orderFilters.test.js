import { describe, it, expect } from 'vitest';
import { ORDER_FILTERS, filterOrders, orderFilterOf } from './orderFilters.js';
import { ORDER_STATUS } from './constants.js';

const O = [
  { id: '1', status: 'placed', code: 'PR-AB12', seller_name: 'Loja Azul', items: [{ title: 'Raquete JOOLA' }] },
  { id: '2', status: 'accepted', code: 'PR-CD34', seller_name: 'Arena Sul', items: [{ title: 'Bolas' }] },
  { id: '3', status: 'shipped', code: 'PR-EF56', seller_name: 'Loja Azul', items: [{ title: 'Tênis' }] },
  { id: '4', status: 'completed', code: 'PR-GH78', seller_name: 'Ana', items: [] },
  { id: '5', status: 'expired', code: 'PR-IJ90', seller_name: 'Ana', items: [{ title: 'Camiseta' }] },
];

describe('filtros de Minhas compras', () => {
  it('todo status do pedido cai em um filtro', () => {
    Object.values(ORDER_STATUS).forEach((s) => expect(orderFilterOf(s), s).not.toBeNull());
    expect(orderFilterOf('zzz')).toBeNull();
    expect(ORDER_FILTERS.map((f) => f.id)).toEqual(['vendedor', 'pagamento', 'caminho', 'concluidos', 'cancelados']);
  });
  it('filtra por situação e busca por código, título e vendedor', () => {
    const ids = (o) => filterOrders(O, o).map((x) => x.id);
    expect(ids({})).toEqual(['1', '2', '3', '4', '5']);
    expect(ids({ f: 'caminho' })).toEqual(['3']);
    expect(ids({ f: 'cancelados' })).toEqual(['5']);
    expect(ids({ f: 'nada' })).toEqual(['1', '2', '3', '4', '5']);
    expect(ids({ q: 'loja azul' })).toEqual(['1', '3']);
    expect(ids({ q: 'ef56' })).toEqual(['3']);
    expect(ids({ q: 'tenis' })).toEqual(['3']);
    expect(ids({ q: 'joola', f: 'vendedor' })).toEqual(['1']);
    expect(ids({ q: 'joola', f: 'caminho' })).toEqual([]);
  });
});
