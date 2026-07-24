import { describe, it, expect } from 'vitest';
import { buildMeta, BRAND } from './meta.js';

describe('buildMeta', () => {
  it('acrescenta a marca ao título e usa descrição padrão', () => {
    const m = buildMeta({ title: 'Open de Floripa' });
    expect(m.title).toBe(`Open de Floripa · ${BRAND}`);
    expect(m.ogTitle).toBe('Open de Floripa');
    expect(m.description).toContain('pickleball');
  });

  it('usa só a marca quando não há título', () => {
    expect(buildMeta({}).title).toBe(BRAND);
    expect(buildMeta({}).ogTitle).toBe(BRAND);
  });

  it('trunca título e descrição longos', () => {
    const m = buildMeta({ title: 'x'.repeat(120), description: 'y'.repeat(300) });
    expect(m.title.length).toBeLessThanOrEqual(60 + ` · ${BRAND}`.length);
    expect(m.description.length).toBeLessThanOrEqual(160);
    expect(m.description.endsWith('…')).toBe(true);
  });

  it('normaliza espaços', () => {
    expect(buildMeta({ title: '  Copa   Verão  ' }).ogTitle).toBe('Copa Verão');
  });

  it('propaga imagem e url', () => {
    const m = buildMeta({ title: 'X', image: 'https://x/i.png', url: 'https://x/p/1' });
    expect(m.image).toBe('https://x/i.png');
    expect(m.url).toBe('https://x/p/1');
  });
});
