import { describe, it, expect } from 'vitest';
import { makeTrial, precisionReport, bandOf, MIN_PER_BAND } from './precisionTest';

const lance = (call, margin) => ({ call, best: { margin_m: margin } });

describe('teste de precisão (estilo ITF Bronze)', () => {
  it('a marca dentro pede "dentro"; o "revisar" fica separado do erro', () => {
    expect(makeTrial(0.02, lance('in', 0.018)).result).toBe('right');
    expect(makeTrial(-0.02, lance('in', 0.005)).result).toBe('wrong');
    expect(makeTrial(-0.02, lance('review', -0.004)).result).toBe('review');
    expect(makeTrial(0.05, { call: 'in' }).measured).toBeNull();
  });

  it('faixas: até 25 mm e de 25 a 100 mm', () => {
    expect(bandOf(0.02)).toBe('near');
    expect(bandOf(-0.025)).toBe('near');
    expect(bandOf(0.05)).toBe('mid');
    expect(bandOf(-0.1)).toBe('mid');
  });

  it('sem lances bastantes em cada faixa não dá veredito', () => {
    expect(precisionReport([makeTrial(0.02, lance('in', 0.02))]).verdict).toBe('insufficient');
  });

  it('bate a meta das duas faixas = nível Bronze; erro médio em cm', () => {
    const near = Array.from({ length: MIN_PER_BAND }, (_, i) => makeTrial(0.02, lance(i < 8 ? 'in' : 'review', 0.03)));
    const mid = Array.from({ length: MIN_PER_BAND }, (_, i) => makeTrial(-0.05, lance(i < 9 ? 'out' : 'in', -0.04)));
    const r = precisionReport([...near, ...mid]);
    expect(r.bands.map((b) => [b.id, b.pct, b.ok])).toEqual([['near', 0.8, true], ['mid', 0.9, true]]);
    expect(r.verdict).toBe('bronze');
    expect(r.meanErrorCm).toBe(1);
    const fraco = precisionReport([...near.map((t, i) => (i < 4 ? { ...t, result: 'wrong' } : t)), ...mid]);
    expect(fraco.verdict).toBe('below');
  });
});
