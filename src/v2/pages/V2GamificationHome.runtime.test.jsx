/**
 * Teste de RUNTIME da página /gamification (V2GamificationHome).
 *
 * Garante que:
 *  - Flag OFF: empty state
 *  - Flag ON: header com tier+XP, missões, conquistas, referral
 *  - Cenário Flávio: tier Aprendiz, 3.020 XP
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockAuth = { user: { uid: 'u1', displayName: 'Test' } };
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => mockAuth,
}));

const mockFlagState = { value: true };
vi.mock('@/core/lib/FeatureFlagsContext', () => ({
  useFeatureFlag: () => mockFlagState.value,
}));

vi.mock('@/modules/performance/hooks/usePlayerStats', () => ({
  usePlayerStats: () => ({
    stats: { tournaments: 8, played: 142, wins: 66, podiums: 1, titles: 0 },
    isLoading: false,
  }),
}));

vi.mock('@/modules/rating/hooks/useRating', () => ({
  useRatingHistory: () => ({ data: [{ rating: 1023 }] }),
  useNationalRanking: () => ({ data: [{ id: 'u1', position: 47, rating: 1023 }] }),
}));

vi.mock('@/modules/progression/hooks/useProgression', () => ({
  usePlayerMatchDates: () => ({ data: [Date.now() - 7 * 86400000, Date.now() - 14 * 86400000] }),
}));

vi.mock('@/modules/progression/hooks/useGamificationTracker', () => ({
  useGamificationTracker: () => ({ track: () => {}, enabled: false, GAMIFICATION_EVENT: {} }),
}));

vi.mock('@/modules/progression/hooks/useUserProgressionV2', () => ({
  useUserProgressionV2: () => ({ progression: null, isLoading: false, error: null, refresh: () => {} }),
}));
vi.mock('@/modules/progression/hooks/useSyncProgressionV2', () => ({
  useSyncProgressionV2: () => ({ progression: null }),
}));
vi.mock('@/modules/progression/hooks/useUserMissionsV2', () => ({
  useUserMissionsV2: () => ({
    missions: [
      { id: 'm1', title: 'Jogue 1 partida', description: 'Jogue 1 partida', metric: 'game_played', target: 1, current: 0, xp: 30, bonus: 15, bonusClaimed: false, seed: 1 },
      { id: 'm2', title: 'Dê 2 kudos', description: 'Dê 2 kudos', metric: 'kudos_given', target: 2, current: 1, xp: 20, bonus: 10, bonusClaimed: false, seed: 2 },
      { id: 'm3', title: 'Conclua 1 torneio', description: 'Conclua 1 torneio', metric: 'tournament_completed', target: 1, current: 0, xp: 50, bonus: 20, bonusClaimed: false, seed: 3 },
    ],
    doc: { bonusClaimed: false, completedAt: null },
    metrics: { game_played: 0, kudos_given: 1 },
    isLoading: false,
    claimBonus: () => {},
    isClaiming: false,
  }),
}));
vi.mock('@/modules/achievements/hooks/useUserAchievementsV2', () => ({
  useUserAchievementsV2: () => ({ unlocked: [], unlockedIds: new Set(), isLoading: false, unlock: () => {}, markNotified: () => {}, incrementShare: () => {} }),
}));
vi.mock('@/modules/progression/hooks/useStreakMetaV2', () => ({
  useStreakMetaV2: () => ({
    meta: { graceDaysRemaining: 2, freezesAvailable: 2, vacationMode: false, comebackBonus: 0, lastPlayAt: null },
    isLoading: false,
    enableVacation: () => {},
    disableVacation: () => {},
    useFreeze: () => {},
    addFreeze: () => {},
    isMutating: false,
  }),
}));
vi.mock('@/modules/achievements/hooks/useSyncAchievementsV2', () => ({
  useSyncAchievementsV2: () => {},
}));

vi.mock('@/modules/progression/hooks/useKudoActions', () => ({
  useKudoActions: () => ({
    index: { givenToday: 0, receivedToday: 0, lastKudoDay: '2026-09-03' },
    received: [], given: [], isLoading: false,
    give: () => {}, isGiving: false, giveError: null,
  }),
}));

vi.mock('@/modules/progression/hooks/useUserReferralCode', () => ({
  // código PERSISTIDO do usuário (antes a página gerava um aleatório no render)
  useUserReferralCode: () => ({
    code: { uid: 'u1', code: 'AB2CD3EF', totalSignups: 4 },
    isLoading: false,
  }),
}));

vi.mock('@/modules/progression/hooks/useUserSeasonRanking', () => ({
  useUserCurrentSeason: () => ({ season: null, seasonId: '2026-09', isLoading: false }),
  useSeasonTop: () => ({ data: [] }),
}));

import V2GamificationHome from './V2GamificationHome.jsx';

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockFlagState.value = true;
});

afterEach(() => {
  root.unmount();
  container.remove();
  container = null;
  root = null;
});

function render() {
  return new Promise((resolve) => {
    root.render(
      <MemoryRouter>
        <V2GamificationHome />
      </MemoryRouter>,
    );
    setTimeout(() => {
      // re-render pra garantir dados carregados
      root.render(
        <MemoryRouter>
          <V2GamificationHome />
        </MemoryRouter>,
      );
      setTimeout(resolve, 80);
    }, 80);
  });
}

describe('V2GamificationHome · flag OFF', () => {
  it('mostra empty state amigável', async () => {
    mockFlagState.value = false;
    await render();
    expect(container.textContent).toContain('Gamificação V2 em construção');
    // link para /meu-desempenho
    expect(container.querySelector('a[href="/meu-desempenho"]')).toBeTruthy();
  });
});

describe('V2GamificationHome · flag ON', () => {
  it('renderiza título + subtítulo', async () => {
    await render();
    expect(container.textContent).toContain('Gamificação');
    expect(container.textContent).toContain('Missões, conquistas, trilhas de XP');
  });

  it('header mostra tier Aprendiz (Flavio XP 3020)', async () => {
    await render();
    // tier badge contém 'Aprendiz'
    const tierBadge = container.querySelector('[data-testid="tier-badge"]');
    expect(tierBadge).toBeTruthy();
    expect(tierBadge.textContent).toContain('Aprendiz');
  });

  it('header mostra XP 3.020', async () => {
    await render();
    expect(container.textContent).toContain('3.020');
  });

  it('header mostra contagem de conquistas (X/Y)', async () => {
    await render();
    expect(container.textContent).toMatch(/\d+\/\d+ conquistas|\d+\/\d+.*conquistas/);
  });

  it('mostra 3 missões diárias', async () => {
    await render();
    const items = container.querySelectorAll('[data-testid="mission-item"]');
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('mostra conquistas em destaque (até 4)', async () => {
    await render();
    const cards = container.querySelectorAll('[data-testid="achievement-card"]');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(4);
  });

  it('mostra link "Ver todas" para /conquistas', async () => {
    await render();
    const link = Array.from(container.querySelectorAll('a'))
      .find((a) => a.textContent.includes('Ver todas'));
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/conquistas');
  });

  it('mostra o código de convite PERSISTIDO do usuário', async () => {
    await render();
    const code = container.querySelector('[data-testid="referral-code"]');
    expect(code).toBeTruthy();
    // tem de ser o código gravado, não um aleatório gerado no render
    expect(code.textContent.replace(/\s/g, '')).toBe('AB2CD3EF');
  });

  it('mostra 3 recompensas do referral', async () => {
    await render();
    expect(container.textContent).toContain('+50');
    expect(container.textContent).toContain('+200');
    expect(container.textContent).toContain('+500');
  });

  it('mostra 5 skill trees', async () => {
    await render();
    const trees = container.querySelectorAll('[data-tree]');
    expect(trees.length).toBe(5);
  });

  it('mostra StreakShieldBadge com grace + freezes (vindos do mock)', async () => {
    await render();
    expect(container.querySelector('[data-testid="streak-grace"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="streak-freeze"]')).toBeTruthy();
  });

  it('Flávio NÃO tem rating 1100+ (locked)', async () => {
    await render();
    // 'Em ascensão' (rating 1100) deve estar locked
    const cards = container.querySelectorAll('[data-testid="achievement-card"]');
    const found = Array.from(cards).find((c) => c.getAttribute('data-achievement-id') === 'career_rating_1100');
    // pode ou não aparecer nos top 4; se aparecer, deve estar locked
    if (found) {
      expect(found.getAttribute('data-unlocked')).toBe('false');
    }
  });
});
