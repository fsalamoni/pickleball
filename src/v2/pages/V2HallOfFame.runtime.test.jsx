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

const mockPlayers = [
  { uid: 'u1', xpTotal: 5500, tier: 'Craque', level: 8, achievementsUnlocked: 25, achievementsTotal: 83 },
  { uid: 'u2', xpTotal: 4500, tier: 'Competidor', level: 7, achievementsUnlocked: 18, achievementsTotal: 83 },
  { uid: 'u3', xpTotal: 4000, tier: 'Competidor', level: 6, achievementsUnlocked: 15, achievementsTotal: 83 },
  { uid: 'u4', xpTotal: 3500, tier: 'Jogador', level: 5, achievementsUnlocked: 12, achievementsTotal: 83 },
  { uid: 'u5', xpTotal: 3000, tier: 'Jogador', level: 4, achievementsUnlocked: 10, achievementsTotal: 83 },
];
vi.mock('@/modules/progression/hooks/useHallOfFame', () => ({
  useHallOfFame: () => ({ data: mockPlayers, isLoading: false }),
}));

import V2HallOfFame from './V2HallOfFame.jsx';

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
        <MemoryRouter>
          <V2HallOfFame />
        </MemoryRouter>,
      );
    });
    setTimeout(resolve, 30);
  });
}

describe('V2HallOfFame · flag OFF', () => {
  it('mostra empty state', async () => {
    mockFlagState.value = false;
    await render();
    expect(container.textContent).toContain('Hall da Fama em construção');
  });
});

describe('V2HallOfFame · flag ON', () => {
  it('renderiza título e subtítulo', async () => {
    await render();
    expect(container.textContent).toContain('Hall da Fama');
    expect(container.textContent).toContain('Top 50');
  });

  it('mostra 3 cards de pódio (top 3)', async () => {
    await render();
    const podiums = container.querySelectorAll('[data-testid="hof-podium"]');
    expect(podiums.length).toBe(3);
  });

  it('pódio 1º tem position=1', async () => {
    await render();
    const first = container.querySelector('[data-position="1"]');
    expect(first).toBeTruthy();
  });

  it('pódio 2º tem position=2', async () => {
    await render();
    const second = container.querySelector('[data-position="2"]');
    expect(second).toBeTruthy();
  });

  it('mostra top 50 list com N-3 itens', async () => {
    await render();
    const rows = container.querySelectorAll('[data-testid="hof-row"]');
    // 5 players, 3 no pódio, 2 no ranking
    expect(rows.length).toBe(2);
  });

  it('linha 1 do ranking tem posição #4', async () => {
    await render();
    const first = container.querySelector('[data-testid="hof-row"]');
    expect(first.textContent).toContain('#4');
  });

  it('mostra XP 5.500 do top 1', async () => {
    await render();
    expect(container.textContent).toContain('5.500');
  });

  it('mostra uid truncado (8 chars + …)', async () => {
    await render();
    expect(container.textContent).toMatch(/u1…/);
  });

  it('renderiza 3 tiers diferentes', async () => {
    await render();
    expect(container.textContent).toContain('Craque');
    expect(container.textContent).toContain('Competidor');
    expect(container.textContent).toContain('Jogador');
  });
});

describe('V2HallOfFame · sem dados', () => {
  it('mostra empty state quando lista é vazia', async () => {
    // override o mock
    const useHallMock = await import('@/modules/progression/hooks/useHallOfFame');
    vi.spyOn(useHallMock, 'useHallOfFame').mockReturnValue({ data: [], isLoading: false });
    await render();
    expect(container.textContent).toContain('Ninguém no Hall ainda');
  });
});
