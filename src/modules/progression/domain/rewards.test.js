import { describe, it, expect } from 'vitest';
import {
  normalizeEligibility, buildEligibilitySnapshot, evaluateEligibility, describeEligibility,
  validateReward, rewardAvailability, generateClaimCode, claimDocId, canTransitionClaim,
} from './rewards.js';

describe('critérios', () => {
  it('descarta o inválido e mantém o válido', () => {
    expect(normalizeEligibility({ minTier: 'Rei', minLevel: 1, minGames: 2, topPercent: 150, minStreakWeeks: 4, achievementId: 'career_first_win' }))
      .toEqual({ minStreakWeeks: 4, achievementId: 'career_first_win' });
    expect(normalizeEligibility({ minTier: 'Expert', minGames: 50 })).toEqual({ minTier: 'Expert', minGames: 50 });
  });

  it('avalia cada critério e diz o que falta', () => {
    const snap = buildEligibilitySnapshot({ tier: 'Veterano', level: 15, games: 40, streakWeeks: 6, achievementIds: ['career_first_win'], seasonPercent: 8 });
    const ok = evaluateEligibility({ minTier: 'Regular', minGames: 30, topPercent: 10, achievementId: 'career_first_win' }, snap);
    expect(ok.eligible).toBe(true);
    const falta = evaluateEligibility({ minTier: 'Expert', minGames: 100 }, snap);
    expect(falta.eligible).toBe(false);
    expect(falta.checks.filter((c) => !c.ok).map((c) => c.field)).toEqual(['minTier', 'minGames']);
    expect(falta.checks[0]).toMatchObject({ have: 'Veterano', need: 'Expert' });
  });

  it('sem posição na temporada não cumpre "top X%"', () => {
    const r = evaluateEligibility({ topPercent: 10 }, buildEligibilitySnapshot({ seasonPercent: null }));
    expect(r.eligible).toBe(false);
    expect(r.checks[0].have).toBe('sem posição');
  });

  it('sem critério = aberta a todos', () => {
    expect(evaluateEligibility({}, buildEligibilitySnapshot()).eligible).toBe(true);
    expect(describeEligibility({})).toBe('Aberta a todos os atletas');
  });

  it('descreve em uma frase', () => {
    expect(describeEligibility({ minTier: 'Expert', minGames: 50 })).toBe('Para quem tem tier Expert ou acima e 50 jogos');
  });
});

describe('definição e disponibilidade', () => {
  const issuer = { type: 'arena', id: 'a1', uid: 'u1' };

  it('valida título e quantidade', () => {
    expect(validateReward({ title: 'ab' }, issuer).ok).toBe(false);
    expect(validateReward({ title: 'Aula experimental', quantity: 0 }, issuer).ok).toBe(false);
    const r = validateReward({ title: 'Aula experimental', kind: 'free_class', quantity: '20', eligibility: { minTier: 'Aprendiz' } }, issuer);
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({ kind: 'free_class', quantity: 20, status: 'active', eligibility: { minTier: 'Aprendiz' } });
  });

  it('disponibilidade: pausada, vencida e esgotada', () => {
    const now = 1_000_000;
    expect(rewardAvailability({ status: 'paused' }, now).available).toBe(false);
    expect(rewardAvailability({ status: 'active', validUntil: now - 1 }, now).available).toBe(false);
    expect(rewardAvailability({ status: 'active', quantity: 5, approvedCount: 5 }, now).available).toBe(false);
    expect(rewardAvailability({ status: 'active', quantity: 5, approvedCount: 3 }, now)).toEqual({ available: true, remaining: 2 });
    expect(rewardAvailability({ status: 'active' }, now)).toEqual({ available: true, remaining: null });
  });
});

describe('pedido', () => {
  it('código sem caracteres ambíguos', () => {
    for (let i = 0; i < 50; i += 1) expect(generateClaimCode()).toMatch(/^RWD-[A-HJKMNP-Z2-9]{6}$/);
    expect(generateClaimCode(() => 0)).toBe('RWD-AAAAAA');
  });
  it('um pedido por recompensa e pessoa', () => {
    expect(claimDocId('r1', 'u1')).toBe('r1_u1');
  });
  it('quem pode mudar o estado', () => {
    expect(canTransitionClaim('requested', 'approved', 'issuer')).toBe(true);
    expect(canTransitionClaim('requested', 'approved', 'owner')).toBe(false);
    expect(canTransitionClaim('approved', 'cancelled', 'owner')).toBe(true);
    expect(canTransitionClaim('redeemed', 'cancelled', 'owner')).toBe(false);
  });
});
