/**
 * A paleta do modo escuro — o que protege:
 *
 *  1. ⭐ o modo CLARO não muda um pixel: com o interruptor em 0, TODO token de
 *     TODO grupo dá exatamente a cor da paleta original (Tailwind + marca);
 *  2. ⭐ o modo ESCURO passa no contraste WCAG AA onde se lê texto — o texto
 *     principal, o secundário, o de metadado, o colorido sobre a tinta da
 *     mesma cor, o branco e o ácido sobre a superfície de destaque;
 *  3. as camadas do escuro sobem em ordem (página < cartão < realces <
 *     destaque) e as bordas se distinguem do cartão;
 *  4. quem é superfície neutra e quem é superfície de cor.
 */
import { describe, it, expect } from 'vitest';
import twColors from 'tailwindcss/colors.js';
import {
  BRAND, DARK, NEUTRAL_FAMILIES, COLOR_FAMILIES, SHADES, SURFACE,
  tokenPairs, themeColors, colorExpression, evaluateExpression, surfaceKind, alphaPercent,
  contrast, luminance, mix, hexToHslTriplet,
} from './palette.js';

const GROUPS = ['bg', 'fg', 'line'];
const escuro = (group, token) => {
  const p = tokenPairs(group)[token];
  return (p.dark || p.light).toLowerCase();
};

describe('⭐ o modo claro é idêntico ao de sempre', () => {
  it('todo token, de todo grupo, com o interruptor em 0 dá a cor original', () => {
    const esperado = (token) => {
      if (token === 'white') return '#ffffff';
      if (token === 'black') return '#000000';
      const brand = /^(ink|paper|acid)(?:-(.+))?$/.exec(token);
      if (brand) return BRAND[brand[1]][brand[2] || 'DEFAULT'].toLowerCase();
      const [family, shade] = token.split('-');
      return twColors[family][shade].toLowerCase();
    };
    for (const group of GROUPS) {
      for (const [token, par] of Object.entries(tokenPairs(group))) {
        const expr = colorExpression(par.light, par.dark, '--k');
        expect(evaluateExpression(expr, 0), `${group}:${token}`).toBe(esperado(token));
      }
    }
  });

  it('o tema do Tailwind cobre a marca e todas as famílias, em todos os tons', () => {
    for (const group of GROUPS) {
      const t = themeColors(group);
      expect(Object.keys(t.ink)).toEqual(['DEFAULT', 'light', 'lighter']);
      expect(Object.keys(t.paper)).toEqual(['DEFAULT', 'pure', 'dark']);
      for (const family of [...NEUTRAL_FAMILIES, ...COLOR_FAMILIES]) {
        expect(Object.keys(t[family])).toEqual(SHADES);
        for (const shade of SHADES) expect(t[family][shade]).toMatch(/<alpha-value>\)$/);
      }
    }
  });

  it('o que não muda é estático; o que muda usa o interruptor certo', () => {
    expect(themeColors('fg').white).toBe('rgb(255 255 255 / <alpha-value>)');
    expect(themeColors('bg').acid.DEFAULT).toBe('rgb(212 248 46 / <alpha-value>)');
    expect(themeColors('bg').white).toContain('var(--k)');
    expect(themeColors('fg').ink.DEFAULT).toContain('var(--kf)');
    expect(themeColors('line').gray['200']).toContain('var(--kf)');
  });

  it('a expressão avaliada em 1 dá exatamente o valor escuro', () => {
    for (const group of GROUPS) {
      for (const [token, par] of Object.entries(tokenPairs(group))) {
        if (!par.dark) continue;
        expect(evaluateExpression(colorExpression(par.light, par.dark), 1), `${group}:${token}`).toBe(par.dark.toLowerCase());
      }
    }
  });
});

