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

  it('o pé do saque em revisão segue "em revisão" com o quique do saque, mais novo, já na lista', () => {
    const pe = { kind: 'serve_foot', call: 'review', decided: false, t_ms: now - 5000 };
    const quique = { kind: 'bounce', call: 'in', decided: false, serve: true, t_ms: now - 4100 };
    const s = telaoLineStatus({ positions: [], lances: [quique, pe], nowMs: now });
    expect(s.inReview).toBe(pe);
    expect(s.headline).toBe(pe);
  });

  it('o lance grande é a falta do pé, não o "Saque: dentro" que chegou depois', () => {
    const falta = { kind: 'serve_foot', call: 'fault', decided: false, t_ms: now - 5000 };
    const dentro = { kind: 'bounce', call: 'in', decided: false, serve: true, t_ms: now - 4100 };
    expect(telaoLineStatus({ positions: [], lances: [dentro, falta], nowMs: now }).headline).toBe(falta);
  });
});
