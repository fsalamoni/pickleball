import { describe, it, expect } from 'vitest';
import {
  describeGroupPlan, suggestGroupPlans, bestGroupPlan, scoreGroupPlan,
  IDEAL_GROUP_SIZES, MAX_COMFORTABLE_GROUP_SIZE,
} from './groupPlan.js';

const nivel = (plano, level) => plano.warnings.filter((w) => w.level === level);

describe('describeGroupPlan', () => {
  it('19 em 4 grupos → 5, 5, 5 e 4', () => {
    const p = describeGroupPlan(19, 4, { qualifiersPerGroup: 2 });
    expect(p.sizes).toEqual([5, 5, 5, 4]);
    expect(p.uniform).toBe(false);
    expect(p.smallest).toBe(4);
    expect(p.largest).toBe(5);
    expect(p.totalMatches).toBe(10 + 10 + 10 + 6);
    expect(p.matchesPerEntrant).toEqual({ min: 3, max: 4 });
    expect(p.qualifiers).toBe(8);
    expect(p.bracket.perfect).toBe(true);
  });

  it('⭐ grupo desigual é INFORMAÇÃO, não erro — e explica por que é justo', () => {
    const p = describeGroupPlan(19, 4, { qualifiersPerGroup: 2 });
    expect(p.blocked).toBe(false);
    expect(nivel(p, 'error')).toHaveLength(0);
    expect(nivel(p, 'info')[0].text).toMatch(/APROVEITAMENTO/);
  });

  it('⭐ grupo de 2 é bloqueado: uma partida só não é grupo', () => {
    const p = describeGroupPlan(7, 3, { qualifiersPerGroup: 2 });
    expect(p.sizes).toEqual([3, 2, 2]);
    expect(p.blocked).toBe(true);
    expect(nivel(p, 'error')[0].text).toMatch(/Grupo de 2/);
  });

  it('⭐ grupo de 3 vira aviso com a saída concreta (ida e volta)', () => {
    const p = describeGroupPlan(11, 3, { qualifiersPerGroup: 2 });
    expect(p.smallest).toBe(3);
    expect(nivel(p, 'warn')[0].text).toMatch(/[Ii]da e volta/);
  });

  it('⭐ ida e volta some com o aviso e dobra os jogos', () => {
    const ida = describeGroupPlan(11, 3, { qualifiersPerGroup: 2 });
    const idaEVolta = describeGroupPlan(11, 3, { qualifiersPerGroup: 2, legs: 2 });
    expect(idaEVolta.totalMatches).toBe(ida.totalMatches * 2);
    expect(idaEVolta.matchesPerEntrant).toEqual({ min: 4, max: 6 });
    expect(nivel(idaEVolta, 'warn').some((w) => /[Ii]da e volta/.test(w.text))).toBe(false);
  });

  it('grupo grande demais avisa o custo em jogos e rodadas', () => {
    const p = describeGroupPlan(16, 2, { qualifiersPerGroup: 2 });
    expect(p.largest).toBe(8);
    expect(nivel(p, 'warn')[0].text).toMatch(/28 jogos/);
  });

  it('⭐ diz quando os classificados não fecham a chave, com as duas saídas', () => {
    const p = describeGroupPlan(19, 5, { qualifiersPerGroup: 2 });
    expect(p.qualifiers).toBe(10);
    expect(p.bracket).toMatchObject({ size: 16, byes: 6, toFill: 6, downTo: 8, dropToFill: 2 });
    expect(nivel(p, 'info').some((w) => /Repescar 6/.test(w.text))).toBe(true);
  });

  it('chave cheia não gera aviso nenhum sobre byes', () => {
    const p = describeGroupPlan(16, 4, { qualifiersPerGroup: 2 });
    expect(p.qualifiers).toBe(8);
    expect(nivel(p, 'info').some((w) => /bye/.test(w.text))).toBe(false);
  });

  it('sem inscritos não quebra', () => {
    const p = describeGroupPlan(0, 3);
    expect(p.blocked).toBe(true);
    expect(p.totalMatches).toBe(0);
  });

  it('nunca cria mais grupos do que inscritos', () => {
    const p = describeGroupPlan(3, 99);
    expect(p.sizes.length).toBeLessThanOrEqual(3);
  });
});

describe('⭐ suggestGroupPlans: o que fazer com um número incomum', () => {
  it('⭐ 19 inscritos: a melhor divisão é 4 grupos (5,5,5,4) com chave cheia', () => {
    const melhor = bestGroupPlan(19, { qualifiersPerGroup: 2 });
    expect(melhor.groupCount).toBe(4);
    expect(melhor.sizes).toEqual([5, 5, 5, 4]);
    expect(melhor.bracket.perfect).toBe(true);
  });

  it('⭐ nenhuma sugestão contém grupo de 2', () => {
    for (let n = 3; n <= 40; n += 1) {
      suggestGroupPlans(n, { qualifiersPerGroup: 2 }).forEach((p) => {
        expect(p.smallest, `n=${n}, ${p.groupCount} grupos`).toBeGreaterThanOrEqual(3);
      });
    }
  });

  it('⭐ a primeira sugestão nunca deixa alguém com menos de 2 jogos', () => {
    for (let n = 4; n <= 40; n += 1) {
      const melhor = bestGroupPlan(n, { qualifiersPerGroup: 2 });
      expect(melhor.matchesPerEntrant.min, `n=${n}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('as sugestões vêm da melhor para a pior', () => {
    const planos = suggestGroupPlans(23, { qualifiersPerGroup: 2 });
    for (let i = 1; i < planos.length; i += 1) {
      expect(planos[i - 1].score).toBeGreaterThanOrEqual(planos[i].score);
    }
  });

  it('menos de 3 inscritos não tem divisão possível', () => {
    expect(suggestGroupPlans(2)).toEqual([]);
    expect(bestGroupPlan(1)).toBeNull();
  });

  it('o limite de sugestões é respeitado', () => {
    expect(suggestGroupPlans(40, { limit: 2 })).toHaveLength(2);
  });
});

describe('scoreGroupPlan', () => {
  it('plano bloqueado vale zero', () => {
    expect(scoreGroupPlan(describeGroupPlan(7, 3))).toBe(0);
    expect(scoreGroupPlan(null)).toBe(0);
  });

  it('⭐ o MENOR grupo pesa mais que a uniformidade', () => {
    // 4+4+4 (uniforme, todos com 3 jogos) × 5+5+4 (desigual, mínimo 3 jogos).
    // O desigual com grupos maiores vence: quem tem menos jogo tem mais jogo.
    const uniforme = describeGroupPlan(12, 3, { qualifiersPerGroup: 2 });
    const desigual = describeGroupPlan(14, 3, { qualifiersPerGroup: 2 });
    expect(uniforme.sizes).toEqual([4, 4, 4]);
    expect(desigual.sizes).toEqual([5, 5, 4]);
    expect(scoreGroupPlan(desigual)).toBeGreaterThan(0);
    expect(IDEAL_GROUP_SIZES).toContain(desigual.smallest);
  });

  it('grupo acima do confortável perde pontos', () => {
    const grande = describeGroupPlan(20, 2, { qualifiersPerGroup: 2 });
    expect(grande.largest).toBeGreaterThan(MAX_COMFORTABLE_GROUP_SIZE);
    expect(scoreGroupPlan(grande)).toBeLessThan(scoreGroupPlan(describeGroupPlan(20, 4, { qualifiersPerGroup: 2 })));
  });
});
