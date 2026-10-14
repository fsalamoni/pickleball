import { describe, it, expect } from 'vitest';
import { formatBRL, parseBRL, discountPercent } from './money.js';

describe('dinheiro do Mercado', () => {
  it('formata centavos em reais', () => {
    expect(formatBRL(69000)).toBe('R$ 690,00');
    expect(formatBRL(123456)).toBe('R$ 1.234,56');
    expect(formatBRL(5)).toBe('R$ 0,05');
    expect(formatBRL(-1500)).toBe('-R$ 15,00');
    expect(formatBRL(100000000)).toBe('R$ 1.000.000,00');
  });
  it('lê o que a pessoa digita', () => {
    expect(parseBRL('1.234,56')).toBe(123456);
    expect(parseBRL('R$ 1234,56')).toBe(123456);
    expect(parseBRL('1234.56')).toBe(123456);
    expect(parseBRL('690')).toBe(69000);
    expect(parseBRL('690,5')).toBe(69050);
    expect(parseBRL('1.234')).toBe(123400);
    expect(parseBRL(12.5)).toBe(1250);
    expect(parseBRL('abc')).toBeNull();
    expect(parseBRL('')).toBeNull();
  });
  it('calcula o desconto do de/por', () => {
    expect(discountPercent(8000, 10000)).toBe(20);
    expect(discountPercent(10000, 8000)).toBe(0);
    expect(discountPercent(10000, null)).toBe(0);
  });
});
