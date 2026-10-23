import { describe, it, expect } from 'vitest';
import { buildOfficialDuprRanking } from './duprOfficialRanking.js';

const P = (id, extra) => ({ id, platform_name: id.toUpperCase(), dupr_verified: true, ...extra });

describe('buildOfficialDuprRanking', () => {
  it('só entra quem tem o selo do DUPR; o número digitado à mão fica de fora', () => {
    const r = buildOfficialDuprRanking([
      P('ana', { dupr_rating: 4.1 }),
      { id: 'bia', platform_name: 'Bia', dupr_rating: 5.5 },
      P('cris', { dupr_rating: 3.2, dupr_verified: false }),
    ]);
    expect(r.map((x) => x.uid)).toEqual(['ana']);
  });

  it('ordena do maior para o menor; rating igual divide a posição', () => {
    const r = buildOfficialDuprRanking([
      P('a', { dupr_rating: 3.5 }), P('b', { dupr_rating: 4.2 }), P('c', { dupr_rating: 3.5 }), P('d', { dupr_rating: 3.1 }),
    ]);
    expect(r.map((x) => [x.uid, x.position])).toEqual([['b', 1], ['a', 2], ['c', 2], ['d', 4]]);
  });

  it('simples lê o rating de simples; quem não tem rating no formato fica fora', () => {
    const r = buildOfficialDuprRanking([P('a', { dupr_rating: 4, dupr_rating_singles: 3.3 }), P('b', { dupr_rating: 5 })], 'singles');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ uid: 'a', rating: 3.3, position: 1 });
  });

  it('perfil oculto pela moderação não aparece', () => {
    expect(buildOfficialDuprRanking([P('a', { dupr_rating: 4, hidden: true })])).toEqual([]);
  });

  it('entrada vazia ou estranha não estoura', () => {
    expect(buildOfficialDuprRanking(null)).toEqual([]);
    expect(buildOfficialDuprRanking([null, {}])).toEqual([]);
  });
});
