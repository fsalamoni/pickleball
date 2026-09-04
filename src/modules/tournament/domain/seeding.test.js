import { describe, it, expect } from 'vitest';
import {
  levelRank,
  genderBucket,
  combinedStrength,
  hasUsefulLevels,
  orderByStrengthDesc,
  balancedParticipantOrder,
  hasUnifiedLevels,
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

describe('régua unificada (DUPR → plataforma → ELO → declarado)', () => {
  it('quando há level_value, ele manda — e não o nível declarado', () => {
    // "a" declarou nível baixo mas tem 5.5 medido; "b" declarou alto mas tem 2.5.
    // A régua unificada tem de inverter a ordem que o declarado sugeriria.
    const metas = [
      { id: 'a', level: 'iniciante_2', level_value: 5.5 },
      { id: 'b', level: 'pro', level_value: 2.5 },
    ];
    expect(balancedParticipantOrder(metas, { clusterByGender: false })).toEqual(['a', 'b']);
  });

  it('sem level_value, continua exatamente como sempre foi', () => {
    const metas = [
      { id: 'a', level: 'iniciante_2' },
      { id: 'b', level: 'pro' },
    ];
    expect(balancedParticipantOrder(metas, { clusterByGender: false })).toEqual(['b', 'a']);
  });

  it('NÃO mistura as duas réguas na mesma comparação', () => {
    // Se misturasse, o índice 7 ("open") venceria o 5.5 da régua unificada —
    // comparação sem sentido entre escalas diferentes. Com a régua ativa e
    // apenas UM participante nela, não há dois níveis comparáveis: o motor
    // devolve null e o sorteio segue sem reordenar (nunca ordena errado).
    //
    // Na prática isso não acontece, porque quem monta as metas converte o
    // nível declarado para a MESMA régua (ver `buildMeta` no drawService) —
    // então todos entram comparáveis.
    const metas = [
      { id: 'comRegua', level_value: 5.5 },
      { id: 'soDeclarado', level: 'open' },
    ];
    expect(balancedParticipantOrder(metas, { clusterByGender: false })).toBeNull();
  });

  it('com o declarado convertido para a régua, todos ficam comparáveis', () => {
    // é o que o drawService faz: quem não tem rating entra pelo nível
    // declarado, já na régua unificada
    const metas = [
      { id: 'medido', level_value: 3.0 },
      { id: 'declarado', level_value: 5.0 },
    ];
    expect(balancedParticipantOrder(metas, { clusterByGender: false }))
      .toEqual(['declarado', 'medido']);
  });

  it('duplas usam a média dos dois na régua unificada', () => {
    const metas = [
      { id: 'fraca', level_value: 3.0, partner_level_value: 3.0 },
      { id: 'media', level_value: 3.0, partner_level_value: 5.0 },
      { id: 'forte', level_value: 5.0, partner_level_value: 5.0 },
    ];
    expect(balancedParticipantOrder(metas, { clusterByGender: false }))
      .toEqual(['forte', 'media', 'fraca']);
  });

  it('parceiro sem nível não zera a dupla', () => {
    const metas = [
      { id: 'x', level_value: 5.0, partner_level_value: null },
      { id: 'y', level_value: 3.0, partner_level_value: 3.0 },
    ];
    expect(balancedParticipantOrder(metas, { clusterByGender: false })).toEqual(['x', 'y']);
  });

  it('sem nenhum nível conhecido, devolve null (sorteio segue como está)', () => {
    expect(balancedParticipantOrder([{ id: 'a' }, { id: 'b' }])).toBeNull();
  });

  it('hasUnifiedLevels detecta a presença da régua', () => {
    expect(hasUnifiedLevels([{ id: 'a', level_value: 3 }])).toBe(true);
    expect(hasUnifiedLevels([{ id: 'a', level: 'pro' }])).toBe(false);
    expect(hasUnifiedLevels([{ id: 'a', level_value: null }])).toBe(false);
    expect(hasUnifiedLevels([])).toBe(false);
  });
});
