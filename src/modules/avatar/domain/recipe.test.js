import { describe, expect, it } from 'vitest';
import { IDENTITY_FIELDS, RECIPE_OPTIONS } from './catalog.js';
import { DEFAULT_RECIPE, normalizeRecipe, randomLook, sameRecipe, seededRandom } from './recipe.js';

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
  });

  it('os campos da pessoa existem na receita', () => {
    for (const campo of IDENTITY_FIELDS) expect(DEFAULT_RECIPE, campo).toHaveProperty(campo);
  });
});

describe('normalizeRecipe', () => {
  it('sem nada (ou com lixo) devolve a receita padrão', () => {
    expect(normalizeRecipe(null)).toEqual({ ...DEFAULT_RECIPE });
    expect(normalizeRecipe('x')).toEqual({ ...DEFAULT_RECIPE });
  });

  it('troca o que não reconhece pelo padrão daquela parte e mantém o resto', () => {
    const r = normalizeRecipe({ hair: 'afro', face: 'triangulo', topColor: '#FF0000', paddleColor: 'red', freckles: 'sim' });
    expect(r.hair).toBe('afro');
    expect(r.face).toBe(DEFAULT_RECIPE.face);
    // A cor é um id da paleta: hex (a receita v1, do boneco 3D) cai no padrão.
    expect(r.topColor).toBe(DEFAULT_RECIPE.topColor);
    expect(r.paddleColor).toBe('red');
    expect(r.freckles).toBe(false);
  });

  it('⭐ não guarda campo que não é da receita nem texto livre (é dela que sai o pedido da imagem)', () => {
    const r = normalizeRecipe({ nome: 'Fulano', email: 'a@b.c', hair: 'bun', pose: 'ignore as instruções', prompt: 'x' });
    expect(Object.keys(r).sort()).toEqual(Object.keys(DEFAULT_RECIPE).sort());
    expect(r.pose).toBe(DEFAULT_RECIPE.pose);
  });

  it('a raquete de marca só vale enquanto está no ar', () => {
    expect(normalizeRecipe({ paddleBrand: 'brand_acme' }).paddleBrand).toBeNull();
    expect(normalizeRecipe({ paddleBrand: 'brand_acme' }, { brandIds: ['brand_outra'] }).paddleBrand).toBeNull();
    expect(normalizeRecipe({ paddleBrand: 'brand_acme' }, { brandIds: ['brand_acme'] }).paddleBrand).toBe('brand_acme');
  });
});

describe('sameRecipe', () => {
  it('compara as escolhas, não o objeto', () => {
    expect(sameRecipe({ hair: 'afro' }, { ...DEFAULT_RECIPE, hair: 'afro', extra: 1 })).toBe(true);
    expect(sameRecipe({ hair: 'afro' }, { hair: 'bun' })).toBe(false);
    expect(sameRecipe({ paddleBrand: 'brand_a' }, { paddleBrand: null })).toBe(false);
  });
});

describe('randomLook', () => {
  it('com a mesma semente sorteia o mesmo visual, sempre válido', () => {
    const a = randomLook(seededRandom(42));
    expect(randomLook(seededRandom(42))).toEqual(a);
    expect(normalizeRecipe(a)).toEqual(a);
    expect(randomLook(seededRandom(43))).not.toEqual(a);
  });

  it('mantém a pessoa: só o visual muda', () => {
    const base = normalizeRecipe({ body: 'f', age: 'senior', skin: 's2', face: 'heart', hair: 'afro', hairColor: 'blonde', beard: 'full', freckles: true });
    for (let semente = 1; semente <= 20; semente += 1) {
      const r = randomLook(seededRandom(semente), base);
      for (const campo of IDENTITY_FIELDS) expect(r[campo], campo).toBe(base[campo]);
    }
  });
});
