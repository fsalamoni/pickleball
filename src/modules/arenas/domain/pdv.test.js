import { describe, it, expect } from 'vitest';
import {
  PRODUCT_CATEGORIES, SALE_STATUS, PAYMENT_METHOD,
  normalizeProductInput, hasStock, decrementStock,
  calculateCartTotal, splitAmount, normalizeSaleInput,
} from './pdv.js';

describe('normalizeProductInput', () => {
  it('aceita produto válido', () => {
    const r = normalizeProductInput({ name: 'Água', price: 5, stock: 10, category: 'bebidas' });
    expect(r.valid).toBe(true);
    expect(r.value.name).toBe('Água');
    expect(r.value.category).toBe('bebidas');
  });
  it('rejeita sem nome', () => {
    const r = normalizeProductInput({ price: 5 });
    expect(r.valid).toBe(false);
    expect(r.errors.name).toBeTruthy();
  });
  it('rejeita preço negativo', () => {
    const r = normalizeProductInput({ name: 'X', price: -1 });
    expect(r.valid).toBe(false);
  });
  it('aceita sem estoque (sem controle)', () => {
    const r = normalizeProductInput({ name: 'X', price: 5 });
    expect(r.value.stock).toBe(null);
  });
});

describe('hasStock', () => {
  it('true se tem estoque', () => {
    expect(hasStock({ stock: 5 }, 3)).toBe(true);
  });
  it('false se não tem', () => {
    expect(hasStock({ stock: 2 }, 3)).toBe(false);
  });
  it('true se sem controle', () => {
    expect(hasStock({ stock: null }, 999)).toBe(true);
  });
});

describe('decrementStock', () => {
  it('decrementa', () => {
    const r = decrementStock({ stock: 5 }, 2);
    expect(r.stock).toBe(3);
  });
  it('não vai negativo', () => {
    const r = decrementStock({ stock: 2 }, 5);
    expect(r.stock).toBe(0);
  });
  it('preserva se sem controle', () => {
    const p = { stock: null };
    expect(decrementStock(p, 5)).toEqual(p);
  });
});

describe('calculateCartTotal', () => {
  it('soma itens', () => {
    const total = calculateCartTotal([
      { price: 10, quantity: 2 },
      { price: 5, quantity: 1 },
    ]);
    expect(total).toBe(25);
  });
  it('0 para carrinho vazio', () => {
    expect(calculateCartTotal([])).toBe(0);
  });
});

describe('splitAmount', () => {
  it('divide igualmente', () => {
    const r = splitAmount(100, ['u1', 'u2', 'u3', 'u4']);
    expect(r.length).toBe(4);
    r.forEach((s) => expect(s.amount).toBe(25));
  });
  it('distribui resto em centavos', () => {
    const r = splitAmount(100.03, ['u1', 'u2', 'u3']);
    const total = r.reduce((a, s) => a + s.amount, 0);
    expect(Math.round(total * 100)).toBe(10003);
  });
  it('vazio para 0 participantes', () => {
    expect(splitAmount(100, [])).toEqual([]);
  });
});

describe('normalizeSaleInput', () => {
  it('aceita venda válida', () => {
    const r = normalizeSaleInput({ items: [], total: 50, payment_method: 'pix' });
    expect(r.payment_method).toBe('pix');
  });
  it('default pix', () => {
    const r = normalizeSaleInput({});
    expect(r.payment_method).toBe('pix');
  });
});
