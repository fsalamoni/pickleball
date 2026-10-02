import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_STEPS, ONBOARDING_MAX_XP, evaluateOnboarding, detectFactSteps, onboardingXp,
  stepForVisit, daysSinceJoined, shouldShowOnboarding, onboardingStep,
} from './onboarding.js';
import { buildActivityFacts, FACT_SOURCES } from './activityFacts.js';

const todas = () => Object.fromEntries(FACT_SOURCES.map((n) => [n, []]));
const NOW = new Date('2026-10-02T15:00:00Z');

describe('roteiro', () => {
  it('é curto, com XP concreto e ids únicos', () => {
    expect(ONBOARDING_STEPS.length).toBeLessThanOrEqual(10);
    expect(new Set(ONBOARDING_STEPS.map((p) => p.id)).size).toBe(ONBOARDING_STEPS.length);
    expect(ONBOARDING_MAX_XP).toBe(350);
    ONBOARDING_STEPS.forEach((p) => {
      expect(p.xp).toBeGreaterThan(0);
      expect(p.to.startsWith('/')).toBe(true);
    });
  });

  it('as etapas de visita casam a rota e só ela', () => {
    expect(stepForVisit('/ranking')).toBe('ranking');
    expect(stepForVisit('/ranking/duplas')).toBe('ranking');
    expect(stepForVisit('/torneios/abc123')).toBe('watch');
    expect(stepForVisit('/torneios')).toBeNull();
    expect(stepForVisit('/rankings-falsos')).toBeNull();
  });
});

describe('detecção', () => {
  it('detecta pelos fatos reais e ignora fonte que não carregou', () => {
    const facts = buildActivityFacts(
      { ...todas(), following: [{}, {}, {}], clubs: [{ id: 'c' }] },
      { now: NOW, profile: { uid: 'u', photo_url: 'f', leveling_level: 'avancado' } },
    );
    const feitos = detectFactSteps(facts);
    expect([...feitos].sort()).toEqual(['club', 'follow', 'level', 'photo']);

    const semFonte = buildActivityFacts({ following: [{}, {}, {}] }, { now: NOW, profile: { uid: 'u' } });
    expect(detectFactSteps(semFonte).has('club')).toBe(false);
    expect(detectFactSteps(null).size).toBe(0);
  });
});

describe('evaluateOnboarding', () => {
  const facts = buildActivityFacts(
    { ...todas(), following: [{}, {}, {}] },
    { now: NOW, profile: { uid: 'u', photo_url: 'f' } },
  );

  it('separa o que foi detectado agora do que já está gravado', () => {
    const s = evaluateOnboarding({ facts, done: { photo: 1000 } });
    expect(s.toRecord).toEqual(['follow']); // photo já gravada; follow é novidade
    expect(s.doneCount).toBe(2);
    expect(s.xpEarned).toBe(30); // só o gravado paga
    expect(s.complete).toBe(false);
  });

  it('etapa gravada continua cumprida mesmo se o fato some (XP não regride)', () => {
    const semFoto = buildActivityFacts({ ...todas() }, { now: NOW, profile: { uid: 'u' } });
    const s = evaluateOnboarding({ facts: semFoto, done: { photo: 1000 } });
    expect(s.steps.find((p) => p.id === 'photo').complete).toBe(true);
    expect(s.xpEarned).toBe(30);
  });

  it('o próximo passo respeita o dia sugerido', () => {
    const s = evaluateOnboarding({ facts: buildActivityFacts({ ...todas() }, { now: NOW, profile: { uid: 'u' } }), joinedDays: 0 });
    expect(s.next.day).toBe(1);
    expect(s.todayIds.every((id) => onboardingStep(id).day <= 1)).toBe(true);
  });

  it('completo quando tudo está cumprido', () => {
    const done = Object.fromEntries(ONBOARDING_STEPS.map((p) => [p.id, 5]));
    const s = evaluateOnboarding({ facts: null, done });
    expect(s.complete).toBe(true);
    expect(s.progress).toBe(1);
    expect(s.next).toBeNull();
    expect(shouldShowOnboarding(s)).toBe(false);
  });
});

describe('XP e exibição', () => {
  it('só ids conhecidos, uma vez cada, e nunca passa do teto', () => {
    expect(onboardingXp({ level: 1, foto_inventada: 1, club: 2 })).toBe(100);
    const tudo = Object.fromEntries([...ONBOARDING_STEPS.map((p) => [p.id, 1]), ['x', 1], ['y', 1]]);
    expect(onboardingXp(tudo)).toBe(ONBOARDING_MAX_XP);
    expect(onboardingXp(null)).toBe(0);
  });

  it('dispensado não aparece; veterano com bastante história também não', () => {
    const base = evaluateOnboarding({ facts: null, done: { level: 1, photo: 1, profile: 1, ranking: 1 } });
    expect(shouldShowOnboarding({ ...base, dismissed: true })).toBe(false);
    expect(shouldShowOnboarding(base, { joinedDays: 3, activityCount: 2 })).toBe(true);
    expect(shouldShowOnboarding(base, { joinedDays: 200, activityCount: 80 })).toBe(false);
  });

  it('daysSinceJoined tolera dado ausente', () => {
    expect(daysSinceJoined(undefined, NOW)).toBe(0);
    expect(daysSinceJoined(NOW.getTime() - 3 * 86_400_000, NOW)).toBe(3);
  });
});
