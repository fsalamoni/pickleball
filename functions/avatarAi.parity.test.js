/**
 * PARIDADE cliente × servidor do AVATAR: os ids do catálogo da tela são os
 * mesmos que o servidor sabe traduzir no pedido da imagem, a receita padrão é
 * a mesma e as duas normalizações devolvem o mesmo. Opção nova num lado só
 * reprova: na tela ela apareceria e o servidor a trocaria pelo padrão, calado.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { IDENTITY_FIELDS, PADDLE_SHAPES, RECIPE_OPTIONS } from '@/modules/avatar/domain/catalog.js';
import { DEFAULT_RECIPE, normalizeRecipe } from '@/modules/avatar/domain/recipe.js';
import { AI_DEFAULT_CONFIG, AI_QUALITIES } from '@/modules/avatar/domain/aiConfig.js';

const require = createRequire(import.meta.url);
const s = require('./avatarAiPolicy.js');

describe('paridade do avatar por IA', () => {
  it('os mesmos campos e os mesmos ids nos dois lados', () => {
    expect(Object.keys(s.FRAG).sort()).toEqual(Object.keys(RECIPE_OPTIONS).sort());
    for (const [campo, lista] of Object.entries(RECIPE_OPTIONS)) {
      expect(Object.keys(s.FRAG[campo]).sort(), campo).toEqual(lista.map((o) => o.id).sort());
    }
  });

  it('a mesma receita padrão e os mesmos campos da pessoa', () => {
    expect(s.DEFAULT_RECIPE).toEqual({ ...DEFAULT_RECIPE });
    expect([...s.IDENTITY_FIELDS]).toEqual([...IDENTITY_FIELDS]);
  });

  it('as duas normalizações devolvem o mesmo', () => {
    const casos = [
      null, {}, { hair: 'afro', top: 'dress', freckles: true }, { hair: 'x', pose: 'constructor', topColor: '#ff0000' },
      { paddleBrand: 'brand_a' }, { body: 'f', age: 'senior', frame: 'full', headwear: 'none', glasses: 'sport' },
    ];
    for (const caso of casos) {
      for (const brandIds of [undefined, ['brand_a']]) {
        expect(s.normalizeRecipe(caso, { brandIds }), JSON.stringify(caso)).toEqual(normalizeRecipe(caso, { brandIds }));
      }
    }
  });

  it('todo id tem trecho no pedido (nenhuma opção vira texto vazio sem querer)', () => {
    const vazios = Object.entries(s.FRAG).flatMap(([campo, mapa]) => Object.entries(mapa).filter(([, v]) => !v).map(([id]) => `${campo}.${id}`));
    expect(vazios.sort()).toEqual(['beard.none', 'glasses.none', 'headwear.none']);
  });

  it('o formato da raquete de marca e a configuração do admin batem', () => {
    const pedido = (shape) => s.buildPrompt(s.DEFAULT_RECIPE, { brand: { shape, color: '#000000', color2: '#ffffff' } });
    expect(PADDLE_SHAPES.map((x) => x.id).sort()).toEqual(['elongated', 'standard', 'wide']);
    expect(pedido('elongated')).toContain('an elongated pickleball paddle');
    expect(pedido('wide')).toContain('a wide-body pickleball paddle');
    expect(s.DEFAULT_CONFIG).toEqual({ ...AI_DEFAULT_CONFIG });
    expect([...s.QUALITIES]).toEqual([...AI_QUALITIES]);
  });
});
