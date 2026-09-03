/**
 * Garantia da promessa da flag: com GAMIFICATION_V2 desligada, NADA da V2
 * monta e nenhum hook de gamificação dispara consulta.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const flag = { value: false };
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => flag.value }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, userProfile: { platform_name: 'Ana' } }),
}));
vi.mock('@/modules/rating/hooks/useRating', () => ({
  useNationalRanking: () => ({ data: [] }),
}));
vi.mock('@/v2/components/rating/V2DuprRatingBadge', () => ({ default: () => null }));

const statsSpy = vi.fn(() => ({ stats: {}, isLoading: false }));
const matchDatesSpy = vi.fn(() => ({ data: [] }));
const syncSpy = vi.fn(() => ({ progression: null }));
vi.mock('@/modules/performance/hooks/usePlayerStats', () => ({ usePlayerStats: (...a) => statsSpy(...a) }));
vi.mock('@/modules/progression/hooks/useProgression', () => ({ usePlayerMatchDates: (...a) => matchDatesSpy(...a) }));
vi.mock('@/modules/progression/hooks/useSyncProgressionV2', () => ({ useSyncProgressionV2: (...a) => syncSpy(...a) }));

import V2Profile from '@/v2/pages/V2Profile.jsx';

let container, root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  statsSpy.mockClear(); matchDatesSpy.mockClear(); syncSpy.mockClear();
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

async function render() {
  await act(async () => {
    root.render(<MemoryRouter><V2Profile /></MemoryRouter>);
  });
}

describe('V2Profile · flag GAMIFICATION_V2 OFF', () => {
  it('não monta o bloco de progressão V2', async () => {
    flag.value = false;
    await render();
    expect(container.querySelector('[data-testid="profile-progression-v2"]')).toBeNull();
  });

  it('não dispara NENHUMA consulta de gamificação', async () => {
    flag.value = false;
    await render();
    expect(statsSpy).not.toHaveBeenCalled();
    expect(matchDatesSpy).not.toHaveBeenCalled();
    expect(syncSpy).not.toHaveBeenCalled();
  });

  it('o perfil em si continua funcionando', async () => {
    flag.value = false;
    await render();
    expect(container.textContent).toContain('Ana');
  });
});

describe('V2Profile · flag GAMIFICATION_V2 ON', () => {
  it('monta o bloco e aí sim consulta', async () => {
    flag.value = true;
    await render();
    expect(container.querySelector('[data-testid="profile-progression-v2"]')).toBeTruthy();
    expect(statsSpy).toHaveBeenCalled();
    expect(syncSpy).toHaveBeenCalled();
  });
});
