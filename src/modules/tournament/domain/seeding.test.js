import { describe, it, expect } from 'vitest';
import {
  levelRank,
  genderBucket,
  combinedStrength,
  hasUsefulLevels,
  orderByStrengthDesc,
  balancedParticipantOrder,
} from './seeding.js';
import { COMPETITION_GENDER } from './constants.js';

describe('levelRank', () => {
  it('ordena do mais fraco ao mais forte', () => {
    expect(levelRank('iniciante_1')).toBeLessThan(levelRank('avancado'));
    expect(levelRank('avancado')).toBeLessThan(levelRank('open'));
  });
  it('aceita badge/nome como fallback', () => {
    expect(levelRank('4.0')).toBe(levelRank('avancado'));
  });
  it('retorna -1 para desconhecido/ausente', () => {
    expect(levelRank('xpto')).toBe(-1);
    expect(levelRank(null)).toBe(-1);
  });
});

describe('genderBucket', () => {
  it('classifica por gênero competitivo', () => {
    expect(genderBucket({ gender: COMPETITION_GENDER.MALE })).toBe('male');
    expect(genderBucket({ gender: COMPETITION_GENDER.FEMALE })).toBe('female');
    expect(genderBucket({ gender: null })).toBe('unknown');
    expect(genderBucket({})).toBe('unknown');
  });
});

describe('combinedStrength', () => {
  it('usa média dos níveis conhecidos em duplas', () => {
    const s = combinedStrength({ level: 'intermediario', partner_level: 'avancado' });
    expect(s).toBe((levelRank('intermediario') + levelRank('avancado')) / 2);
  });
  it('usa o nível conhecido quando o parceiro é desconhecido', () => {
    expect(combinedStrength({ level: 'avancado', partner_level: null })).toBe(levelRank('avancado'));
  });
  it('retorna -1 quando nada é conhecido', () => {
    expect(combinedStrength({})).toBe(-1);
  });
});

describe('hasUsefulLevels', () => {
  it('exige ao menos dois com nível conhecido', () => {
    expect(hasUsefulLevels([{ level: 'avancado' }])).toBe(false);
    expect(hasUsefulLevels([{ level: 'avancado' }, { level: 'pro' }])).toBe(true);
    expect(hasUsefulLevels([{}, {}])).toBe(false);
  });
});

describe('orderByStrengthDesc', () => {
  it('coloca os mais fortes primeiro e desconhecidos por último (estável)', () => {
    const metas = [
      { id: 'fraco', level: 'iniciante_1' },
      { id: 'forte', level: 'open' },
      { id: 'semnivel' },
      { id: 'medio', level: 'intermediario' },
    ];
    const order = orderByStrengthDesc(metas).map((m) => m.id);
    expect(order[0]).toBe('forte');
    expect(order[order.length - 1]).toBe('semnivel');
    expect(order.indexOf('medio')).toBeLessThan(order.indexOf('fraco'));
  });
});

describe('balancedParticipantOrder', () => {
  it('retorna null quando não há níveis úteis', () => {
    expect(balancedParticipantOrder([{ id: 'a' }, { id: 'b' }])).toBeNull();
  });

  it('agrupa por gênero e ordena por nível dentro de cada grupo', () => {
    const metas = [
      { id: 'm-fraco', level: 'iniciante_2', gender: COMPETITION_GENDER.MALE },
      { id: 'f-forte', level: 'pro', gender: COMPETITION_GENDER.FEMALE },
      { id: 'm-forte', level: 'avancado', gender: COMPETITION_GENDER.MALE },
      { id: 'f-fraco', level: 'intermediario', gender: COMPETITION_GENDER.FEMALE },
    ];
    const order = balancedParticipantOrder(metas);
    // masculinos primeiro (forte antes do fraco), depois femininas
    expect(order).toEqual(['m-forte', 'm-fraco', 'f-forte', 'f-fraco']);
  });

  it('sem gênero conhecido, ordena só por nível', () => {
    const metas = [
      { id: 'a', level: 'intermediario' },
      { id: 'b', level: 'open' },
      { id: 'c', level: 'iniciante_1' },
    ];
    expect(balancedParticipantOrder(metas)).toEqual(['b', 'a', 'c']);
  });

  it('clusterByGender=false ignora o agrupamento por gênero', () => {
    const metas = [
      { id: 'm-fraco', level: 'iniciante_2', gender: COMPETITION_GENDER.MALE },
      { id: 'f-forte', level: 'pro', gender: COMPETITION_GENDER.FEMALE },
    ];
    expect(balancedParticipantOrder(metas, { clusterByGender: false })).toEqual(['f-forte', 'm-fraco']);
  });
});
