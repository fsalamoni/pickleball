import { describe, it, expect } from 'vitest';
import { telaoLineStatus } from './fusion.js';

describe('telaoLineStatus', () => {
  const now = 100000;
  const cam = (position, analyzing) => ({ position, analyzing, seen_ms: now - 1000 });

  it('conta só quem está analisando e aponta as posições paradas', () => {
    const s = telaoLineStatus({ positions: ['fundo_a', 'fundo_b'], cams: [cam('fundo_a', true), cam('fundo_b', false)], lances: [], nowMs: now });
    expect(s).toMatchObject({ total: 2, analyzing: 1, down: ['fundo_b'], ready: false, inReview: null });
  });

  it('todas analisando = pronto', () => {
    expect(telaoLineStatus({ positions: ['fundo_a'], cams: [cam('fundo_a', true)], nowMs: now }).ready).toBe(true);
  });

  it('último lance "revisar" sem decisão fica em revisão por um tempo', () => {
    const l = { call: 'review', decided: false, t_ms: now - 5000 };
    expect(telaoLineStatus({ positions: [], lances: [l], nowMs: now }).inReview).toBe(l);
    expect(telaoLineStatus({ positions: [], lances: [{ ...l, decided: true }], nowMs: now }).inReview).toBeNull();
    expect(telaoLineStatus({ positions: [], lances: [{ ...l, t_ms: now - 200000 }], nowMs: now }).inReview).toBeNull();
  });
});
