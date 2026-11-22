import { describe, expect, it } from 'vitest';
import {
  MAX_BRAND_PADDLES, brandItemId, isBrandItemLive, liveBrandPaddles, normalizeBrandCatalog, normalizeBrandPaddle, resolvePaddle,
} from './brandItems.js';
import { DEFAULT_RECIPE } from './recipe.js';

const acme = { brand: 'ACME', name: 'Pró 16', shape: 'elongated', art: 'split', color: '#FF0000', link_url: 'https://acme.example/pro' };

describe('raquetes de marca', () => {
  it('gera um id estável a partir da marca e do nome', () => {
    expect(brandItemId('ACME', 'Pró 16')).toBe('brand_acme-pro-16');
    expect(brandItemId('', '')).toBe('');
  });

  it('limpa o item: cores em hex, formato e arte do catálogo, texto sem marcação', () => {
    const item = normalizeBrandPaddle({ ...acme, brand: ' <b>ACME</b> ', art: 'foto', shape: 'redonda', color2: 'azul' });
    expect(item).toMatchObject({
      id: 'brand_bacme-b-pro-16', brand: 'bACME/b', shape: 'standard', art: 'wordmark', color: '#ff0000', color2: '#d4f82e', active: true,
    });
    expect(item.wordmark.length).toBeLessThanOrEqual(14);
  });

  it('sem marca ou sem nome não é item', () => {
    expect(normalizeBrandPaddle({ brand: 'ACME' })).toBeNull();
    expect(normalizeBrandPaddle({ name: 'Pro' })).toBeNull();
    expect(normalizeBrandPaddle(null)).toBeNull();
  });

  it('o link de saída só pode ser https', () => {
    expect(normalizeBrandPaddle(acme).link_url).toBe('https://acme.example/pro');
    for (const ruim of ['http://acme.example', 'javascript:alert(1)', 'https://a b', 'acme.example']) {
      expect(normalizeBrandPaddle({ ...acme, link_url: ruim }).link_url, ruim).toBe('');
    }
  });

  it('mantém o id já gravado (a receita das pessoas aponta para ele)', () => {
    expect(normalizeBrandPaddle({ ...acme, id: 'brand_antigo', name: 'Nome novo' }).id).toBe('brand_antigo');
    expect(normalizeBrandPaddle({ ...acme, id: '../x' }).id).toBe('brand_acme-pro-16');
  });

  it('a lista sai sem repetidos e dentro do teto', () => {
    expect(normalizeBrandCatalog([acme, acme, null, { brand: 'X' }])).toHaveLength(1);
    const muitos = Array.from({ length: MAX_BRAND_PADDLES + 5 }, (_, i) => ({ brand: 'M', name: `Modelo ${i}` }));
    expect(normalizeBrandCatalog(muitos)).toHaveLength(MAX_BRAND_PADDLES);
    expect(normalizeBrandCatalog('x')).toEqual([]);
  });

  it('no ar = ligado e dentro das datas', () => {
    const item = normalizeBrandPaddle({ ...acme, starts_ms: 1000, ends_ms: 2000 });
    expect(isBrandItemLive(item, 500)).toBe(false);
    expect(isBrandItemLive(item, 1500)).toBe(true);
    expect(isBrandItemLive(item, 2500)).toBe(false);
    expect(isBrandItemLive({ ...item, active: false }, 1500)).toBe(false);
    expect(liveBrandPaddles([{ ...acme, active: false }, { brand: 'B', name: 'Dois' }], 1)).toHaveLength(1);
  });
});

describe('resolvePaddle', () => {
  const item = normalizeBrandPaddle(acme);

  it('desenha a de marca quando a receita aponta para uma no ar', () => {
    const p = resolvePaddle({ ...DEFAULT_RECIPE, paddleBrand: item.id }, [item]);
    expect(p).toMatchObject({ shape: 'elongated', art: 'brand_split', color: '#ff0000', wordmark: 'ACME' });
    expect(p.brand).toBe(item);
  });

  it('sem a marca no ar, volta a raquete da própria pessoa', () => {
    const p = resolvePaddle({ ...DEFAULT_RECIPE, paddleBrand: item.id }, []);
    expect(p).toMatchObject({ shape: DEFAULT_RECIPE.paddleShape, art: DEFAULT_RECIPE.paddleArt, color: DEFAULT_RECIPE.paddleColor, brand: null });
  });
});
