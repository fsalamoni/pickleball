/**
 * O telão do torneio mostra um aviso do controle de linhas por QUADRA ligada
 * (docs/53 §9), e nada com a flag desligada.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const flag = { on: true };
const courts = { data: [] };
const live = vi.fn();

vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => flag.on }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/modules/linecall/hooks/useTournamentLineCourts', () => ({ useTournamentLineCourts: () => courts }));
vi.mock('@/modules/linecall/hooks/useLineControlLive', () => ({
  useLineControlLive: (id) => { live(id); return { isLoading: false, isError: false, cams: [], lances: [] }; },
  useNow: () => 1_000_000,
}));

const { TournamentTelaoLines } = await import('./TelaoLineTicker.jsx');

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  live.mockClear();
  flag.on = true;
});
afterEach(() => { root.unmount(); container.remove(); });

const render = () => new Promise((resolve) => {
  root.render(<TournamentTelaoLines tournamentId="T1" />);
  setTimeout(resolve, 30);
});

describe('TournamentTelaoLines', () => {
  it('⭐ um aviso por quadra ligada, com o nome da quadra', async () => {
    courts.data = [
      { court_id: 'court-1', court_name: 'Quadra 1', line_control: true },
      { court_id: 'court-2', court_name: 'Quadra 2', line_control: false },
    ];
    await render();
    expect(live).toHaveBeenCalledWith('tournament_line_courts/T1_court-1');
    expect(live).not.toHaveBeenCalledWith('tournament_line_courts/T1_court-2');
    expect(container.textContent).toMatch(/Quadra 1 · /);
  });

  it('sem a flag não monta nada', async () => {
    flag.on = false;
    courts.data = [{ court_id: 'court-1', line_control: true }];
    await render();
    expect(container.innerHTML).toBe('');
    expect(live).not.toHaveBeenCalled();
  });
});
