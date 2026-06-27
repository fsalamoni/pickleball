import { describe, it, expect } from 'vitest';
import {
  isValidUrl,
  normalizeAffiliateInput,
  sortActiveLinks,
  AFFILIATE_CATEGORY,
} from './affiliate.js';

describe('isValidUrl', () => {
  it('aceita http(s) absolutas e rejeita o resto', () => {
    expect(isValidUrl('https://loja.com/x')).toBe(true);
    expect(isValidUrl('http://a.co')).toBe(true);
    expect(isValidUrl('loja.com')).toBe(false);
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('normalizeAffiliateInput', () => {
  it('exige título e URL válida', () => {
    const r = normalizeAffiliateInput({ title: '', url: 'x' });
    expect(r.valid).toBe(false);
    expect(r.errors.title).toBeTruthy();
    expect(r.errors.url).toBeTruthy();
  });

  it('normaliza categoria inválida para "other" e ativo por padrão', () => {
    const r = normalizeAffiliateInput({ title: 'Raquetes', url: 'https://x.com', category: 'zzz' });
    expect(r.valid).toBe(true);
    expect(r.value.category).toBe(AFFILIATE_CATEGORY.OTHER);
    expect(r.value.active).toBe(true);
    expect(r.value.sort_order).toBe(0);
  });
});

describe('sortActiveLinks', () => {
  it('filtra inativos e ordena por sort_order e título', () => {
    const links = [
      { id: '1', title: 'B', active: true, sort_order: 2 },
      { id: '2', title: 'A', active: false, sort_order: 1 },
      { id: '3', title: 'C', active: true, sort_order: 1 },
      { id: '4', title: 'A', active: true, sort_order: 1 },
    ];
    expect(sortActiveLinks(links).map((l) => l.id)).toEqual(['4', '3', '1']);
  });
});