describe('⭐ contraste do modo escuro (WCAG AA)', () => {
  const superficies = { página: DARK.page, cartão: DARK.surface, realce: DARK.raised, 'realce 2': DARK.raised2 };

  it('texto principal (text-ink): ≥ 12 em qualquer superfície neutra', () => {
    for (const [nome, fundo] of Object.entries(superficies)) {
      expect(contrast(escuro('fg', 'ink'), fundo), nome).toBeGreaterThanOrEqual(12);
    }
  });

  it('texto secundário (gray-500) e de metadado (gray-400): ≥ 4,5', () => {
    for (const [nome, fundo] of Object.entries(superficies)) {
      expect(contrast(escuro('fg', 'gray-500'), fundo), `500 em ${nome}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(escuro('fg', 'gray-400'), fundo), `400 em ${nome}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('texto cinza forte (600/700) é mais forte que o secundário', () => {
    const c = (t) => contrast(escuro('fg', t), DARK.surface);
    expect(c('gray-600')).toBeGreaterThan(c('gray-500'));
    expect(c('gray-700')).toBeGreaterThan(c('gray-600'));
    expect(c('gray-500')).toBeGreaterThan(c('gray-400'));
    expect(c('gray-600')).toBeGreaterThanOrEqual(7);
  });

  it('⭐ o texto colorido é legível sobre a tinta da MESMA cor (o selo "verde")', () => {
    for (const family of COLOR_FAMILIES) {
      for (const texto of ['500', '600', '700', '800']) {
        for (const fundo of ['50', '100']) {
          const c = contrast(escuro('fg', `${family}-${texto}`), escuro('bg', `${family}-${fundo}`));
          expect(c, `text-${family}-${texto} em bg-${family}-${fundo}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('texto colorido direto no cartão: ≥ 4,5', () => {
    for (const family of COLOR_FAMILIES) {
      for (const texto of ['500', '600', '700']) {
        expect(contrast(escuro('fg', `${family}-${texto}`), DARK.surface), `${family}-${texto}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('a superfície de destaque (bg-ink): branco e verde-ácido legíveis', () => {
    expect(contrast('#ffffff', escuro('bg', 'ink'))).toBeGreaterThanOrEqual(7);
    expect(contrast(BRAND.acid.DEFAULT, escuro('bg', 'ink'))).toBeGreaterThanOrEqual(7);
    expect(contrast(BRAND.acid.DEFAULT, DARK.page)).toBeGreaterThanOrEqual(12);
  });

  it('a ação principal (acid + ink) não muda: o texto continua ink', () => {
    expect(contrast(BRAND.ink.DEFAULT, BRAND.acid.DEFAULT)).toBeGreaterThanOrEqual(12);
  });
});

describe('camadas e linhas do escuro', () => {
  it('as camadas sobem em ordem: página < cartão < realces < destaque', () => {
    const ordem = [DARK.page, DARK.surface, DARK.raised, DARK.raised2, DARK.raised3, DARK.strong, DARK.strongHover];
    for (let i = 1; i < ordem.length; i += 1) {
      expect(luminance(ordem[i]), `${ordem[i - 1]} < ${ordem[i]}`).toBeGreaterThan(luminance(ordem[i - 1]));
    }
  });

  it('o recuo (bg-paper) é mais fundo que o cartão (bg-white) — como no claro', () => {
    expect(luminance(escuro('bg', 'paper'))).toBeLessThan(luminance(escuro('bg', 'white')));
    expect(escuro('bg', 'paper-pure')).toBe(escuro('bg', 'white'));
  });

  it('a borda se distingue do cartão, e a forte (ink) grita', () => {
    expect(contrast(escuro('line', 'gray-100'), DARK.surface)).toBeGreaterThan(1.15);
    expect(contrast(escuro('line', 'gray-200'), DARK.surface)).toBeGreaterThan(contrast(escuro('line', 'gray-100'), DARK.surface));
    expect(contrast(escuro('line', 'ink'), DARK.surface)).toBeGreaterThanOrEqual(7);
  });

  it('o destaque (bg-ink) se destaca do cartão', () => {
    expect(contrast(escuro('bg', 'ink'), DARK.surface)).toBeGreaterThan(1.35);
  });
});

describe('superfícies', () => {
  it('neutras: cartão, papel, cinzas claros e as tintas de cor', () => {
    for (const t of ['white', 'paper', 'paper-pure', 'paper-dark', 'gray-50', 'gray-100', 'slate-300', 'amber-50', 'red-100', 'green-200']) {
      expect(surfaceKind(t), t).toBe(SURFACE.NEUTRAL);
    }
  });

  it('de cor: ink, ácido, preto, cores saturadas e cinzas escuros', () => {
    for (const t of ['ink', 'ink-light', 'acid', 'acid-light', 'black', 'green-600', 'amber-400', 'red-500', 'blue-300', 'gray-700']) {
      expect(surfaceKind(t), t).toBe(SURFACE.ON_COLOR);
    }
  });

  it('o resto não mexe', () => {
    expect(surfaceKind('transparent')).toBeNull();
    expect(surfaceKind('background')).toBeNull();
    expect(surfaceKind('foo-100')).toBeNull();
  });

  it('opacidade do modificador', () => {
    expect(alphaPercent(null)).toBe(100);
    expect(alphaPercent('80')).toBe(80);
    expect(alphaPercent('[.15]')).toBe(15);
    expect(alphaPercent('[0.5]')).toBe(50);
    expect(alphaPercent('nada')).toBe(100);
  });
});

describe('aritmética', () => {
  it('mistura e HSL', () => {
    expect(mix('#ffffff', '#000000', 0.5)).toBe('#808080');
    expect(mix('#ff0000', '#000000', 0)).toBe('#000000');
    expect(hexToHslTriplet('#ffffff')).toBe('0 0% 100%');
    expect(hexToHslTriplet('#000000')).toBe('0 0% 0%');
  });
});
