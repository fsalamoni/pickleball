import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockFlagState = { value: true };
vi.mock('@/core/lib/FeatureFlagsContext', () => ({
  useFeatureFlag: () => mockFlagState.value,
}));

const mockUser = { uid: 'u-me', displayName: 'Me' };
const mockRouteUid = 'u-other';
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ uid: mockRouteUid }),
  };
});

vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('@/modules/progression/hooks/useUserProgressionV2', () => ({
  useUserProgressionV2: () => ({
    progression: { uid: 'u-other', xpTotal: 3000, tier: 'Aprendiz', level: 4, achievementsUnlocked: 10, achievementsTotal: 88, skillTrees: [] },
    isLoading: false,
  }),
}));

vi.mock('@/modules/achievements/hooks/useUserAchievementsV2', () => ({
  useUserAchievementsV2: () => ({
    unlocked: [
      { achievementId: 'career_welcome', unlockedAt: 1 },
      { achievementId: 'career_first_win', unlockedAt: 2 },
    ],
    unlockedIds: new Set(['career_welcome', 'career_first_win']),
    isLoading: false,
  }),
}));

vi.mock('@/modules/progression/hooks/useKudoActions', () => ({
  useKudoActions: () => ({
    index: { receivedCount: 5, givenCount: 2, receivedToday: 0, givenToday: 0 },
    received: [], given: [],
    give: () => {}, isGiving: false, giveError: null,
  }),
}));

vi.mock('@/modules/performance/hooks/usePlayerStats', () => ({
  usePlayerStats: () => ({ stats: { tournaments: 8, played: 142, wins: 66, podiums: 1, titles: 0 }, isLoading: false }),
}));

vi.mock('@/modules/rating/hooks/useRating', () => ({
  useNationalRanking: () => ({ data: [{ uid: 'u-other', position: 47, rating: 1023 }] }),
}));

vi.mock('@/modules/athletes/hooks/useAthletes', () => ({
  useAthlete: () => ({ data: { platform_name: 'Ana Prado', photo_url: null } }),
}));

import V2PublicAchievements from './V2PublicAchievements.jsx';

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockFlagState.value = true;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  container = null;
  root = null;
});

function render() {
  return new Promise((resolve) => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={[`/conquistas/${mockRouteUid}`]}>
          <V2PublicAchievements />
        </MemoryRouter>,
      );
    });
    setTimeout(resolve, 30);
  });
}

describe('V2PublicAchievements · flag OFF', () => {
  it('mostra empty state', async () => {
    mockFlagState.value = false;
    await render();
    expect(container.textContent).toContain('Conquistas V2 em construção');
  });
});

describe('V2PublicAchievements · flag ON · outro user', () => {
  it('identifica o atleta pelo NOME, não pelo uid cru', async () => {
    await render();
    expect(container.textContent).toContain('Ana Prado');
    expect(container.textContent).toContain('Conquistas de Ana Prado');
    // o uid é detalhe interno: não deve aparecer na tela
    expect(container.textContent).not.toContain('u-other');
  });

  it('leva ao perfil completo do atleta', async () => {
    await render();
    expect(container.querySelector('a[href="/atleta/u-other"]')).toBeTruthy();
  });

  it('mostra tier + XP', async () => {
    await render();
    expect(container.textContent).toContain('Aprendiz');
    expect(container.textContent).toContain('3.000');
  });

  it('mostra a contagem de conquistas com o total do catálogo', async () => {
    await render();
    expect(container.textContent).toContain('2/88');
  });

  it('tem botão de voltar', async () => {
    await render();
    const back = container.querySelector('a[href="/conquistas"]');
    expect(back).toBeTruthy();
  });

  it('mostra KudosButton pra outro user', async () => {
    await render();
    const btn = container.querySelector('[data-testid="kudos-button"]');
    expect(btn).toBeTruthy();
  });

  it('mostra rating se disponível', async () => {
    await render();
    expect(container.textContent).toContain('#47');
    expect(container.textContent).toContain('1023');
  });

  it('mostra seções de família', async () => {
    await render();
    expect(container.textContent).toContain('Carreira');
  });

  it('marca como desbloqueadas exatamente as conquistas do usuário', async () => {
    await render();
    const cards = container.querySelectorAll('[data-testid="public-achievement-card"]');
    const unlockedCards = [...cards].filter((c) => c.getAttribute('data-unlocked') === 'true');
    expect(cards.length).toBeGreaterThan(0);
    // as duas conquistas mockadas são as primeiras da família "career", então
    // caem dentro do slice(0, 12) e precisam aparecer marcadas
    expect(unlockedCards).toHaveLength(2);
    // mas o mock diz que first_blood + win_streak_3 estão unlocked
    // (win_streak_3 é o último da família match, pode estar fora do top 12)
    // aceitamos >= 0
  });
});
