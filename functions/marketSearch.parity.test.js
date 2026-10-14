/**
 * PARIDADE cliente × servidor da busca do Mercado: o aviso da busca salva
 * (servidor) e a tela "Buscas salvas" (cliente) têm de achar os MESMOS
 * anúncios novos.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { filterListings, filtersFromParams, textMatchScore } from '@/modules/marketplace/domain/search.js';
import { normalizeSearchText, tokenize } from '@/modules/marketplace/domain/listing.js';
import { savedSearchMatches, savedSearchSince } from '@/modules/marketplace/domain/discovery.js';

const require = createRequire(import.meta.url);
const s = require('./marketSearch.js');

const dia = 86400000;
const agora = Date.UTC(2026, 9, 14, 12);
const LISTINGS = [
  { id: '1', status: 'active', quantity: 1, title: 'Raquete JOOLA Perseus', category_path: ['raquetes', 'raquete-controle'], type: 'product_used', price_cents: 80000, seller_type: 'athlete', fulfillment: ['meetup'], state: 'SP', city: 'São Paulo', attributes: { core_mm: '16' }, search_terms: ['raquete', 'joola'], accepts_offers: true, published_at: agora - dia, created_by: 'u1' },
  { id: '2', status: 'active', quantity: 3, title: 'Bola Franklin X-40 (6 un.)', category_path: ['bolas'], type: 'product_new', price_cents: 9000, seller_type: 'store', fulfillment: ['shipping', 'pickup'], state: 'RJ', city: 'Niterói', published_at: agora - 3 * dia, created_by: 'u2' },
  { id: '3', status: 'sold_out', quantity: 0, title: 'Raquete Selkirk Vanguard', category_path: ['raquetes'], type: 'product_new', price_cents: 120000, seller_type: 'arena', fulfillment: ['pickup'], state: 'SP', city: 'Campinas', published_at: agora - 2 * dia },
  { id: '4', status: 'active', quantity: 2, title: 'Tênis de quadra', description: 'Ótimo para pickleball, número 42', category_path: ['calcados'], type: 'product_used', price_cents: 25000, seller_type: 'coach', fulfillment: ['meetup', 'shipping'], state: 'sp', city: 'sao paulo', created_at_ms: agora - 5 * dia },
  { id: '5', status: 'paused', quantity: 1, title: 'Raquete pausada', category_path: ['raquetes'], type: 'product_new', price_cents: 50000, published_at: agora },
  { id: '6', status: 'active', quantity: 0, title: 'Raquete esgotada mas ativa', category_path: ['raquetes'], type: 'product_new', price_cents: 50000, published_at: agora },
];
const BUSCAS = [
  '', 'q=raquete', 'q=Ráquete+joola', 'cat=raquetes', 'estado=used', 'estado=new&uf=sp', 'min=100&max=900',
  'vende=store,coach', 'entrega=shipping', 'oferta=1', 'cidade=S%C3%A3o+Paulo', 'cat=raquetes&a_core_mm=16',
  'q=pickleball', 'q=de+para', 'max=abc&vende=hacker', 'q=tenis&estado=used&entrega=meetup',
];

describe('paridade: busca do Mercado', () => {
  it('texto normalizado e palavras iguais', () => {
    ['Raquete JOOLA Pérola!', 'de para a bola', '  Tênis 42 '].forEach((t) => {
      expect(s.normalizeSearchText(t)).toBe(normalizeSearchText(t));
      expect(s.tokenize(t)).toEqual(tokenize(t));
    });
  });

  it('⭐ os mesmos anúncios em toda busca', () => {
    BUSCAS.forEach((b) => {
      const fc = filtersFromParams(new URLSearchParams(b));
      const fs = s.filtersFromParams(b);
      expect(s.filterListings(LISTINGS, fs).map((l) => l.id), b).toEqual(filterListings(LISTINGS, fc).map((l) => l.id));
      LISTINGS.forEach((l) => expect(s.textMatchScore(l, fc.q), `${b}/${l.id}`).toBe(textMatchScore(l, fc.q)));
    });
  });

  it('⭐ as mesmas novidades da busca salva', () => {
    BUSCAS.forEach((b) => [0, agora - 2 * dia, agora - 4 * dia].forEach((since) => ['', 'u1'].forEach((uid) => {
      expect(s.savedSearchMatches(LISTINGS, b, { since, uid }).map((l) => l.id), `${b}/${since}/${uid}`)
        .toEqual(savedSearchMatches(LISTINGS, b, { since, uid }).map((l) => l.id));
    })));
    const busca = { last_seen_ms: 10, created_at: { toMillis: () => 50 } };
    expect(s.savedSearchSince(busca)).toBe(savedSearchSince(busca));
  });
});
