import { describe, it, expect } from 'vitest';
import { FUNNEL_EVENT, sanitizeFunnelParams } from './funnelEvents.js';

describe('FUNNEL_EVENT', () => {
  it('tem nomes únicos e prefixados', () => {
    const values = Object.values(FUNNEL_EVENT);
    expect(new Set(values).size).toBe(values.length);
    values.forEach((v) => expect(v.startsWith('funnel_')).toBe(true));
  });
});

describe('sanitizeFunnelParams', () => {
  it('mantém primitivos e descarta o resto', () => {
    const out = sanitizeFunnelParams({
      a: 'x',
      n: 3,
      b: true,
      nil: null,
      obj: { y: 1 },
      undef: undefined,
      nan: NaN,
    });
    expect(out).toEqual({ a: 'x', n: 3, b: true });
  });

  it('limita strings a 100 caracteres', () => {
    expect(sanitizeFunnelParams({ s: 'x'.repeat(200) }).s).toHaveLength(100);
  });

  it('tolera entrada vazia', () => {
    expect(sanitizeFunnelParams()).toEqual({});
  });
});
