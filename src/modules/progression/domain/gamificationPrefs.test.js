import { describe, it, expect } from 'vitest';
import {
  normalizeGamificationPrefs, mergeGamificationPrefs, wantsPublicRanking,
  DEFAULT_GAMIFICATION_PREFS, PREFS_MAP_LIMITS,
} from './gamificationPrefs.js';

describe('gamificationPrefs', () => {
  it('sem documento: padrões (aparece no placar, recebe duelo, avisos ligados)', () => {
    const p = normalizeGamificationPrefs(null, 'u1');
    expect(p.uid).toBe('u1');
    expect(p.privacy.showInHallOfFame).toBe(true);
    expect(p.social.acceptDuels).toBe(true);
    expect(p.onboarding.done).toEqual({});
    expect(p).toMatchObject({ schemaVersion: 1, notifications: DEFAULT_GAMIFICATION_PREFS.notifications });
  });

  it('só aceita booleano de verdade e título com formato de id', () => {
    const p = normalizeGamificationPrefs({
      privacy: { showInHallOfFame: 'não' },
      display: { title: 'career_first_title', celebrations: false },
    });
    expect(p.privacy.showInHallOfFame).toBe(true);
    expect(p.display.title).toBe('career_first_title');
    expect(p.display.celebrations).toBe(false);
    expect(normalizeGamificationPrefs({ display: { title: '<b>x</b>' } }).display.title).toBeNull();
  });

  it('o patch muda uma seção sem apagar as outras', () => {
    const a = mergeGamificationPrefs({ social: { acceptLetters: false } }, { privacy: { showInHallOfFame: false } });
    expect(a.privacy.showInHallOfFame).toBe(false);
    expect(a.social.acceptLetters).toBe(false);
    expect(wantsPublicRanking(a)).toBe(false);
  });

  it('o progresso do onboarding e os marcos só crescem', () => {
    const a = mergeGamificationPrefs(
      { onboarding: { done: { foto: 100 } }, celebrated: { tier_up_Aprendiz: 5 } },
      { onboarding: { done: { foto: 999, nivel: 200 } }, celebrated: { streak_4: 7 } },
    );
    expect(a.onboarding.done).toEqual({ foto: 100, nivel: 200 });
    expect(a.celebrated).toEqual({ tier_up_Aprendiz: 5, streak_4: 7 });
  });

  it('descarta chave inválida e respeita o teto de entradas', () => {
    const muitos = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`p${i}`, i + 1]));
    const p = normalizeGamificationPrefs({ onboarding: { done: { ...muitos, 'a b': 1, ok: -3 } } });
    expect(Object.keys(p.onboarding.done).length).toBeLessThanOrEqual(PREFS_MAP_LIMITS.onboardingDone);
    expect(p.onboarding.done['a b']).toBeUndefined();
  });
});
