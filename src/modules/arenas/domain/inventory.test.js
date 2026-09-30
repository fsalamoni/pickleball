/**
 * Tests do domínio inventory.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeInventoryProduct, normalizeInventoryEntry, normalizeInventoryExit,
  calculateStock, calculateMargin, filterProductsByCategory, searchProducts,
  stockStatus, daysToExpiry, expiryStatus,
  INVENTORY_CATEGORIES, stockPosition, STOCK_SITUATION, STOCK_FILTERS, stockFilterAccepts, countByStockFilter,
} from './inventory.js';

describe('normalizeInventoryProduct', () => {
  it('aceita produto válido', () => {
    const r = normalizeInventoryProduct({
      name: 'Bola Pickleball', brand: 'Franklin', category: INVENTORY_CATEGORIES.BOLA,
    });
    expect(r.valid).toBe(true);
    expect(r.value.unit).toBe('un');
    expect(r.value.active).toBe(true);
  });
  it('rejeita sem nome', () => {
    expect(normalizeInventoryProduct({ category: INVENTORY_CATEGORIES.BOLA }).valid).toBe(false);
  });
  it('rejeita categoria inválida', () => {
    expect(normalizeInventoryProduct({ name: 'X', category: 'Foo' }).valid).toBe(false);
  });
  it('trunca nome > 80', () => {
    const r = normalizeInventoryProduct({ name: 'A'.repeat(100), category: INVENTORY_CATEGORIES.BOLA });
    expect(r.valid).toBe(false);
  });
  it('aceita unit custom', () => {
    const r = normalizeInventoryProduct({ name: 'X', category: INVENTORY_CATEGORIES.BEBIDA, unit: 'L' });
    expect(r.value.unit).toBe('L');
  });
  it('guarda campos aditivos do catálogo e do mercado quando informados', () => {
    const r = normalizeInventoryProduct({
      name: 'Coca-Cola 350ml', category: INVENTORY_CATEGORIES.BEBIDA,
      subcategory: 'Refrigerante', packaging: 'Lata', size: '350ml',
      catalog_id: 'cat123', sale_price: 6.5, min_stock: 12, expiry_date: '2026-12-31',
    });
    expect(r.valid).toBe(true);
    expect(r.value.subcategory).toBe('Refrigerante');
    expect(r.value.packaging).toBe('Lata');
    expect(r.value.catalog_id).toBe('cat123');
    expect(r.value.sale_price).toBe(6.5);
    expect(r.value.min_stock).toBe(12);
    expect(r.value.expiry_date).toBe('2026-12-31');
  });
  it('não inclui campos aditivos quando ausentes (retrocompat)', () => {
    const r = normalizeInventoryProduct({ name: 'Bola', category: INVENTORY_CATEGORIES.BOLA });
    expect(r.value).not.toHaveProperty('sale_price');
    expect(r.value).not.toHaveProperty('subcategory');
    expect(r.value).not.toHaveProperty('expiry_date');
  });
  it('ignora validade inválida', () => {
    const r = normalizeInventoryProduct({ name: 'X', category: INVENTORY_CATEGORIES.BEBIDA, expiry_date: '31/12/2026' });
    expect(r.value).not.toHaveProperty('expiry_date');
  });
});

describe('stockStatus', () => {
  it('esgotado quando <= 0', () => {
    expect(stockStatus(0)).toBe('out');
    expect(stockStatus(-2)).toBe('out');
  });
  it('baixo abaixo do mínimo', () => {
    expect(stockStatus(3, 5)).toBe('low');
  });
  it('baixo pela heurística padrão sem mínimo', () => {
    expect(stockStatus(2)).toBe('low');
  });
  it('ok quando suficiente', () => {
    expect(stockStatus(20, 5)).toBe('ok');
  });
});

describe('daysToExpiry / expiryStatus', () => {
  it('calcula dias', () => {
    expect(daysToExpiry('2026-01-11', '2026-01-01')).toBe(10);
    expect(daysToExpiry('2025-12-30', '2026-01-01')).toBe(-2);
  });
  it('null sem data', () => {
    expect(daysToExpiry('')).toBeNull();
    expect(expiryStatus('foo')).toBeNull();
  });
  it('classifica', () => {
    expect(expiryStatus('2025-12-30', { today: '2026-01-01' })).toBe('expired');
    expect(expiryStatus('2026-01-10', { today: '2026-01-01', soonDays: 15 })).toBe('soon');
    expect(expiryStatus('2026-03-01', { today: '2026-01-01', soonDays: 15 })).toBe('ok');
  });
});

describe('normalizeInventoryEntry', () => {
  const valid = {
    product_id: 'p1', date: '2026-07-22', quantity: 10, unit_cost: 5.5,
    supplier: 'Fornecedor X', buyer_name: 'João',
  };
  it('aceita entry válida', () => {
    const r = normalizeInventoryEntry(valid);
    expect(r.valid).toBe(true);
    expect(r.value.total_cost).toBe(55);
  });
  it('rejeita sem product_id', () => {
    expect(normalizeInventoryEntry({ ...valid, product_id: '' }).valid).toBe(false);
  });
  it('rejeita data inválida', () => {
    expect(normalizeInventoryEntry({ ...valid, date: '22/07/2026' }).valid).toBe(false);
    expect(normalizeInventoryEntry({ ...valid, date: '' }).valid).toBe(false);
  });
  it('rejeita quantity <= 0', () => {
    expect(normalizeInventoryEntry({ ...valid, quantity: 0 }).valid).toBe(false);
    expect(normalizeInventoryEntry({ ...valid, quantity: -5 }).valid).toBe(false);
  });
  it('rejeita quantity > max', () => {
    expect(normalizeInventoryEntry({ ...valid, quantity: 200000 }).valid).toBe(false);
  });
  it('rejeita unit_cost < 0', () => {
    expect(normalizeInventoryEntry({ ...valid, unit_cost: -1 }).valid).toBe(false);
  });
  it('arredonda total_cost', () => {
    const r = normalizeInventoryEntry({ ...valid, quantity: 3, unit_cost: 1.337 });
    expect(r.value.total_cost).toBe(4.01);
  });
});

describe('normalizeInventoryExit', () => {
  const valid = {
    product_id: 'p1', date: '2026-07-22', quantity: 5, unit_price: 12, exit_type: 'sale',
  };
  it('aceita exit válida', () => {
    const r = normalizeInventoryExit(valid);
    expect(r.valid).toBe(true);
    expect(r.value.total_price).toBe(60);
  });
  it('rejeita exit_type inválido', () => {
    expect(normalizeInventoryExit({ ...valid, exit_type: 'steal' }).valid).toBe(false);
  });
  it('aceita exit_type = loss', () => {
    const r = normalizeInventoryExit({ ...valid, exit_type: 'loss', unit_price: 0 });
    expect(r.valid).toBe(true);
  });
  it('exit_type default = sale', () => {
    const r = normalizeInventoryExit({ product_id: 'p1', date: '2026-07-22', quantity: 1, unit_price: 5 });
    expect(r.value.exit_type).toBe('sale');
  });
});

describe('calculateStock', () => {
  it('vazio = 0', () => {
    const s = calculateStock('p1', [], []);
    expect(s.quantity).toBe(0);
    expect(s.total_invested).toBe(0);
    expect(s.total_revenue).toBe(0);
  });
  it('quantidade = entries - exits', () => {
    const entries = [
      { product_id: 'p1', quantity: 10, total_cost: 50 },
      { product_id: 'p1', quantity: 5, total_cost: 25 },
      { product_id: 'p2', quantity: 100, total_cost: 200 }, // outro produto
    ];
    const exits = [
      { product_id: 'p1', quantity: 3, total_price: 30 },
    ];
    const s = calculateStock('p1', entries, exits);
    expect(s.quantity).toBe(12);
    expect(s.total_invested).toBe(75);
    expect(s.total_revenue).toBe(30);
  });
});

describe('calculateMargin', () => {
  it('100% se receita = 2x custo', () => {
    expect(calculateMargin({ total_invested: 100, total_revenue: 200 })).toBe(100);
  });
  it('0% se receita = custo', () => {
    expect(calculateMargin({ total_invested: 100, total_revenue: 100 })).toBe(0);
  });
  it('-50% se prejuízo metade', () => {
    expect(calculateMargin({ total_invested: 100, total_revenue: 50 })).toBe(-50);
  });
  it('0 se sem custo', () => {
    expect(calculateMargin({ total_invested: 0, total_revenue: 100 })).toBe(0);
  });
});

describe('filterProductsByCategory', () => {
  const products = [
    { id: '1', name: 'A', category: 'Bola' },
    { id: '2', name: 'B', category: 'Raquete' },
    { id: '3', name: 'C', category: 'Bola' },
  ];
  it('filtra por categoria', () => {
    expect(filterProductsByCategory(products, 'Bola')).toHaveLength(2);
  });
  it('"all" retorna todos', () => {
    expect(filterProductsByCategory(products, 'all')).toHaveLength(3);
  });
  it('vazio/null = todos', () => {
    expect(filterProductsByCategory(products, null)).toHaveLength(3);
  });
});

describe('searchProducts', () => {
  const products = [
    { id: '1', name: 'Bola Franklin', brand: 'Franklin' },
    { id: '2', name: 'Raquete Selkirk', brand: 'Selkirk' },
    { id: '3', name: 'Bola Onix', brand: 'Onix' },
  ];
  it('busca por nome', () => {
    expect(searchProducts(products, 'selkirk')).toHaveLength(1);
  });
  it('busca por brand', () => {
    expect(searchProducts(products, 'franklin')).toHaveLength(1);
  });
  it('case-insensitive', () => {
    expect(searchProducts(products, 'BOLA')).toHaveLength(2);
  });
  it('vazio = todos', () => {
    expect(searchProducts(products, '')).toHaveLength(3);
  });
});


describe('campos da loja do app (aditivos)', () => {
  it('produto marcado para o app grava sell_online; sem marcar, não grava nada', () => {
    const com = normalizeInventoryProduct({ name: 'Água', category: INVENTORY_CATEGORIES.BEBIDA, sell_online: true });
    expect(com.value.sell_online).toBe(true);
    const sem = normalizeInventoryProduct({ name: 'Água', category: INVENTORY_CATEGORIES.BEBIDA });
    expect('sell_online' in sem.value).toBe(false);
  });

  it('saída da entrega de um pedido guarda o pedido e o canal', () => {
    const r = normalizeInventoryExit({
      product_id: 'p', date: '2026-09-24', quantity: 2, unit_price: 5, sale_id: 's1', channel: 'app',
    });
    expect(r.valid).toBe(true);
    expect(r.value.sale_id).toBe('s1');
    expect(r.value.channel).toBe('app');
  });

  it('saída digitada no balcão continua sem pedido e sem canal (retrocompatível)', () => {
    const r = normalizeInventoryExit({ product_id: 'p', date: '2026-09-24', quantity: 1, unit_price: 5 });
    expect('sale_id' in r.value).toBe(false);
    expect('channel' in r.value).toBe(false);
  });

  it('canal desconhecido é ignorado', () => {
    const r = normalizeInventoryExit({ product_id: 'p', date: '2026-09-24', quantity: 1, unit_price: 5, channel: 'x' });
    expect('channel' in r.value).toBe(false);
  });
});

describe('stockPosition — onde o produto está (uma resposta para todas as telas)', () => {
  const HOJE = '2026-09-30';
  const compra = (product_id, quantity) => ({ product_id, quantity, total_cost: 0 });
  const venda = (product_id, quantity) => ({ product_id, quantity, total_price: 0 });

  it('⭐ produto CADASTRADO e nunca comprado não está no estoque — nem "Esgotado"', () => {
    const p = stockPosition({ id: 'agua' }, [], [], { today: HOJE });
    expect(p.situacao).toBe(STOCK_SITUATION.SEM_COMPRA);
    expect(p.aVenda).toBe(false);
    expect(p.repor).toBe(false);
    expect(p.controla).toBe(false);
  });

  it('com compra e estoque: à venda; zerado: esgotado (e pede reposição)', () => {
    const entradas = [compra('agua', 10)];
    expect(stockPosition({ id: 'agua' }, entradas, [], { today: HOJE }).situacao).toBe(STOCK_SITUATION.A_VENDA);
    const zerado = stockPosition({ id: 'agua' }, entradas, [venda('agua', 10)], { today: HOJE });
    expect(zerado.situacao).toBe(STOCK_SITUATION.ESGOTADO);
    expect(zerado.aVenda).toBe(false);
    expect(zerado.repor).toBe(true);
  });

  it('abaixo do mínimo: à venda E pede reposição', () => {
    const p = stockPosition({ id: 'agua', min_stock: 6 }, [compra('agua', 10)], [venda('agua', 5)], { today: HOJE });
    expect(p.situacao).toBe(STOCK_SITUATION.BAIXO);
    expect(p.aVenda).toBe(true);
    expect(p.repor).toBe(true);
  });

  it('⭐ vencido com estoque não está à venda; vencido SEM estoque não dispara alerta', () => {
    const vencido = { id: 'suco', expiry_date: '2026-09-01' };
    const naPrateleira = stockPosition(vencido, [compra('suco', 3)], [], { today: HOJE });
    expect(naPrateleira.situacao).toBe(STOCK_SITUATION.VENCIDO);
    expect(naPrateleira.aVenda).toBe(false);
    expect(naPrateleira.alertaValidade).toBe(true);
    const acabou = stockPosition(vencido, [compra('suco', 3)], [venda('suco', 3)], { today: HOJE });
    expect(acabou.alertaValidade).toBe(false);
    const nuncaComprado = stockPosition(vencido, [], [], { today: HOJE });
    expect(nuncaComprado.alertaValidade).toBe(false);
  });

  it('sem compra, marcado para o app e com a loja ligada: à venda sem controle de estoque', () => {
    const grip = { id: 'grip', sell_online: true, sale_price: 25 };
    expect(stockPosition(grip, [], [], { today: HOJE, vendePeloApp: true }).situacao).toBe(STOCK_SITUATION.SEM_CONTROLE);
    expect(stockPosition(grip, [], [], { today: HOJE, vendePeloApp: true }).aVenda).toBe(true);
    // loja desligada: não vende em lugar nenhum
    expect(stockPosition(grip, [], [], { today: HOJE }).situacao).toBe(STOCK_SITUATION.SEM_COMPRA);
    // sem preço, o app não vende
    expect(stockPosition({ ...grip, sale_price: 0 }, [], [], { today: HOJE, vendePeloApp: true }).situacao)
      .toBe(STOCK_SITUATION.SEM_COMPRA);
  });

  it('entregas do app sem compra registrada não viram "esgotado" (a mesma regra de trackedStock)', () => {
    const grip = { id: 'grip', sell_online: true, sale_price: 25 };
    const p = stockPosition(grip, [], [venda('grip', 2)], { today: HOJE, vendePeloApp: true });
    expect(p.situacao).toBe(STOCK_SITUATION.SEM_CONTROLE);
  });

  it('inativo não está à venda nem gera alerta, mesmo com estoque', () => {
    const p = stockPosition({ id: 'agua', active: false }, [compra('agua', 2)], [], { today: HOJE });
    expect(p.situacao).toBe(STOCK_SITUATION.INATIVO);
    expect(p.aVenda).toBe(false);
    expect(p.repor).toBe(false);
  });

  it('os filtros: "À venda" é o padrão e cada situação cai em um filtro só (além de "Todos")', () => {
    expect(STOCK_FILTERS[0].value).toBe('a_venda');
    for (const situacao of Object.values(STOCK_SITUATION)) {
      const filtros = STOCK_FILTERS.filter((f) => f.value !== 'todos' && stockFilterAccepts(f.value, situacao));
      expect(filtros).toHaveLength(1);
      expect(stockFilterAccepts('todos', situacao)).toBe(true);
    }
    expect(stockFilterAccepts('inexistente', STOCK_SITUATION.A_VENDA)).toBe(true); // cai no padrão
    expect(stockFilterAccepts('inexistente', STOCK_SITUATION.ESGOTADO)).toBe(false);
  });

  it('conta quantos cabem em cada filtro', () => {
    const c = countByStockFilter([
      { situacao: 'a_venda' }, { situacao: 'baixo' }, { situacao: 'esgotado' }, { situacao: 'sem_compra' },
    ]);
    expect(c).toMatchObject({ a_venda: 2, esgotados: 1, vencidos: 0, sem_compra: 1, inativos: 0, todos: 4 });
  });
});
