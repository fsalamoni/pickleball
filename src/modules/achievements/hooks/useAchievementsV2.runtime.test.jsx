/**
 * Teste do hook `useAchievementsV2`.
 *
 * Estratégia: usa `useState` no harness que é atualizado via `useEffect`
 * quando o resultado do hook muda (incluindo mudança de filtros).
 * Cada teste desmonta o componente e remonta, garantindo fresh state.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockAuth = { user: { uid: 'u1', displayName: 'Test' } };
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => mockAuth,
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
  usePlayerMatchDates: () => ({ data: [Date.now() - 1 * 7 * 86400000] }),
}));

import { useAchievementsV2 } from './useAchievementsV2.js';

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
  root = null;
  container = null;
});

/**
 * Harness que retorna o resultado do hook via `useEffect` (após commit).
 * Usa JSON.stringify pra "esconder" o `r` no DOM e o teste poder ler.
 */
function TestHarness({ filters, onResult }) {
  const r = useAchievementsV2({ filters });
  React.useEffect(() => {
    onResult?.(r);
  });
  return null;
}

async function captureOnce(filters) {
  return new Promise((resolve) => {
    let captured = null;
    root.render(
      <TestHarness
        filters={filters}
        onResult={(r) => { captured = r; }}
      />,
    );
    // espera 2 ciclos pra garantir que o useEffect rodou
    setTimeout(() => setTimeout(() => resolve(captured), 30), 30);
  });
}

describe('useAchievementsV2', () => {
  it('retorna isLoading=false quando dados carregam', async () => {
    const r = await captureOnce();
    expect(r.isLoading).toBe(false);
  });

  it('retorna user com stats/rating/streak populados', async () => {
    const r = await captureOnce();
    expect(r.user.uid).toBe('u1');
    expect(r.user.rating).toBe(1023);
    expect(r.user.streak.weeks).toBeGreaterThanOrEqual(1);
  });

  it('retorna result com unlockedCount > 0', async () => {
    const r = await captureOnce();
    expect(r.result.unlockedCount).toBeGreaterThan(0);
  });

  it('filtro por família funciona: "social" tem unlocked apenas de social', async () => {
    const r = await captureOnce({ family: 'social' });
    r.result.unlocked.forEach((a) => {
      expect(a.family).toBe('social');
    });
  });

  it('filtro por raridade funciona: "legendary" tem 0 unlocked', async () => {
    const r = await captureOnce({ rarity: 'legendary' });
    expect(r.result.unlockedCount).toBe(0);
  });

  it('filtro por raridade "common" desbloqueia várias', async () => {
    const r = await captureOnce({ rarity: 'common' });
    expect(r.result.unlockedCount).toBeGreaterThan(0);
    r.result.unlocked.forEach((a) => {
      expect(a.rarity).toBe('common');
    });
  });
});
