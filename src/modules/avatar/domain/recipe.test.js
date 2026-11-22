import { describe, expect, it } from 'vitest';
import { RECIPE_COLOR_FIELDS, RECIPE_OPTIONS } from './catalog.js';
import { DEFAULT_RECIPE, normalizeRecipe, randomRecipe, sameRecipe, seededRandom } from './recipe.js';

describe('catálogo do avatar', () => {
  it('não repete id dentro de uma lista e toda opção tem rótulo', () => {
    for (const [campo, lista] of Object.entries(RECIPE_OPTIONS)) {
      const ids = lista.map((o) => o.id);
      expect(new Set(ids).size, campo).toBe(ids.length);
      for (const o of lista) expect(typeof o.label, `${campo}.${o.id}`).toBe('string');
    }
  });

  it('a receita padrão só usa o que existe no catálogo', () => {
    for (const [campo, lista] of Object.entries(RECIPE_OPTIONS)) {
      expect(lista.some((o) => o.id === DEFAULT_RECIPE[campo]), campo).toBe(true);
    }
    for (const campo of RECIPE_COLOR_FIELDS) expect(DEFAULT_RECIPE[campo], campo).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('normalizeRecipe', () => {
  it('sem nada (ou com lixo) devolve a receita padrão', () => {
    expect(normalizeRecipe(null)).toEqual({ ...DEFAULT_RECIPE });
    expect(normalizeRecipe('x')).toEqual({ ...DEFAULT_RECIPE });
  });

  it('troca o que não reconhece pelo padrão daquela parte e mantém o resto', () => {
    const r = normalizeRecipe({ hair: 'afro', face: 'triangulo', topColor: '#FF0000', paddleColor: 'red', cheeks: 'sim', freckles: true });
    expect(r.hair).toBe('afro');
    expect(r.face).toBe(DEFAULT_RECIPE.face);
    expect(r.topColor).toBe('#ff0000');
    expect(r.paddleColor).toBe(DEFAULT_RECIPE.paddleColor);
    expect(r.cheeks).toBe(DEFAULT_RECIPE.cheeks);
    expect(r.freckles).toBe(true);
  });

  it('não guarda campo que não é da receita (nada pessoal entra)', () => {
    const r = normalizeRecipe({ nome: 'Fulano', email: 'a@b.c', hair: 'bun' });
    expect(Object.keys(r).sort()).toEqual(Object.keys(DEFAULT_RECIPE).sort());
  });

  it('o número do peito tem até dois dígitos', () => {
    expect(normalizeRecipe({ chestNumber: '123' }).chestNumber).toBe('12');
    expect(normalizeRecipe({ chestNumber: 9 }).chestNumber).toBe('9');
    expect(normalizeRecipe({ chestNumber: '<b>' }).chestNumber).toBe(DEFAULT_RECIPE.chestNumber);
  });

  it('a raquete de marca só vale enquanto está no ar', () => {
    expect(normalizeRecipe({ paddleBrand: 'brand_acme' }).paddleBrand).toBeNull();
    expect(normalizeRecipe({ paddleBrand: 'brand_acme' }, { brandIds: ['brand_outra'] }).paddleBrand).toBeNull();
    expect(normalizeRecipe({ paddleBrand: 'brand_acme' }, { brandIds: ['brand_acme'] }).paddleBrand).toBe('brand_acme');
  });
});

describe('sameRecipe', () => {
  it('compara o desenho, não o objeto', () => {
    expect(sameRecipe({ hair: 'afro' }, { ...DEFAULT_RECIPE, hair: 'afro', extra: 1 })).toBe(true);
    expect(sameRecipe({ hair: 'afro' }, { hair: 'bun' })).toBe(false);
  });
});

describe('randomRecipe', () => {
  it('com a mesma semente sorteia o mesmo avatar, sempre válido', () => {
    const a = randomRecipe(seededRandom(42));
    const b = randomRecipe(seededRandom(42));
    expect(a).toEqual(b);
    expect(normalizeRecipe(a)).toEqual(a);
    expect(randomRecipe(seededRandom(43))).not.toEqual(a);
  });

  it('"só o visual" mantém rosto, pele e cabelo', () => {
    const base = normalizeRecipe({ skin: 's2', face: 'heart', hair: 'afro', hairColor: 'blonde', beard: 'full', eyes: 'almond' });
    for (let semente = 1; semente <= 20; semente += 1) {
      const r = randomRecipe(seededRandom(semente), { base, only: 'look' });
      for (const campo of ['skin', 'face', 'hair', 'hairColor', 'beard', 'eyes', 'eyeColor', 'brows', 'nose']) {
        expect(r[campo], campo).toBe(base[campo]);
      }
    }
  });
});
