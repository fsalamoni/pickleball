/**
 * Testes de domínio puro do módulo Arena.
 *
 * Cobre as funções sem I/O que validam/normalizam dados de arena,
 * formatam endereço/links e filtram listas para o diretório. Sem mock
 * de Firestore — só funções puras.
 *
 * Parte do sprint de testes (Sprint 0 do roadmap arena — `docs/arena-roadmap.md`).
 * Sem esses testes, as regressões no fluxo de cadastro de arena
 * só eram pegas manualmente pelo owner (o que motivou o bug do
 * `createArena` chamar `normalizeArenaInput` duas vezes com defaults
 * divergentes).
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeUrl,
  normalizeInstagram,
  normalizeArenaInput,
  formatArenaAddress,
  arenaContactLinks,
  aggregateRatings,
  filterAndSortArenas,
} from './arena.js';

describe('normalizeUrl', () => {
  it('mantém https quando já tem scheme', () => {
    expect(normalizeUrl('https://arena.com')).toBe('https://arena.com');
    expect(normalizeUrl('http://arena.com')).toBe('http://arena.com');
  });
  it('prefixa https quando falta scheme', () => {
    expect(normalizeUrl('arena.com')).toBe('https://arena.com');
    expect(normalizeUrl('www.arena.com')).toBe('https://www.arena.com');
  });
  it('retorna string vazia para entrada vazia/nula', () => {
    expect(normalizeUrl('')).toBe('');
    expect(normalizeUrl(null)).toBe('');
    expect(normalizeUrl(undefined)).toBe('');
  });
});

describe('normalizeInstagram', () => {
  it('extrai handle de URL completa', () => {
    expect(normalizeInstagram('https://instagram.com/arena_pickle')).toBe('arena_pickle');
  });
  it('mantém handle puro removendo @', () => {
    expect(normalizeInstagram('@arena_pickle')).toBe('arena_pickle');
    expect(normalizeInstagram('arena_pickle')).toBe('arena_pickle');
  });
  it('remove caracteres inválidos', () => {
    expect(normalizeInstagram('arena pic<kle>!')).toBe('arenapickle');
  });
  it('retorna string vazia para entrada vazia', () => {
    expect(normalizeInstagram('')).toBe('');
    expect(normalizeInstagram(null)).toBe('');
  });
});

describe('normalizeArenaInput', () => {
  it('valida arena completa válida', () => {
    const result = normalizeArenaInput({
      name: 'Arena Porto Alegre',
      description: 'A melhor arena do RS',
      city: 'Porto Alegre',
      state: 'rs',
      address: 'Av. Ipiranga, 100',
      neighborhood: 'Jardim Botânico',
      contact_phone: '51 99999-9999',
      contact_whatsapp: '51999999999',
      contact_email: 'contato@arena.com',
      instagram: '@arena_pa',
      website: 'arena.com',
      hours: 'Seg-Sex 18h-23h',
      court_count: '4',
      base_price: 100,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.value).toMatchObject({
      name: 'Arena Porto Alegre',
      state: 'RS',                    // uppercased
      instagram: 'arena_pa',          // sem @
      website: 'https://arena.com',   // scheme adicionado
      court_count: 4,                 // string -> int
      base_price: 100,
      active: true,
    });
  });

  it('rejeita arena sem nome', () => {
    const result = normalizeArenaInput({ city: 'Porto Alegre' });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBe('Informe o nome da arena.');
  });

  it('rejeita nome > 120 chars', () => {
    const result = normalizeArenaInput({ name: 'A'.repeat(121) });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toContain('muito longo');
  });

  it('trunca campos longos sem rejeitar', () => {
    const result = normalizeArenaInput({
      name: 'Arena',
      description: 'x'.repeat(3000),
      address: 'y'.repeat(500),
      hours: 'z'.repeat(1000),
    });
    expect(result.valid).toBe(true);
    expect(result.value.description).toHaveLength(2000);
    expect(result.value.address).toHaveLength(240);
    expect(result.value.hours).toHaveLength(400);
  });

  it('lida com court_count inválido como 0', () => {
    expect(normalizeArenaInput({ name: 'X', court_count: 'abc' }).value.court_count).toBe(0);
    expect(normalizeArenaInput({ name: 'X', court_count: -5 }).value.court_count).toBe(0);
    expect(normalizeArenaInput({ name: 'X', court_count: 4.7 }).value.court_count).toBe(4);
    expect(normalizeArenaInput({ name: 'X' }).value.court_count).toBe(0);
  });

  it('lida com base_price inválido como null', () => {
    expect(normalizeArenaInput({ name: 'X', base_price: 'abc' }).value.base_price).toBe(null);
    expect(normalizeArenaInput({ name: 'X', base_price: -10 }).value.base_price).toBe(null);
    expect(normalizeArenaInput({ name: 'X', base_price: 0 }).value.base_price).toBe(0); // gratuito OK
    expect(normalizeArenaInput({ name: 'X', base_price: 80 }).value.base_price).toBe(80);
  });

  it('marca active=false explicitamente', () => {
    const result = normalizeArenaInput({ name: 'X', active: false });
    expect(result.value.active).toBe(false);
  });
});

describe('formatArenaAddress', () => {
  it('concatena partes do endereço', () => {
    const arena = {
      address: 'Av. Ipiranga, 100',
      neighborhood: 'Jardim Botânico',
      city: 'Porto Alegre',
      state: 'RS',
    };
    expect(formatArenaAddress(arena)).toBe(
      'Av. Ipiranga, 100 · Jardim Botânico · Porto Alegre / RS',
    );
  });
  it('omite partes vazias', () => {
    expect(formatArenaAddress({ city: 'Curitiba' })).toBe('Curitiba');
    expect(formatArenaAddress({})).toBe('');
    expect(formatArenaAddress(null)).toBe('');
  });
});

describe('arenaContactLinks', () => {
  it('gera link wa.me para WhatsApp (com ou sem 55)', () => {
    expect(arenaContactLinks({ contact_whatsapp: '51999999999' }).whatsapp)
      .toBe('https://wa.me/5551999999999');
    expect(arenaContactLinks({ contact_whatsapp: '999999999' }).whatsapp)
      .toBe('https://wa.me/55999999999');
  });
  it('usa contact_phone como fallback do WhatsApp', () => {
    // 51 + 9999 = 6 dígitos (com DDD mas número curto) — ainda prefixa 55
    expect(arenaContactLinks({ contact_phone: '51 9999' }).whatsapp)
      .toBe('https://wa.me/55519999');
    // 11 dígitos já inclui DDD + número completo
    expect(arenaContactLinks({ contact_phone: '51999990000' }).whatsapp)
      .toBe('https://wa.me/5551999990000');
  });
  it('gera links tel:, mailto:, instagram:, website:', () => {
    const links = arenaContactLinks({
      contact_phone: '51 9999',
      contact_email: 'a@b.com',
      instagram: '@handle',
      website: 'a.com',
    });
    expect(links.phone).toBe('tel:519999');
    expect(links.email).toBe('mailto:a@b.com');
    expect(links.instagram).toBe('https://instagram.com/handle');
    expect(links.website).toBe('https://a.com');
  });
  it('omite links sem dado', () => {
    expect(arenaContactLinks({ name: 'X' })).toEqual({});
    expect(arenaContactLinks(null)).toEqual({});
  });
});

describe('aggregateRatings', () => {
  it('calcula média e distribuição', () => {
    const agg = aggregateRatings([
      { rating: 5, type: 'review' },
      { rating: 4, type: 'review' },
      { rating: 3, type: 'review' },
    ]);
    expect(agg.average).toBe(4);
    expect(agg.count).toBe(3);
    expect(agg.distribution).toEqual([0, 0, 1, 1, 1]);
  });
  it('ignora ratings fora de 1..5 e tipos != review', () => {
    const agg = aggregateRatings([
      { rating: 0, type: 'review' },
      { rating: 6, type: 'review' },
      { rating: 5, type: 'complaint' },
      { rating: 'abc', type: 'review' },
    ]);
    expect(agg.count).toBe(0);
    expect(agg.average).toBe(null);
  });
  it('arredonda a média para 1 casa decimal', () => {
    const agg = aggregateRatings([
      { rating: 5, type: 'review' },
      { rating: 4, type: 'review' },
      { rating: 4, type: 'review' },
    ]);
    expect(agg.average).toBe(4.3);
  });
});

describe('filterAndSortArenas', () => {
  const arenas = [
    { id: 'a', name: 'Arena B', city: 'Porto Alegre', state: 'RS', active: true },
    { id: 'b', name: 'Arena A', city: 'Porto Alegre', state: 'RS', active: true },
    { id: 'c', name: 'Arena C', city: 'Curitiba',     state: 'PR', active: false },
    { id: 'd', name: 'Arena D', city: 'São Paulo',    state: 'SP', active: true },
  ];
  it('filtra por cidade exata (lowercase)', () => {
    const result = filterAndSortArenas(arenas, { city: 'Porto Alegre' });
    expect(result.map((a) => a.id)).toEqual(['b', 'a']); // ordenado por nome
  });
  it('busca por texto em nome/cidade/estado/bairro', () => {
    const result = filterAndSortArenas(arenas, { search: 'paulo' });
    expect(result.map((a) => a.id)).toEqual(['d']);
  });
  it('omite arenas inativas', () => {
    const result = filterAndSortArenas(arenas);
    expect(result.find((a) => a.id === 'c')).toBeUndefined();
  });
  it('ordena por nome ascendente', () => {
    const result = filterAndSortArenas(arenas);
    expect(result.map((a) => a.name)).toEqual(['Arena A', 'Arena B', 'Arena D']);
  });
  it('lida com lista vazia e entradas nulas', () => {
    expect(filterAndSortArenas([])).toEqual([]);
    expect(filterAndSortArenas([null, undefined, { id: 'x', name: 'X', active: true }]))
      .toEqual([{ id: 'x', name: 'X', active: true }]);
  });
});
