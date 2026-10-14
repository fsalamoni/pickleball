import { describe, it, expect } from 'vitest';
import { marketHomeSummary } from './home';

describe('marketHomeSummary', () => {
  it('mostra só os pedidos em que a vez é do comprador, e conta os abertos', () => {
    const orders = [
      { id: 'a', status: 'accepted' },
      { id: 'b', status: 'placed' },
      { id: 'c', status: 'completed' },
      { id: 'd', status: 'ready' },
    ];
    const r = marketHomeSummary({ orders });
    expect(r.pendentes.map((p) => p.order.id)).toEqual(['a', 'd']);
    expect(r.pendentes[0].texto).toBe('Pague pelo Pix e avise.');
    expect(r.emAndamento).toBe(3);
  });

  it('novidades: no ar, com estoque, mais novas primeiro, sem as da própria pessoa', () => {
    const listings = [
      { id: 'velho', status: 'active', quantity: 1, created_at_ms: 1 },
      { id: 'meu', status: 'active', quantity: 1, created_at_ms: 9, created_by: 'eu' },
      { id: 'novo', status: 'active', quantity: 2, created_at_ms: 5 },
      { id: 'esgotado', status: 'sold_out', quantity: 0, created_at_ms: 8 },
    ];
    expect(marketHomeSummary({ listings, uid: 'eu' }).novidades.map((l) => l.id)).toEqual(['novo', 'velho']);
  });
});
