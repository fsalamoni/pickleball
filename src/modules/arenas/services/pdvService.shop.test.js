/**
 * A loja do app vendendo os produtos do MERCADO — o serviço, contra um banco
 * em memória.
 *
 * O que protege:
 *  1. ⭐ o pedido é precificado pelo BANCO (o preço da tela é ignorado) e só
 *     com produtos DESTA arena;
 *  2. ⭐ a arena é avisada do pedido — com uids, não documentos de gestor;
 *  3. ⭐ a entrega vira SAÍDA do Mercado e acerta a cópia do estoque; dois
 *     cliques não baixam duas vezes; estoque controlado insuficiente recusa;
 *  4. ⭐ o cancelamento apaga só as saídas DAQUELE pedido (pelo `sale_id`
 *     gravado nelas), cancela os pagamentos em aberto e avisa quem pediu;
 *  5. ⭐ a conta dividida só fecha como paga quando TODOS pagaram;
 *  6. quem pediu desiste — mas não de conta dividida nem de pedido entregue.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const banco = new Map();
let seq = 0;

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('@/core/services/notificationService', () => ({
  notifyUsers: vi.fn(() => Promise.resolve()), NOTIFICATION_TYPE: { GENERIC: 'generic' },
}));

const doColecao = (col) => [...banco.entries()]
  .filter(([k]) => k.startsWith(`${col}/`))
  .map(([k, v]) => ({ id: k.split('/')[1], ...v }));

vi.mock('./arenaService.js', () => ({
  listInventoryProducts: async (arenaId) => doColecao('arena_inventory_products').filter((p) => p.arena_id === arenaId),
  listInventoryEntries: async (arenaId) => doColecao('arena_inventory_entries').filter((p) => p.arena_id === arenaId),
  listInventoryExits: async (arenaId) => doColecao('arena_inventory_exits').filter((p) => p.arena_id === arenaId),
  listArenaManagerIds: async () => ['gestor'],
}));

function aplicar(path, data, merge) {
  const atual = banco.get(path) || {};
  const novo = merge ? { ...atual } : {};
  Object.entries(data).forEach(([k, v]) => { novo[k] = v?._inc ? (Number(atual[k]) || 0) + v._inc : v; });
  banco.set(path, novo);
}

vi.mock('firebase/firestore', () => {
  const snap = (path) => ({
    id: path.split('/').pop(), ref: { _path: path },
    exists: () => banco.has(path), data: () => banco.get(path),
  });
  return {
    collection: (_db, nome) => ({ _col: nome }),
    doc: (a, b, c) => {
      if (a?._col) return { _path: `${a._col}/auto${++seq}`, id: `auto${seq}` };
      const col = b?._col || b;
      return { _path: `${col}/${c}`, id: c };
    },
    getDoc: async (ref) => snap(ref._path),
    getDocs: async (q) => {
      const [{ _col }, ...filtros] = q;
      const docs = doColecao(_col).filter((d) => filtros.every(([campo, op, valor]) => (
        op === 'array-contains' ? (d[campo] || []).includes(valor) : d[campo] === valor
      )));
      return { docs: docs.map((d) => snap(`${_col}/${d.id}`)) };
    },
    query: (col, ...filtros) => [col, ...filtros],
    where: (campo, op, valor) => [campo, op, valor],
    setDoc: async (ref, data, opts) => aplicar(ref._path, data, opts?.merge),
    updateDoc: async (ref, data) => aplicar(ref._path, data, true),
    writeBatch: () => {
      const ops = [];
      return {
        set: (ref, data) => ops.push(() => aplicar(ref._path, data, false)),
        update: (ref, data) => ops.push(() => aplicar(ref._path, data, true)),
        delete: (ref) => ops.push(() => banco.delete(ref._path)),
        commit: async () => ops.forEach((f) => f()),
      };
    },
    runTransaction: async (_db, fn) => {
      const ops = [];
      await fn({
        get: async (ref) => snap(ref._path),
        set: (ref, data) => ops.push(() => aplicar(ref._path, data, false)),
        update: (ref, data) => ops.push(() => aplicar(ref._path, data, true)),
      });
      ops.forEach((f) => f());
    },
    serverTimestamp: () => 'agora',
    increment: (n) => ({ _inc: n }),
  };
});

const svc = await import('./pdvService.js');
const { notifyUsers } = await import('@/core/services/notificationService');

const ANA = { uid: 'ana', displayName: 'Ana' };
const GESTOR = { uid: 'gestor' };

beforeEach(() => {
  banco.clear();
  seq = 0;
  notifyUsers.mockClear();
  banco.set('arenas/a1', { name: 'Arena Teste' });
  banco.set('arena_inventory_products/agua', { arena_id: 'a1', name: 'Água', sale_price: 5, sell_online: true, active: true, stock_qty: 10 });
  banco.set('arena_inventory_products/grip', { arena_id: 'a1', name: 'Grip', sale_price: 25, sell_online: true, active: true });
  banco.set('arena_inventory_products/alheio', { arena_id: 'a2', name: 'Água da outra', sale_price: 1, sell_online: true, active: true });
  banco.set('arena_inventory_entries/e1', { arena_id: 'a1', product_id: 'agua', quantity: 10 });
});

const vendas = () => doColecao('arena_sales');
const saidas = () => doColecao('arena_inventory_exits');

describe('o pedido', () => {
  it('⭐ é precificado pelo BANCO — o preço da tela não vale', async () => {
    await svc.createSale('a1', [{ product_id: 'agua', quantity: 2, price: 0.01 }], 'pix', [], ANA, null);
    const [v] = vendas();
    expect(v.catalog).toBe('mercado');
    expect(v.total).toBe(10);
    expect(v.items).toEqual([{ product_id: 'agua', name: 'Água', price: 5, quantity: 2 }]);
    expect(v.arena_name).toBe('Arena Teste');
    expect(v.status).toBe('pending');
    expect(v.stock_applied).toBe(false);
  });

  it('⭐ produto de OUTRA arena não entra no pedido', async () => {
    await expect(svc.createSale('a1', [{ product_id: 'alheio', quantity: 1 }], 'pix', [], ANA, null))
      .rejects.toThrow(/saiu de venda/);
    expect(vendas()).toEqual([]);
  });

  it('linhas repetidas do mesmo produto viram uma, e o estoque é conferido pelo total', async () => {
    await expect(svc.createSale('a1', [
      { product_id: 'agua', quantity: 6 }, { product_id: 'agua', quantity: 5 },
    ], 'pix', [], ANA, null)).rejects.toThrow(/Estoque insuficiente de Água/);
  });

  it('⭐ a arena é avisada, com o caminho para a aba de pedidos (uids, não documentos)', async () => {
    await svc.createSale('a1', [{ product_id: 'agua', quantity: 1 }], 'pix', [], ANA, null);
    const aviso = notifyUsers.mock.calls.find(([, a]) => a.title === 'Novo pedido na loja');
    expect(aviso[0]).toEqual(['gestor']);
    expect(aviso[1].link).toBe('/arenas/a1/gerir?aba=pedidos');
  });

  it('dividir: o comprador entra uma vez só, grava só o pagamento DELE, e a turma é avisada', async () => {
    await svc.createSale('a1', [{ product_id: 'grip', quantity: 1 }], 'pix', ['ana', 'bia', 'ana'], ANA, null);
    const [v] = vendas();
    expect(v.split_with).toEqual(['ana', 'bia']);
    expect(doColecao('arena_payments').map((p) => p.payer_id)).toEqual(['ana']);
    const aviso = notifyUsers.mock.calls.find(([, a]) => a.title === 'Sua parte da conta');
    expect(aviso[0]).toEqual(['bia']);
    expect(aviso[1].link).toBe('/minhas-reservas');
  });
});

describe('a entrega', () => {
  it('⭐ vira SAÍDA do Mercado, com o comprador, e acerta a cópia do estoque', async () => {
    const id = await svc.createSale('a1', [{ product_id: 'agua', quantity: 3 }], 'pix', [], ANA, null);
    await svc.confirmSale(id, GESTOR);
    const [s] = saidas();
    expect(s).toMatchObject({
      arena_id: 'a1', product_id: 'agua', quantity: 3, exit_type: 'sale', unit_price: 5, total_price: 15,
      buyer_id: 'ana', sale_id: id, channel: 'app',
    });
    expect(banco.get('arena_inventory_products/agua').stock_qty).toBe(7);
    expect(banco.get(`arena_sales/${id}`).stock_applied).toBe(true);
  });

  it('⭐ dois cliques no balcão não baixam o estoque duas vezes', async () => {
    const id = await svc.createSale('a1', [{ product_id: 'agua', quantity: 1 }], 'pix', [], ANA, null);
    await svc.confirmSale(id, GESTOR);
    await svc.confirmSale(id, GESTOR);
    expect(saidas()).toHaveLength(1);
  });

  it('⭐ estoque controlado que acabou recusa a entrega, dizendo quanto resta', async () => {
    const id = await svc.createSale('a1', [{ product_id: 'agua', quantity: 4 }], 'pix', [], ANA, null);
    banco.set('arena_inventory_exits/x', { arena_id: 'a1', product_id: 'agua', quantity: 8 });
    await expect(svc.confirmSale(id, GESTOR)).rejects.toThrow(/Acabou o estoque de Água \(restam 2\)/);
  });

  it('produto SEM controle de estoque (nenhuma entrada) entrega sempre, e a cópia fica vazia', async () => {
    const id = await svc.createSale('a1', [{ product_id: 'grip', quantity: 2 }], 'pix', [], ANA, null);
    await svc.confirmSale(id, GESTOR);
    expect(saidas()).toHaveLength(1);
    expect(banco.get('arena_inventory_products/grip').stock_qty).toBeNull();
  });
});

describe('o cancelamento pela arena', () => {
  it('⭐ apaga só as saídas DAQUELE pedido, devolve o estoque e cancela o pagamento em aberto', async () => {
    const id = await svc.createSale('a1', [{ product_id: 'agua', quantity: 2 }], 'pix', [], ANA, null);
    await svc.confirmSale(id, GESTOR);
    banco.set('arena_inventory_exits/balcao', { arena_id: 'a1', product_id: 'agua', quantity: 1, exit_type: 'sale' });
    await svc.cancelSale(id, 'Acabou o produto', GESTOR);
    expect(saidas().map((x) => x.id)).toEqual(['balcao']);
    expect(banco.get('arena_inventory_products/agua').stock_qty).toBe(9);
    expect(banco.get(`arena_payments/${id}_ana`).status).toBe('cancelled');
    expect(banco.get(`arena_sales/${id}`)).toMatchObject({ status: 'cancelled', cancel_reason: 'Acabou o produto' });
    const aviso = notifyUsers.mock.calls.find(([, a]) => a.title === 'Pedido cancelado');
    expect(aviso[0]).toContain('ana');
    expect(aviso[1].message).toContain('Motivo: Acabou o produto');
  });
});

describe('o pagamento', () => {
  it('⭐🐞 a conta dividida só fecha quando TODOS pagaram (antes fechava com gente devendo)', async () => {
    const id = await svc.createSale('a1', [{ product_id: 'grip', quantity: 2 }], 'pix', ['ana', 'bia'], ANA, null);
    await svc.confirmPayment(`${id}_ana`, GESTOR);
    expect(banco.get(`arena_sales/${id}`).status).toBe('pending');
    await svc.receiveShareAtCounter(id, 'bia', GESTOR);
    expect(banco.get(`arena_payments/${id}_bia`)).toMatchObject({ status: 'paid', amount: 25, received_at_counter: true });
    expect(banco.get(`arena_sales/${id}`).status).toBe('paid');
  });

  it('não recebe no balcão por quem não faz parte da conta', async () => {
    const id = await svc.createSale('a1', [{ product_id: 'grip', quantity: 1 }], 'pix', [], ANA, null);
    await expect(svc.receiveShareAtCounter(id, 'estranho', GESTOR)).rejects.toThrow(/não faz parte/);
  });
});

describe('quem pediu desiste', () => {
  it('⭐ do pedido em aberto: cancela o pedido e o próprio pagamento, e a arena é avisada', async () => {
    const id = await svc.createSale('a1', [{ product_id: 'agua', quantity: 1 }], 'pix', [], ANA, null);
    await svc.cancelMyOrder(id, ANA, null);
    expect(banco.get(`arena_sales/${id}`)).toMatchObject({ status: 'cancelled', cancelled_by: 'ana' });
    expect(banco.get(`arena_payments/${id}_ana`).status).toBe('cancelled');
    expect(notifyUsers.mock.calls.some(([uids, a]) => a.title === 'Pedido cancelado por quem pediu' && uids[0] === 'gestor')).toBe(true);
  });

  it('não desiste de pedido entregue, nem de conta dividida, nem do pedido dos outros', async () => {
    const entregue = await svc.createSale('a1', [{ product_id: 'agua', quantity: 1 }], 'pix', [], ANA, null);
    await svc.confirmSale(entregue, GESTOR);
    await expect(svc.cancelMyOrder(entregue, ANA, null)).rejects.toThrow(/já foi entregue/);
    const dividida = await svc.createSale('a1', [{ product_id: 'grip', quantity: 1 }], 'pix', ['ana', 'bia'], ANA, null);
    await expect(svc.cancelMyOrder(dividida, ANA, null)).rejects.toThrow(/balcão/);
    await expect(svc.cancelMyOrder(dividida, { uid: 'bia' }, null)).rejects.toThrow(/Só quem fez o pedido/);
  });
});

describe('minhas compras', () => {
  it('⭐ junta as que fiz e as que dividem a conta comigo', async () => {
    await svc.createSale('a1', [{ product_id: 'agua', quantity: 1 }], 'pix', [], ANA, null);
    await svc.createSale('a1', [{ product_id: 'grip', quantity: 1 }], 'pix', ['ana', 'bia'], ANA, null);
    const daBia = await svc.listMyShopSales('bia');
    expect(daBia).toHaveLength(1);
    const daAna = await svc.listMyShopSales('ana');
    expect(daAna).toHaveLength(2);
  });

  it('a cópia do estoque é acertada de uma vez, gravando só o que diverge', async () => {
    banco.set('arena_inventory_products/agua', { ...banco.get('arena_inventory_products/agua'), stock_qty: 3 });
    expect(await svc.syncShopStock('a1')).toBe(1);
    expect(banco.get('arena_inventory_products/agua').stock_qty).toBe(10);
    expect(await svc.syncShopStock('a1')).toBe(0);
  });
});
