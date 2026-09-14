/**
 * A marca da arena.
 *
 * O que estes testes protegem:
 *  1. ⭐ a cor inválida não quebra a tela;
 *  2. ⭐ o texto continua legível em cima de QUALQUER cor escolhida — inclusive
 *     das escolhidas errado;
 *  3. arena sem marca devolve um objeto utilizável, não `undefined`.
 */
import { describe, it, expect } from 'vitest';

import {
  BRAND_DEFAULT_COLOR, BRAND_TAGLINE_MAX,
  brandingOf, luminance, normalizeBranding, normalizeHex, readableInk,
} from './whiteLabel.js';

describe('normalizeHex', () => {
  it('aceita 6 dígitos e normaliza para minúsculo', () => {
    expect(normalizeHex('#1D4ED8')).toBe('#1d4ed8');
  });
  it('expande a forma curta', () => {
    expect(normalizeHex('#abc')).toBe('#aabbcc');
  });
  it('recusa o que não é cor', () => {
    expect(normalizeHex('azul')).toBeNull();
    expect(normalizeHex('#12345')).toBeNull();
    expect(normalizeHex('')).toBeNull();
    expect(normalizeHex(null)).toBeNull();
  });
});

describe('⭐ readableInk — o nome da arena não some na própria página', () => {
  it('cor clara pede texto escuro', () => {
    expect(readableInk('#FFFFFF')).toBe('#0B0B0C');
    expect(readableInk('#F5E663')).toBe('#0B0B0C');   // amarelo-limão
  });
  it('cor escura pede texto claro', () => {
    expect(readableInk('#000000')).toBe('#FFFFFF');
    expect(readableInk('#1d4ed8')).toBe('#FFFFFF');
  });
  it('cor inválida cai no escuro da plataforma, que pede texto claro', () => {
    expect(readableInk('azul')).toBe('#FFFFFF');
  });
});

describe('luminance', () => {
  it('preto é 0 e branco é 1', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#ffffff')).toBeCloseTo(1, 5);
  });
  it('cresce do escuro para o claro', () => {
    expect(luminance('#333333')).toBeLessThan(luminance('#cccccc'));
  });
});

describe('normalizeBranding', () => {
  it('guarda cor, logo e assinatura', () => {
    const { valid, value } = normalizeBranding({
      primary_color: '#1D4ED8', logo_url: 'https://x.com/l.png', tagline: 'Jogue aqui',
    });
    expect(valid).toBe(true);
    expect(value).toMatchObject({
      primary_color: '#1d4ed8', logo_url: 'https://x.com/l.png', tagline: 'Jogue aqui', active: true,
    });
  });

  it('⭐ cor inválida é ERRO, mas o valor cai no padrão em vez de ficar vazio', () => {
    const r = normalizeBranding({ primary_color: 'azul' });
    expect(r.valid).toBe(false);
    expect(r.value.primary_color).toBe(BRAND_DEFAULT_COLOR);
  });

  it('⭐ logo sem https é recusado — e não é gravado', () => {
    const r = normalizeBranding({ logo_url: 'javascript:alert(1)' });
    expect(r.valid).toBe(false);
    expect(r.value.logo_url).toBe('');
  });

  it(`a assinatura para em ${BRAND_TAGLINE_MAX} caracteres`, () => {
    const { value } = normalizeBranding({ tagline: 'a'.repeat(200) });
    expect(value.tagline.length).toBe(BRAND_TAGLINE_MAX);
  });

  it('sem nada informado, vale o padrão da plataforma', () => {
    const { valid, value } = normalizeBranding({});
    expect(valid).toBe(true);
    expect(value.primary_color).toBe(BRAND_DEFAULT_COLOR);
  });
});

describe('brandingOf', () => {
  it('⭐ arena sem marca devolve objeto utilizável, com `on: false`', () => {
    const b = brandingOf({ id: 'a1' });
    expect(b.on).toBe(false);
    expect(b.color).toBe(BRAND_DEFAULT_COLOR);
    expect(b.ink).toBe('#FFFFFF');
    expect(b.logo).toBe('');
  });

  it('arena com cor liga a marca e calcula o contraste', () => {
    const b = brandingOf({ branding: { primary_color: '#F5E663' } });
    expect(b.on).toBe(true);
    expect(b.color).toBe('#f5e663');
    expect(b.ink).toBe('#0B0B0C');
  });

  it('arena só com logo também liga', () => {
    expect(brandingOf({ branding: { logo_url: 'https://x/l.png' } }).on).toBe(true);
  });

  it('⭐ marca desligada não pinta nada', () => {
    const b = brandingOf({ branding: { primary_color: '#1d4ed8', active: false } });
    expect(b.on).toBe(false);
  });

  it('null não derruba a conta', () => {
    expect(brandingOf(null).on).toBe(false);
  });
});
