/**
 * Testes para `tiers.js`.
 */

import { describe, it, expect } from 'vitest';
import {
  TIERS,
  tierFromXp,
  nextTier,
  tierProgress,
  getTierByTag,
  listTiers,
} from './tiers.js';

describe('tiers · TIERS', () => {
  it('é um Object congelado', () => {
    expect(Object.isFrozen(TIERS)).toBe(true);
  });

  it('tem 9 tiers (Calouro → Imortal)', () => {
    expect(TIERS).toHaveLength(9);
  });

  it('thresholds são crescentes e >= 0', () => {
    let prev = -1;
    for (const t of TIERS) {
      expect(t.threshold).toBeGreaterThanOrEqual(0);
      expect(t.threshold).toBeGreaterThan(prev);
      prev = t.threshold;
    }
  });

  it('cada tier tem nome, icon, color, tag, description', () => {
    for (const t of TIERS) {
      expect(t.name).toBeTruthy();
      expect(t.icon).toBeTruthy();
      expect(t.color).toBeTruthy();
      expect(t.tag).toBeTruthy();
      expect(t.description).toBeTruthy();
    }
  });

  it('tags são únicas', () => {
    const tags = TIERS.map((t) => t.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it('nomes estão em pt-BR e são os esperados', () => {
    const names = TIERS.map((t) => t.name);
    expect(names).toEqual([
      'Calouro',
      'Aprendiz',
      'Jogador',
      'Regular',
      'Veterano',
      'Expert',
      'Elite',
      'Lenda',
      'Imortal',
    ]);
  });
});

describe('tiers · tierFromXp', () => {
  it('XP 0 = Calouro', () => {
    const t = tierFromXp(0);
    expect(t.name).toBe('Calouro');
    expect(t.tag).toBe('rookie');
  });

  it('XP 1000 = Calouro ainda (threshold do Aprendiz é 2.000)', () => {
    const t = tierFromXp(1000);
    expect(t.name).toBe('Calouro');
  });

  it('XP 2000 = Aprendiz', () => {
    const t = tierFromXp(2000);
    expect(t.name).toBe('Aprendiz');
  });

  it('XP 3020 (Flavio) = Aprendiz', () => {
    const t = tierFromXp(3020);
    expect(t.name).toBe('Aprendiz');
  });

  it('XP 6000 = Jogador', () => {
    const t = tierFromXp(6000);
    expect(t.name).toBe('Jogador');
  });

  it('XP 50000 = Elite', () => {
    const t = tierFromXp(50000);
    expect(t.name).toBe('Elite');
  });

  it('XP 100000 = Imortal', () => {
    const t = tierFromXp(100000);
    expect(t.name).toBe('Imortal');
  });

  it('XP 999999 = Imortal (cap)', () => {
    const t = tierFromXp(999999);
    expect(t.name).toBe('Imortal');
  });

  it('lida com XP negativo → Calouro', () => {
    const t = tierFromXp(-100);
    expect(t.name).toBe('Calouro');
  });

  it('lida com NaN → Calouro', () => {
    const t = tierFromXp(NaN);
    expect(t.name).toBe('Calouro');
  });
});

describe('tiers · nextTier', () => {
  it('nextTier(Calouro) = Aprendiz', () => {
    const t = nextTier(TIERS[0]);
    expect(t.name).toBe('Aprendiz');
  });

  it('nextTier(Imortal) = null', () => {
    const t = nextTier(TIERS[TIERS.length - 1]);
    expect(t).toBeNull();
  });

  it('lida com tier inválido', () => {
    const t = nextTier(null);
    expect(t).toBeTruthy(); // retorna o segundo
  });
});

describe('tiers · tierProgress', () => {
  it('XP 0 = 0% para o próximo', () => {
    const p = tierProgress(0);
    expect(p.current.name).toBe('Calouro');
    expect(p.next.name).toBe('Aprendiz');
    expect(p.progress).toBe(0);
    expect(p.xpIntoTier).toBe(0);
    expect(p.xpForNextTier).toBe(2000);
  });

  it('XP 1000 (meio) = 50% para Aprendiz', () => {
    const p = tierProgress(1000);
    expect(p.progress).toBeCloseTo(0.5, 5);
  });

  it('XP 2000 (acabou de entrar) = 0% para Jogador', () => {
    const p = tierProgress(2000);
    expect(p.current.name).toBe('Aprendiz');
    expect(p.next.name).toBe('Jogador');
    expect(p.progress).toBe(0);
  });

  it('XP 100000 (Imortal) = 100% (sem próximo)', () => {
    const p = tierProgress(100000);
    expect(p.progress).toBe(1);
    expect(p.next).toBeNull();
  });
});

describe('tiers · getTierByTag', () => {
  it('encontra por tag', () => {
    expect(getTierByTag('legend').name).toBe('Lenda');
    expect(getTierByTag('immortal').name).toBe('Imortal');
  });

  it('case-insensitive', () => {
    expect(getTierByTag('LEGEND').name).toBe('Lenda');
  });

  it('tag inexistente → null', () => {
    expect(getTierByTag('nope')).toBeNull();
  });
});

describe('tiers · listTiers', () => {
  it('retorna cópia (não muta)', () => {
    const list = listTiers();
    expect(list).toHaveLength(9);
    list.push({ fake: true });
    expect(TIERS).toHaveLength(9); // TIERS não foi mutado
  });
});
