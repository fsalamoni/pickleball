/**
 * Tests do domínio productCatalog (catálogo padrão + deduplicação).
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeText, normalizeSize, buildDedupKey, buildSearchTokens, jaccard,
  normalizeCatalogProduct, findDuplicates, filterCatalog, catalogProductLabel,
  CATALOG_CATEGORIES, CATALOG_PRODUCT_SOURCE, CATALOG_PRODUCT_STATUS,
} from './productCatalog.js';

describe('normalizeText', () => {
  it('remove acentos, pontuação e caixa', () => {
    expect(normalizeText('Coca-Cola Zero AÇÚCAR!')).toBe('coca cola zero acucar');
  });
  it('colapsa espaços', () => {
    expect(normalizeText('  Guaraná   Antarctica ')).toBe('guarana antarctica');
  });
  it('trata nulo', () => {
    expect(normalizeText(null)).toBe('');
  });
});

describe('normalizeSize', () => {
  it('unifica litros em ml', () => {
    expect(normalizeSize('2L')).toBe('2000ml');
    expect(normalizeSize('2 l')).toBe('2000ml');
    expect(normalizeSize('2000ml')).toBe('2000ml');
  });
  it('unifica kg em g', () => {
    expect(normalizeSize('1kg')).toBe('1000g');
  });
  it('mantém quando não reconhece', () => {
    expect(normalizeSize('tamanho família')).toBe('tamanhofamilia');
  });
});

describe('buildDedupKey', () => {
  it('gera a MESMA chave para o mesmo produto escrito diferente', () => {
    const a = buildDedupKey({ category: 'Bebida', subcategory: 'Refrigerante', brand: 'Coca-Cola', size: '2L', packaging: 'Garrafa PET', name: 'Coca Cola 2 litros' });
    const b = buildDedupKey({ category: 'bebida', subcategory: 'refrigerante', brand: 'coca cola', size: '2000ml', packaging: 'garrafa pet', name: 'Coca Cola 2 litros' });
    expect(a).toBe(b);
  });
  it('gera chaves diferentes p/ embalagens diferentes', () => {
    const a = buildDedupKey({ category: 'Bebida', subcategory: 'Refrigerante', brand: 'Coca-Cola', size: '350ml', packaging: 'Lata', name: 'Coca-Cola Lata' });
    const b = buildDedupKey({ category: 'Bebida', subcategory: 'Refrigerante', brand: 'Coca-Cola', size: '600ml', packaging: 'Garrafa PET', name: 'Coca-Cola PET' });
    expect(a).not.toBe(b);
  });
});

describe('jaccard', () => {
  it('1 para conjuntos iguais', () => {
    expect(jaccard(['a', 'b'], ['b', 'a'])).toBe(1);
  });
  it('0 para conjuntos disjuntos', () => {
    expect(jaccard(['a'], ['b'])).toBe(0);
  });
  it('parcial', () => {
    expect(jaccard(['a', 'b'], ['a', 'c'])).toBeCloseTo(1 / 3, 5);
  });
});

describe('normalizeCatalogProduct', () => {
  it('aceita produto válido e preenche dedup_key + tokens', () => {
    const r = normalizeCatalogProduct({
      name: 'Coca-Cola 350ml', category: CATALOG_CATEGORIES.BEBIDA,
      subcategory: 'Refrigerante', brand: 'Coca-Cola', packaging: 'Lata', size: '350ml',
    });
    expect(r.valid).toBe(true);
    expect(r.value.dedup_key).toContain('coca cola');
    expect(r.value.search_tokens).toContain('coca');
    expect(r.value.source).toBe(CATALOG_PRODUCT_SOURCE.PLATFORM);
    expect(r.value.status).toBe(CATALOG_PRODUCT_STATUS.ACTIVE);
    expect(r.value.unit).toBe('un');
  });
  it('rejeita sem nome', () => {
    expect(normalizeCatalogProduct({ category: CATALOG_CATEGORIES.BEBIDA, subcategory: 'Refrigerante' }).valid).toBe(false);
  });
  it('rejeita categoria inválida', () => {
    expect(normalizeCatalogProduct({ name: 'X', category: 'Foo', subcategory: 'Y' }).valid).toBe(false);
  });
  it('rejeita sem subcategoria', () => {
    expect(normalizeCatalogProduct({ name: 'X', category: CATALOG_CATEGORIES.BEBIDA }).valid).toBe(false);
  });
  it('marca contribuição de arena', () => {
    const r = normalizeCatalogProduct({
      name: 'Pastel de queijo', category: CATALOG_CATEGORIES.COMIDA, subcategory: 'Salgado',
      source: CATALOG_PRODUCT_SOURCE.ARENA,
    });
    expect(r.value.source).toBe(CATALOG_PRODUCT_SOURCE.ARENA);
  });
});

describe('findDuplicates', () => {
  const existing = [
    normalizeCatalogProduct({ name: 'Coca-Cola 350ml', category: CATALOG_CATEGORIES.BEBIDA, subcategory: 'Refrigerante', brand: 'Coca-Cola', packaging: 'Lata', size: '350ml' }).value,
    normalizeCatalogProduct({ name: 'Guaraná Antarctica 350ml', category: CATALOG_CATEGORIES.BEBIDA, subcategory: 'Refrigerante', brand: 'Guaraná Antarctica', packaging: 'Lata', size: '350ml' }).value,
    normalizeCatalogProduct({ name: 'Pizza Calabresa Grande', category: CATALOG_CATEGORIES.COMIDA, subcategory: 'Pizza', brand: 'Casa', size: 'Grande' }).value,
  ];

  it('detecta duplicata exata (mesmo produto, nome diferente)', () => {
    const cand = normalizeCatalogProduct({ name: 'Coca Cola lata 350', category: CATALOG_CATEGORIES.BEBIDA, subcategory: 'Refrigerante', brand: 'Coca-Cola', packaging: 'Lata', size: '350ml' }).value;
    const dups = findDuplicates(cand, existing);
    expect(dups.length).toBeGreaterThan(0);
    expect(dups[0].product.name).toBe('Coca-Cola 350ml');
    expect(dups[0].score).toBeGreaterThanOrEqual(0.62);
  });

  it('não aponta falso positivo entre marcas distintas', () => {
    const cand = normalizeCatalogProduct({ name: 'Pepsi 350ml', category: CATALOG_CATEGORIES.BEBIDA, subcategory: 'Refrigerante', brand: 'Pepsi', packaging: 'Lata', size: '350ml' }).value;
    const dups = findDuplicates(cand, existing);
    expect(dups.find((d) => d.exact)).toBeUndefined();
  });

  it('produto totalmente novo não retorna duplicatas', () => {
    const cand = normalizeCatalogProduct({ name: 'Água de Coco 200ml', category: CATALOG_CATEGORIES.BEBIDA, subcategory: 'Coco', brand: 'Kero Coco', packaging: 'Caixinha (Tetra Pak)', size: '200ml' }).value;
    expect(findDuplicates(cand, existing)).toHaveLength(0);
  });
});

describe('filterCatalog', () => {
  const list = [
    normalizeCatalogProduct({ name: 'Coca-Cola 350ml', category: CATALOG_CATEGORIES.BEBIDA, subcategory: 'Refrigerante', brand: 'Coca-Cola' }).value,
    normalizeCatalogProduct({ name: 'Ruffles 100g', category: CATALOG_CATEGORIES.COMIDA, subcategory: 'Salgadinho', brand: 'Ruffles' }).value,
  ];
  it('filtra por categoria', () => {
    expect(filterCatalog(list, { category: CATALOG_CATEGORIES.COMIDA })).toHaveLength(1);
  });
  it('busca por token', () => {
    expect(filterCatalog(list, { query: 'coca' })).toHaveLength(1);
    expect(filterCatalog(list, { query: 'ruffles salgad' })).toHaveLength(1);
  });
  it('sem filtro retorna tudo', () => {
    expect(filterCatalog(list, {})).toHaveLength(2);
  });
});

describe('catalogProductLabel', () => {
  it('inclui marca e embalagem quando não redundante', () => {
    const label = catalogProductLabel({ name: 'Guaraná 350ml', brand: 'Antarctica', packaging: 'Lata', size: '350ml' });
    expect(label).toContain('Antarctica');
    expect(label).toContain('Lata');
  });
  it('não duplica marca já contida no nome', () => {
    const label = catalogProductLabel({ name: 'Coca-Cola 350ml', brand: 'Coca-Cola', packaging: 'Lata', size: '350ml' });
    expect(label.match(/Coca-Cola/g)).toHaveLength(1);
  });
});
