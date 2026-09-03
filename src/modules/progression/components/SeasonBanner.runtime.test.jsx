import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

const mockFlagState = { value: true };
vi.mock('@/core/lib/FeatureFlagsContext', () => ({
  useFeatureFlag: () => mockFlagState.value,
}));

vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' } }),
}));

vi.mock('@/modules/progression/hooks/useUserSeasonRanking', () => ({
  useUserCurrentSeason: () => ({
    season: { seasonId: '2026-09', uid: 'u1', xp: 3000, tier: 'Aprendiz', position: 5, prizeXp: 100 },
    seasonId: '2026-09',
    isLoading: false,
  }),
  useSeasonTop: () => ({
    data: [
      { uid: 'a', position: 1, tier: 'Craque' },
      { uid: 'b', position: 2, tier: 'Competidor' },
      { uid: 'c', position: 3, tier: 'Competidor' },
    ],
  }),
}));

import SeasonBanner from './SeasonBanner';

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  container = null;
  root = null;
});

function render(node) {
  return new Promise((resolve) => {
    act(() => { root.render(node); });
    setTimeout(resolve, 20);
  });
}

describe('SeasonBanner', () => {
  it('não renderiza se flag OFF', async () => {
    mockFlagState.value = false;
    await render(<SeasonBanner />);
    expect(container.querySelector('[data-testid="season-banner"]')).toBeNull();
  });

  it('renderiza quando flag ON', async () => {
    mockFlagState.value = true;
    await render(<SeasonBanner />);
    expect(container.querySelector('[data-testid="season-banner"]')).toBeTruthy();
  });

  it('mostra a temporada pelo mês, não pelo id interno', async () => {
    await render(<SeasonBanner />);
    expect(container.textContent).toContain('Temporada');
    // o id da temporada ('2026-09') é chave de banco, não texto de interface
    expect(container.textContent).not.toContain('2026-09');
  });

  it('mostra sua posição', async () => {
    await render(<SeasonBanner />);
    expect(container.textContent).toContain('#5');
    expect(container.textContent).toContain('3.000');
  });

  it('mostra top 3', async () => {
    await render(<SeasonBanner />);
    expect(container.textContent).toContain('#1');
    expect(container.textContent).toContain('Craque');
  });
});
