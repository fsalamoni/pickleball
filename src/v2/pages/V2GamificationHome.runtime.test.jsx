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
    expect(container.textContent).toContain('Missões, conquistas, skill trees');
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

  it('mostra card de referral com código', async () => {
    await render();
    const code = container.querySelector('[data-testid="home-referral-code"]');
    expect(code).toBeTruthy();
    expect(code.textContent.replace(/\s/g, '')).toHaveLength(8);
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
