/**
 * A tela do controle de linhas de uma quadra NÃO cai numa releitura que
 * falha. O aparelho da câmera fica horas filmando: um soluço do Wi-Fi faz a
 * releitura do dia ou das quadras falhar, e o React Query guarda o dado
 * anterior com `isError`. Antes a tela trocava tudo pelo erro — a câmera
 * desmontava no meio do jogo. Erro só quando não há dado nenhum.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = {
  dia: { data: { id: 'G1', title: 'Dia', created_by: 'u1', play_courts: 2 }, isLoading: false, isError: false },
  quadras: { data: [{ id: 'court-1', line_control: true, line_control_layout: 'solo_fundo' }], isLoading: false, isError: false },
};

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => true }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useGameDay: () => ({ ...estado.dia, refetch: vi.fn() }),
  useGameDayGames: () => ({ data: [] }),
}));
vi.mock('@/modules/games/hooks/useGameDayRoles', () => ({ useGameDayRoles: () => ({ podeConfigurarLinhas: true }) }));
vi.mock('@/modules/linecall/hooks/useLineControlLive', () => ({ useLineControlLive: () => ({ cams: [], lances: [] }) }));
vi.mock('@/modules/linecall/hooks/useGameDayLineCourts', () => ({
  useGameDayLineCourts: () => ({ ...estado.quadras, refetch: vi.fn() }),
  useSaveGameDayLineCourts: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/v2/components/linecall/LineControlScreen', () => ({ default: () => <div data-testid="camera">câmera no ar</div> }));
vi.mock('@/v2/components/linecall/LineCourtsBoard', () => ({ default: () => <div>quadras</div> }));

const { default: V2LineControl } = await import('./V2LineControl.jsx');

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

function render() {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/dia-de-jogo/G1/linhas?quadra=court-1&modo=camera']}>
        <Routes><Route path="/dia-de-jogo/:gameDayId/linhas" element={<V2LineControl />} /></Routes>
      </MemoryRouter>,
    );
  });
}

describe('V2LineControl', () => {
  it('a câmera está no ar com a quadra ligada', () => {
    render();
    expect(container.querySelector('[data-testid="camera"]')).not.toBeNull();
  });

  it('⭐ a releitura que FALHA (com o dado de antes) não derruba a câmera', () => {
    estado.dia = { ...estado.dia, isError: true };
    estado.quadras = { ...estado.quadras, isError: true };
    render();
    expect(container.querySelector('[data-testid="camera"]')).not.toBeNull();
  });

  it('sem dado nenhum, a falha é dita (com "Tentar de novo")', () => {
    estado.dia = { data: undefined, isLoading: false, isError: true };
    render();
    expect(container.querySelector('[data-testid="camera"]')).toBeNull();
    expect(container.textContent).toMatch(/Tentar de novo/);
  });
});
