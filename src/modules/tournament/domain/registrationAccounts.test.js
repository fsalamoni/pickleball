import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { registrationSlotsWithoutAccount, registrationCountsForRanking } from './registrationAccounts.js';

const require = createRequire(import.meta.url);
const { resolveSideUids } = require('../../../../functions/ranking.js');

describe('registrationSlotsWithoutAccount — quem tira a inscrição do ranking', () => {
  it('duplas: os dois precisam de conta', () => {
    expect(registrationSlotsWithoutAccount({ format: 'doubles', player_a_user_id: 'u1', player_b_user_id: 'u2' })).toEqual([]);
    expect(registrationSlotsWithoutAccount({ format: 'doubles', player_a_user_id: 'u1', player_b_name: 'Zé' })).toEqual(['b']);
    expect(registrationSlotsWithoutAccount({ format: 'doubles', player_a_name: 'Ana' })).toEqual(['a', 'b']);
  });

  it('individual (e Americano, com inscrição individual): só o jogador A', () => {
    expect(registrationSlotsWithoutAccount({ format: 'singles', player_a_user_id: 'u1' })).toEqual([]);
    expect(registrationSlotsWithoutAccount({ format: 'singles', player_a_name: 'Ana' })).toEqual(['a']);
  });

  it('equipe e vaga fictícia não pedem conta', () => {
    expect(registrationSlotsWithoutAccount({ kind: 'team', format: 'doubles' })).toEqual([]);
    expect(registrationSlotsWithoutAccount({ is_placeholder: true, format: 'doubles' })).toEqual([]);
    expect(registrationCountsForRanking({ kind: 'team' })).toBe(false);
  });

  it('⭐ PARIDADE com o servidor: a tela promete exatamente o que o ranking faz', () => {
    const casos = [
      { format: 'doubles', player_a_user_id: 'u1', player_b_user_id: 'u2' },
      { format: 'doubles', player_a_user_id: 'u1', player_b_user_id: null },
      { format: 'doubles', player_a_user_id: null, player_b_user_id: 'u2' },
      { format: 'singles', player_a_user_id: 'u1' },
      { format: 'singles', player_a_user_id: null },
      { format: undefined, player_a_user_id: 'u1', player_b_user_id: null },
    ];
    casos.forEach((reg) => {
      const servidor = resolveSideUids(['r'], new Map([['r', reg]])).complete;
      expect(registrationCountsForRanking(reg), JSON.stringify(reg)).toBe(servidor);
    });
  });
});
