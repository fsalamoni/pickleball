import { describe, it, expect } from 'vitest';
import {
  searchListings, filterListings, facetCounts, filtersFromParams, filtersToParams, textMatchScore,
  activeFilterChips, clearChip, EMPTY_FILTERS,
} from './search.js';

const day = 86400000;
const now = Date.UTC(2026, 9, 13);
const L = [
  { id: '1', status: 'active', title: 'Raquete JOOLA Perseus', category_path: ['raquetes', 'raquete-controle'], type: 'product_used', price_cents: 80000, seller_type: 'athlete', fulfillment: ['meetup'], state: 'SP', city: 'São Paulo', attributes: { core_mm: '16' }, search_terms: ['raquete', 'joola', 'perseus'], accepts_offers: true, published_at: now - day },
  { id: '2', status: 'active', title: 'Bolas Franklin X-40 (3)', category_path: ['bolas'], type: 'product_new', price_cents: 6000, seller_type: 'store', fulfillment: ['shipping'], state: 'RJ', city: 'Rio de Janeiro', search_terms: ['bolas', 'franklin'], published_at: now - 3 * day, compare_at_cents: 8000 },
  { id: '3', status: 'sold_out', title: 'Raquete Selkirk Vanguard', category_path: ['raquetes', 'raquete-potencia'], type: 'product_new', price_cents: 150000, seller_type: 'arena', fulfillment: ['pickup'], state: 'SP', city: 'Campinas', attributes: { core_mm: '14' }, search_terms: ['raquete', 'selkirk'], published_at: now },
  { id: '4', status: 'paused', title: 'Raquete escondida', category_path: ['raquetes'], price_cents: 1 },
];

describe('busca do Mercado', () => {
  it('frete grátis: envia, custa zero e não é a combinar; vai e volta na URL', () => {
    const G = [
      { ...L[1], id: 'g', shipping_cents: 0 },
      { ...L[1], id: 'p', shipping_cents: 1500 },
      { ...L[1], id: 'c', shipping_cents: 0, shipping_to_agree: true },
      { ...L[0], id: 'm', shipping_cents: 0 },
    ];
    expect(filterListings(G, { ...EMPTY_FILTERS, freeShipping: true }).map((l) => l.id)).toEqual(['g']);
    expect(facetCounts(G, { ...EMPTY_FILTERS, freeShipping: true }).freeShipping).toBe(1);
    const f = filtersFromParams('frete=gratis');
    expect(f.freeShipping).toBe(true);
    expect(filtersToParams(f).get('frete')).toBe('gratis');
    expect(filtersFromParams('frete=x').freeShipping).toBe(false);
    expect(activeFilterChips(f).map((c) => c.key)).toEqual(['freeShipping']);
    expect(clearChip(f, 'freeShipping').freeShipping).toBe(false);
  });
  it('cidades só com o estado escolhido', () => {
    expect(facetCounts(L, EMPTY_FILTERS).city).toEqual({});
    expect(facetCounts(L, { ...EMPTY_FILTERS, uf: 'SP' }).city).toEqual({ 'São Paulo': 1, Campinas: 1 });
  });
  it('só mostra no ar e esgotado; pausado some', () => {
    expect(filterListings(L).map((l) => l.id)).toEqual(['1', '2', '3']);
  });
  it('todas as palavras precisam aparecer; prefixo vale', () => {
    expect(textMatchScore(L[0], 'raq joola')).toBeGreaterThan(0);
    expect(textMatchScore(L[0], 'raquete selkirk')).toBe(0);
    expect(searchListings(L, { q: 'raquete' }, { now }).items.map((l) => l.id)).toEqual(['1', '3']);
  });
  it('filtros de departamento, estado, vendedor, entrega, preço e atributo', () => {
    expect(filterListings(L, { ...EMPTY_FILTERS, cat: 'raquetes' }).length).toBe(2);
    expect(filterListings(L, { ...EMPTY_FILTERS, cond: 'used' }).map((l) => l.id)).toEqual(['1']);
    expect(filterListings(L, { ...EMPTY_FILTERS, sellers: ['store', 'arena'] }).length).toBe(2);
    expect(filterListings(L, { ...EMPTY_FILTERS, ship: 'shipping' }).map((l) => l.id)).toEqual(['2']);
    expect(filterListings(L, { ...EMPTY_FILTERS, min: 10000, max: 100000 }).map((l) => l.id)).toEqual(['1']);
    expect(filterListings(L, { ...EMPTY_FILTERS, cat: 'raquetes', attrs: { core_mm: '14' } }).map((l) => l.id)).toEqual(['3']);
    expect(filterListings(L, { ...EMPTY_FILTERS, city: 'sao paulo' }).map((l) => l.id)).toEqual(['1']);
    expect(filterListings(L, { ...EMPTY_FILTERS, offers: true }).map((l) => l.id)).toEqual(['1']);
  });
  it('ordenações, com esgotado sempre no fim', () => {
    const ids = (sort) => searchListings(L, { sort }, { now }).items.map((l) => l.id);
    expect(ids('price_asc')).toEqual(['2', '1', '3']);
    expect(ids('price_desc')).toEqual(['1', '2', '3']);
    expect(ids('recent')).toEqual(['1', '2', '3']);
    expect(ids('discount')[0]).toBe('2');
    expect(ids('relevance').at(-1)).toBe('3');
  });
  it('facetas contam sem o próprio filtro', () => {
    const f = facetCounts(L, { ...EMPTY_FILTERS, cat: 'bolas' });
    expect(f.cat.raquetes).toBe(2);
    expect(f.cat.bolas).toBe(1);
    expect(f.sellers.store).toBe(1);
    expect(f.sellers.athlete).toBeUndefined();
  });
  it('filtros vão e voltam pela URL', () => {
    const f = { ...EMPTY_FILTERS, q: 'joola', cat: 'raquetes', cond: 'used', min: 5000, max: 90000, sellers: ['store'], ship: 'shipping', offers: true, uf: 'SP', attrs: { core_mm: '16' }, sort: 'price_asc' };
    expect(filtersFromParams(filtersToParams(f))).toEqual(f);
    expect(filtersFromParams('vende=hacker&estado=x&ordem=foo&uf=SPX')).toMatchObject({ sellers: [], cond: '', sort: 'relevance', uf: '' });
    expect(filtersToParams(EMPTY_FILTERS).toString()).toBe('');
  });
  it('chips de filtro ativo e remoção', () => {
    const f = { ...EMPTY_FILTERS, cat: 'bolas', min: 1000, sellers: ['store', 'arena'], attrs: { cor: 'amarela' } };
    const chips = activeFilterChips(f, { cat: { bolas: 'Bolas' } });
    expect(chips.map((c) => c.label)).toEqual(['Bolas', 'A partir de R$ 10', 'store', 'arena', 'amarela']);
    expect(clearChip(f, 'seller:store').sellers).toEqual(['arena']);
    expect(clearChip(f, 'price').min).toBeNull();
    expect(clearChip(f, 'attr:cor').attrs).toEqual({});
  });
});
