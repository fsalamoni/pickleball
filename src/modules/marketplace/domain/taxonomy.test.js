import { describe, it, expect } from 'vitest';
import {
  MARKET_CATEGORIES, findCategory, attributesFor, validateAttributes, categoryBreadcrumb,
  categoryPath, activeCategories, rootOf, formatAttribute,
} from './taxonomy.js';

describe('categorias do Mercado', () => {
  it('slugs são únicos', () => {
    const all = MARKET_CATEGORIES.flatMap((c) => [c.slug, ...(c.children || []).map((k) => k.slug)]);
    expect(new Set(all).size).toBe(all.length);
  });
  it('filho herda os atributos do pai e soma os seus', () => {
    expect(attributesFor('raquete-controle').map((a) => a.key)).toContain('core_mm');
    const grip = attributesFor('overgrip').map((a) => a.key);
    expect(grip).toEqual(expect.arrayContaining(['marca', 'quantidade', 'cor']));
    expect(new Set(grip).size).toBe(grip.length);
  });
  it('caminho e trilha', () => {
    expect(categoryPath('raquete-controle')).toEqual(['raquetes', 'raquete-controle']);
    expect(categoryPath('bolas')).toEqual(['bolas']);
    expect(categoryBreadcrumb('raquete-controle')).toEqual(['Raquetes', 'Controle']);
    expect(rootOf('camisetas').slug).toBe('vestuario');
    expect(findCategory('nao-existe')).toBeNull();
  });
  it('valida atributos: número, opção da lista, desconhecido some', () => {
    const { value, errors } = validateAttributes('raquete-controle', {
      peso_g: '225', core_mm: '16', face: 'Madeira de lei', inventado: 'x', marca: 'JOOLA',
    });
    expect(value).toEqual({ peso_g: 225, core_mm: '16', marca: 'JOOLA' });
    expect(errors.face).toBeTruthy();
    expect(validateAttributes('raquetes', { peso_g: 'leve' }).errors.peso_g).toBeTruthy();
  });
  it('admin desliga categorias', () => {
    const cats = activeCategories(['bolas', 'raquete-infantil']);
    expect(cats.some((c) => c.slug === 'bolas')).toBe(false);
    expect(cats.find((c) => c.slug === 'raquetes').children.some((k) => k.slug === 'raquete-infantil')).toBe(false);
  });
  it('formata atributo', () => {
    expect(formatAttribute({ type: 'number', unit: 'g' }, 220)).toBe('220 g');
    expect(formatAttribute({ type: 'boolean' }, true)).toBe('Sim');
  });
});
