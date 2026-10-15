import { describe, it, expect } from 'vitest';
import { parseRecentSearches, pushRecentSearch, searchSuggestions, RECENT_SEARCH_LIMIT } from './suggestions.js';

describe('ajuda na busca', () => {
  it('buscas recentes: sem repetir, a mais nova na frente, com teto', () => {
    let l = pushRecentSearch([], 'raquete');
    l = pushRecentSearch(l, 'bola');
    l = pushRecentSearch(l, 'Raquete ');
    expect(l).toEqual(['Raquete', 'bola']);
    for (let i = 0; i < 20; i += 1) l = pushRecentSearch(l, `b${i}`);
    expect(l).toHaveLength(RECENT_SEARCH_LIMIT);
    expect(pushRecentSearch(l, '   ')).toEqual(l);
    expect(parseRecentSearches('lixo')).toEqual([]);
    expect(parseRecentSearches(JSON.stringify(['a', 1, '', 'b']))).toEqual(['a', 'b']);
  });
  it('sugere categorias e marcas pelo prefixo, sem acento', () => {
    const s = searchSuggestions('raq', { listings: [{ brand: 'JOOLA' }, { brand: 'Selkirk' }] });
    expect(s[0]).toMatchObject({ kind: 'cat', slug: 'raquetes' });
    expect(s.some((x) => x.kind === 'brand')).toBe(false);
    const m = searchSuggestions('jo', { listings: [{ brand: 'JOOLA' }, { brand: 'joola' }] });
    expect(m).toEqual([{ kind: 'brand', label: 'JOOLA', q: 'JOOLA' }]);
    expect(searchSuggestions('calc').map((x) => x.slug)).toEqual(['calcados']);
    expect(searchSuggestions('calc', { disabled: ['calcados'] })).toEqual([]);
    expect(searchSuggestions('')).toEqual([]);
    expect(searchSuggestions('controle')[0]).toMatchObject({ label: 'Controle', parent: 'Raquetes', slug: 'raquete-controle' });
  });
});
