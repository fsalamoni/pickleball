/**
 * Os dois telões (torneio e dia de jogo) mostram um aviso do controle de
 * linhas por QUADRA ligada (docs/53 §3 e §9), e nada com a flag desligada.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const flag = { on: true };
const courts = { data: [] };
const dayCourts = { data: [] };
const dayHook = vi.fn();
const live = vi.fn();

vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => flag.on }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/modules/linecall/hooks/useTournamentLineCourts', () => ({ useTournamentLineCourts: () => courts }));
vi.mock('@/modules/linecall/hooks/useGameDayLineCourts', () => ({
  useGameDayLineCourts: (id, opts) => { dayHook(id, opts); return dayCourts; },
}));
vi.mock('@/modules/linecall/hooks/useLineControlLive', () => ({
  useLineControlLive: (id) => { live(id); return { isLoading: false, isError: false, cams: [], lances: [] }; },
  useNow: () => 1_000_000,
}));

const { default: TelaoLineTicker, TournamentTelaoLines } = await import('./TelaoLineTicker.jsx');

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  live.mockClear();
  dayHook.mockClear();
  flag.on = true;
});
afterEach(() => { root.unmount(); container.remove(); });

const render = (el = <TournamentTelaoLines tournamentId="T1" />) => new Promise((resolve) => {
  root.render(el);
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

describe('TelaoLineTicker (dia de jogo)', () => {
  it('⭐ um aviso por quadra ligada, no caminho da quadra', async () => {
    dayCourts.data = [
      { id: 'court-2', line_control: true },
      { id: 'court-1', line_control: false },
      { id: 'court-3', line_control: true, line_control_layout: 'quatro' },
    ];
    await render(<TelaoLineTicker gameDay={{ id: 'G1' }} />);
    expect(live).toHaveBeenCalledWith('game_days/G1/line_courts/court-2');
    expect(live).toHaveBeenCalledWith('game_days/G1/line_courts/court-3');
    expect(live).not.toHaveBeenCalledWith('game_days/G1/line_courts/court-1');
    expect(container.textContent).toMatch(/Quadra 2 · /);
    expect(container.textContent).toMatch(/Quadra 3 · /);
  });

  it('o campo antigo do dia (line_control no game_days) não liga nada', async () => {
    dayCourts.data = [];
    await render(<TelaoLineTicker gameDay={{ id: 'G1', line_control: true }} />);
    expect(container.innerHTML).toBe('');
    expect(live).not.toHaveBeenCalled();
  });

  it('sem a flag não consulta as quadras', async () => {
    flag.on = false;
    dayCourts.data = [{ id: 'court-1', line_control: true }];
    await render(<TelaoLineTicker gameDay={{ id: 'G1' }} />);
    expect(container.innerHTML).toBe('');
    expect(dayHook).toHaveBeenCalledWith('G1', expect.objectContaining({ enabled: false }));
  });
});
