/**
 * O cartão do controle de linhas no dia de jogo é um cartão COLAPSÁVEL como os
 * demais: nasce recolhido para quem organiza, e o cabeçalho diz como está,
 * quadra por quadra. Abrir mostra a lista das quadras.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => true }));
const papel = { config: true };
vi.mock('@/modules/games/hooks/useGameDayRoles', () => ({
  useGameDayRoles: () => ({ podeConfigurarLinhas: papel.config }),
}));
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useMyGameDays: () => ({ data: [], isSuccess: true }),
  useGameDayGames: () => ({ data: [] }),
}));
const quadras = { data: [] };
vi.mock('@/modules/linecall/hooks/useGameDayLineCourts', () => ({
  useGameDayLineCourts: () => ({ ...quadras, isSuccess: true, isError: false, isLoading: false }),
  useSaveGameDayLineCourts: () => ({ mutate: vi.fn(), isPending: false }),
}));

const { default: GameDayLineControlCard } = await import('./GameDayLineControlCard.jsx');

let host; let root;
const montar = async () => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <GameDayLineControlCard gameDay={{ id: 'gd1', play_courts: 3 }} />
      </MemoryRouter>,
    );
  });
};

beforeEach(() => {
  localStorage.clear();
  papel.config = true;
  quadras.data = [];
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('GameDayLineControlCard', () => {
  it('nasce recolhido para quem organiza, com o resumo de cada quadra', async () => {
    quadras.data = [
      { id: 'court-1', line_control: true, line_control_layout: 'fundo-a' },
      { id: 'court-3', line_control: false },
    ];
    await montar();
    expect(host.querySelector('[data-dica="linhas-quadras"]')).toBeNull();
    expect(host.textContent).toMatch(/Quadra 1: \d câmera\(s\)/);
    expect(host.textContent).not.toMatch(/Quadra 3:/);

    const abrir = host.querySelector('button[aria-expanded="false"]');
    await act(async () => { abrir.click(); });
    expect(host.querySelector('[data-dica="linhas-quadras"]')).not.toBeNull();
    expect(host.textContent).toContain('Quadra 2');
  });

  it('desligado em todas: o resumo diz quantas quadras', async () => {
    await montar();
    expect(host.textContent).toContain('Desligado nas 3 quadra(s)');
  });

  it('para quem só participa, aparece aberto quando há quadra ligada', async () => {
    papel.config = false;
    quadras.data = [{ id: 'court-2', line_control: true }];
    await montar();
    expect(host.querySelector('[data-dica="linhas-quadras"]')).not.toBeNull();
  });
});
