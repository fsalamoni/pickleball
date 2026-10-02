import { describe, it, expect } from 'vitest';
import { onboardingFunnel } from './onboardingFunnel.js';
import { ONBOARDING_STEPS } from './onboarding.js';

const retrato = (over = {}) => ({
  prefsDocs: 200,
  onboarding: { dismissed: 30, steps: { level: 150, photo: 120, profile: 100, ranking: 80, follow: 40, club: 20, watch: 60, tournament: 10, share: 25 } },
  ...over,
});

describe('onboardingFunnel', () => {
  it('uma linha por etapa do roteiro, na ordem do catálogo, com a porcentagem sobre quem tem preferências', () => {
    const f = onboardingFunnel(retrato());
    expect(f.rows.map((r) => r.id)).toEqual(ONBOARDING_STEPS.map((p) => p.id));
    expect(f.rows[0]).toMatchObject({ id: 'level', count: 150, pct: 75, xp: 50 });
    expect(f.base).toBe(200);
    expect(f.dismissed).toBe(30);
    expect(f.dismissedPct).toBe(15);
  });

  it('⭐ aponta o passo que menos gente conclui', () => {
    expect(onboardingFunnel(retrato()).hardest).toEqual({ id: 'tournament', label: 'Inscreva-se num torneio', pct: 5 });
  });

  it('⭐ retrato sem funil (anterior a esta medição) não vira zero: devolve null', () => {
    expect(onboardingFunnel({ prefsDocs: 10, athletes: 3 })).toBeNull();
    expect(onboardingFunnel(null)).toBeNull();
    expect(onboardingFunnel(undefined)).toBeNull();
    expect(onboardingFunnel({ prefsDocs: 10, onboarding: 'x' })).toBeNull();
    expect(onboardingFunnel({ prefsDocs: 10, onboarding: { dismissed: 1 } })).toBeNull();
  });

  it('sem ninguém na base, não há porcentagem nem "pior passo" — nunca 0% inventado', () => {
    const f = onboardingFunnel(retrato({ prefsDocs: 0 }));
    expect(f.rows.every((r) => r.pct === null)).toBe(true);
    expect(f.hardest).toBeNull();
    expect(f.dismissedPct).toBeNull();
  });

  it('número quebrado vira zero e a porcentagem nunca passa de 100', () => {
    const f = onboardingFunnel({ prefsDocs: 5, onboarding: { dismissed: 'x', steps: { level: 9999, photo: -3, profile: NaN } } });
    expect(f.rows[0].pct).toBe(100);
    expect(f.rows[1].count).toBe(0);
    expect(f.rows[2].count).toBe(0);
    expect(f.dismissed).toBe(0);
  });

  it('etapa que o servidor não conhece (catálogo futuro) é ignorada, e a que falta vira zero', () => {
    const f = onboardingFunnel({ prefsDocs: 10, onboarding: { dismissed: 0, steps: { novo_passo: 7 } } });
    expect(f.rows).toHaveLength(ONBOARDING_STEPS.length);
    expect(f.rows.every((r) => r.count === 0)).toBe(true);
  });
});
