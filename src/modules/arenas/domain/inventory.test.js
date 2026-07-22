/**
 * Tests do domínio inventory.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeInventoryProduct, normalizeInventoryEntry, normalizeInventoryExit,
  calculateStock, calculateMargin, filterProductsByCategory, searchProducts,
  INVENTORY_CATEGORIES,
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
