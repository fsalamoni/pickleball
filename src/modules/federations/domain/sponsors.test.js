import { describe, it, expect } from 'vitest';
import { SPONSORS_MAX, sortSponsors, validateSponsors, visibleSponsors } from './sponsors.js';

describe('validateSponsors', () => {
  it('normaliza, recusa nome curto e links que não são https', () => {
    const r = validateSponsors([{ name: 'Acme', logo_url: 'https://x/l.png', url: 'https://acme.com', tier: 'main' }, { name: 'A', url: 'http://x' }]);
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['1.name', '1.url']);
    expect(r.value[0]).toEqual({ name: 'Acme', logo_url: 'https://x/l.png', url: 'https://acme.com', tier: 'main' });
    expect(r.value[1].tier).toBe('support');
  });
  it('corta em 12', () => {
    const r = validateSponsors(Array.from({ length: 13 }, (_, i) => ({ name: `P${i + 10}` })));
    expect(r.ok).toBe(false);
    expect(r.value).toHaveLength(SPONSORS_MAX);
  });
});

describe('sortSponsors / visibleSponsors', () => {
  const sponsors = [{ name: 'B', tier: 'partner' }, { name: 'A', tier: 'main' }, { name: 'C', tier: 'support' }];
  it('oficial → apoio → parceiro', () => {
    expect(sortSponsors(sponsors).map((s) => s.name)).toEqual(['A', 'C', 'B']);
  });
  it('só saem com o módulo ligado', () => {
    const f = { status: 'approved', sponsors, modules: {} };
    expect(visibleSponsors(f)).toEqual([]);
    expect(visibleSponsors({ ...f, modules: { sponsors: true } }).map((s) => s.name)).toEqual(['A', 'C', 'B']);
  });
});
