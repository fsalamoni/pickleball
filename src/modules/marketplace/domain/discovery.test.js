import { describe, it, expect } from 'vitest';
import {
  parseRecent, pushRecent, recentListings, savedSearchKey, savedSearchLabel, savedSearchMatches, savedSearchSince,
} from './discovery.js';
import { filtersFromParams } from './search.js';

const dia = 86400000;
const agora = Date.UTC(2026, 9, 14, 12);

describe('buscas salvas', () => {
  it('a mesma busca dá a mesma chave (ordem dos parâmetros e "ordem" não contam)', () => {
    expect(savedSearchKey('q=raquete&cat=raquetes&ordem=recent')).toBe(savedSearchKey('cat=raquetes&q=raquete'));
    expect(savedSearchKey('q=raquete')).not.toBe(savedSearchKey('q=bola'));
    expect(savedSearchKey('vende=hacker')).toBe(savedSearchKey(''));
  });

  it('o nome diz o que a busca procura', () => {
    expect(savedSearchLabel(filtersFromParams('q=joola&cat=raquetes&estado=used&max=800&uf=SP')))
      .toMatch(/^“joola” · Raquetes · usados · até R\$\s?800,00 · SP$/);
    expect(savedSearchLabel(filtersFromParams(''))).toBe('Todos os anúncios');
  });

  it('novidade = no ar, com estoque, depois da última visita e de outra pessoa', () => {
    const ls = [
      { id: 'a', status: 'active', quantity: 1, title: 'Raquete A', type: 'product_new', price_cents: 1, published_at: agora - dia, created_by: 'x' },
      { id: 'b', status: 'active', quantity: 1, title: 'Raquete B', type: 'product_new', price_cents: 1, published_at: agora - 3 * dia, created_by: 'x' },
      { id: 'c', status: 'active', quantity: 1, title: 'Raquete C', type: 'product_new', price_cents: 1, published_at: agora, created_by: 'eu' },
      { id: 'd', status: 'sold_out', quantity: 0, title: 'Raquete D', type: 'product_new', price_cents: 1, published_at: agora },
      { id: 'e', status: 'active', quantity: 1, title: 'Bola', type: 'product_new', price_cents: 1, published_at: agora },
    ];
    expect(savedSearchMatches(ls, 'q=raquete', { since: agora - 2 * dia, uid: 'eu' }).map((l) => l.id)).toEqual(['a']);
    expect(savedSearchMatches(ls, 'q=raquete', { since: 0 }).map((l) => l.id)).toEqual(['c', 'a', 'b']);
  });

  it('conta desde a última visita, ou desde que foi salva', () => {
    expect(savedSearchSince({ last_seen_ms: 100, created_at: { toMillis: () => 50 } })).toBe(100);
    expect(savedSearchSince({ created_at_ms: 70 })).toBe(70);
    expect(savedSearchSince(null)).toBe(0);
  });
});

describe('vistos recentemente', () => {
  it('o último visto vai para a frente, sem repetir, com teto', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
    expect(pushRecent(['a', 'b'], 'c', 2)).toEqual(['c', 'a']);
    expect(pushRecent('lixo', 'a')).toEqual(['a']);
    expect(pushRecent(['a', 1, 'b'], 'c')).toEqual(['c', 'a', 'b']);
  });

  it('só o que ainda está à venda, na ordem vista, sem o aberto agora', () => {
    const ls = [{ id: 'a', status: 'active' }, { id: 'b', status: 'paused' }, { id: 'c', status: 'active' }];
    expect(recentListings(['c', 'b', 'a', 'z'], ls, { except: 'a' }).map((l) => l.id)).toEqual(['c']);
  });
  it('a lista guardada no aparelho aceita lixo sem quebrar', () => {
    expect(parseRecent('["a","b"]')).toEqual(['a', 'b']);
    expect(parseRecent('{]')).toEqual([]);
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent('{"a":1}')).toEqual([]);
  });
});
