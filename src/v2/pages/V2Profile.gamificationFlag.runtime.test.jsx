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
// A Minha área (`user_hub`) tem teste próprio: aqui o perfil de sempre.
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: (k) => (k === 'user_hub' ? false : flag.value) }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, userProfile: { platform_name: 'Ana' } }),
}));
vi.mock('@/modules/rating/hooks/useRating', () => ({
  useNationalRanking: () => ({ data: [] }),
}));
vi.mock('@/v2/components/rating/V2DuprRatingBadge', () => ({ default: () => null }));
// Os códigos de indicação (Onda BY) têm teste próprio; aqui só a gamificação.
vi.mock('@/v2/components/arenas/marketing/MyReferralCodes', () => ({ default: () => null }));

// O motor do cliente (XP, conquistas, primeiros passos) é UM hook: com a flag
// desligada ele não pode nem ser chamado — é ele que dispara as ~20 consultas.
const engineSpy = vi.fn(() => ({
  stats: {}, matchDates: [], xp: { total: 0 }, skillTrees: null,
}));
vi.mock('@/modules/progression/hooks/useGamificationEngine', () => ({ useGamificationEngine: (...a) => engineSpy(...a) }));

import V2Profile from '@/v2/pages/V2Profile.jsx';

let container, root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  engineSpy.mockClear();
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
    expect(engineSpy).not.toHaveBeenCalled();
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
    expect(engineSpy).toHaveBeenCalled();
    // o perfil também grava (conquistas, primeiros passos, progressão): é o dono olhando
    expect(engineSpy.mock.calls[0][1]).toMatchObject({ sync: true });
  });
});
