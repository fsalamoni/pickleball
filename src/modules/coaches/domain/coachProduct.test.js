import { describe, it, expect } from 'vitest';
import {
  COACH_PRODUCT_CATEGORY,
  normalizeCoachProduct,
  publicCoachProducts,
  coachProductCategoryLabel,
} from './coachProduct.js';

describe('normalizeCoachProduct', () => {
  const base = { coach_id: 'c1', name: 'Overgrip', price: 15 };
  it('valida produto', () => {
    const r = normalizeCoachProduct(base);
    expect(r.valid).toBe(true);
    expect(r.value.category).toBe(COACH_PRODUCT_CATEGORY.OTHER);
    expect(r.value.visible_public).toBe(false);
    expect(r.value.active).toBe(true);
  });
  it('exige coach_id, nome e preço', () => {
    expect(normalizeCoachProduct({ name: 'x', price: 1 }).valid).toBe(false);
    expect(normalizeCoachProduct({ coach_id: 'c1', price: 1 }).valid).toBe(false);
    expect(normalizeCoachProduct({ coach_id: 'c1', name: 'x' }).valid).toBe(false);
    expect(normalizeCoachProduct({ coach_id: 'c1', name: 'x', price: -1 }).valid).toBe(false);
  });
  it('normaliza categoria e visibilidade', () => {
    const r = normalizeCoachProduct({ ...base, category: 'VESTUARIO', visible_public: true });
    expect(r.value.category).toBe(COACH_PRODUCT_CATEGORY.APPAREL);
    expect(r.value.visible_public).toBe(true);
  });
});

describe('publicCoachProducts', () => {
  it('filtra ativos e públicos', () => {
    const list = [
      { active: true, visible_public: true },
      { active: true, visible_public: false },
      { active: false, visible_public: true },
    ];
    expect(publicCoachProducts(list)).toHaveLength(1);
  });
});

describe('coachProductCategoryLabel', () => {
  it('rotula categoria', () => {
    expect(coachProductCategoryLabel('vestuario')).toBe('Vestuário');
    expect(coachProductCategoryLabel('xyz')).toBe('Outros');
  });
});
