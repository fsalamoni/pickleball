/**
 * O cálculo de conquista precisa virar REGISTRO. Antes nada gravava em
 * `user_achievements_v2`: perfil público e Hall da Fama mostravam 0 para
 * todo mundo e o toast de desbloqueio nunca podia disparar.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockUnlock = vi.fn(async () => ({ ok: true }));
vi.mock('@/modules/achievements/services/achievementsV2Service', () => ({
  unlockAchievementV2: (...a) => mockUnlock(...a),
}));

import { useSyncAchievementsV2 } from './useSyncAchievementsV2.js';

let container = null;
let root = null;

function Harness({ uid, earned, persistedIds, enabled }) {
  useSyncAchievementsV2(uid, earned, persistedIds, enabled);
  return <div data-testid="h" />;
}

async function render(props) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <Harness {...props} />
      </QueryClientProvider>,
    );
  });
  // deixa a escrita assíncrona terminar
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockUnlock.mockClear();
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const ganhas = [
  { id: 'career_welcome', family: 'career', rarity: 'common' },
  { id: 'career_first_win', family: 'career', rarity: 'common' },
];

describe('useSyncAchievementsV2', () => {
  it('grava as conquistas ganhas que ainda não têm registro', async () => {
    await render({ uid: 'u1', earned: ganhas, persistedIds: new Set(), enabled: true });
    expect(mockUnlock).toHaveBeenCalledTimes(2);
    expect(mockUnlock).toHaveBeenCalledWith('u1', 'career_welcome', 'career', 'common');
  });

  it('não regrava o que já está registrado', async () => {
    await render({
      uid: 'u1', earned: ganhas, persistedIds: new Set(['career_welcome']), enabled: true,
    });
    expect(mockUnlock).toHaveBeenCalledTimes(1);
    expect(mockUnlock).toHaveBeenCalledWith('u1', 'career_first_win', 'career', 'common');
  });

  it('não faz nada quando tudo já está registrado', async () => {
    await render({
      uid: 'u1', earned: ganhas,
      persistedIds: new Set(['career_welcome', 'career_first_win']), enabled: true,
    });
    expect(mockUnlock).not.toHaveBeenCalled();
  });

  it('não grava com a flag desligada', async () => {
    await render({ uid: 'u1', earned: ganhas, persistedIds: new Set(), enabled: false });
    expect(mockUnlock).not.toHaveBeenCalled();
  });

  it('não grava sem uid (visitante)', async () => {
    await render({ uid: null, earned: ganhas, persistedIds: new Set(), enabled: true });
    expect(mockUnlock).not.toHaveBeenCalled();
  });

  it('não quebra se a lista de ganhas ainda não carregou', async () => {
    await render({ uid: 'u1', earned: undefined, persistedIds: new Set(), enabled: true });
    expect(mockUnlock).not.toHaveBeenCalled();
  });

  it('uma falha de escrita não derruba o componente', async () => {
    mockUnlock.mockRejectedValueOnce(new Error('permission-denied'));
    await render({ uid: 'u1', earned: ganhas, persistedIds: new Set(), enabled: true });
    expect(container.querySelector('[data-testid="h"]')).toBeTruthy();
  });
});
