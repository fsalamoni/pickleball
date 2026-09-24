/**
 * "Torneios da casa" na página da arena.
 *
 * O que protege:
 *  1. ⭐ o próximo torneio aberto aparece, com a inscrição ali mesmo;
 *  2. o que está rolando leva ao jogo;
 *  3. o topo da classificação da casa aparece (com o módulo de ladder);
 *  4. sem nada, a seção não aparece; sem login, não consulta.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const estado = { logado: true, torneios: [], ladder: [], ligados: new Set() };
const consultas = [];
const entrar = vi.fn(() => Promise.resolve());

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ isAuthenticated: estado.logado, user: estado.logado ? { uid: 'eu' } : null }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => estado.ligados.has(id) }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaInternalTournaments: (id) => { consultas.push(id); return { data: id ? estado.torneios : [] }; },
  useArenaLadder: (id) => ({ data: id ? estado.ladder : [] }),
  useJoinTournament: () => ({ mutateAsync: entrar, isPending: false }),
}));

const { default: Secao } = await import('./ArenaHouseTournamentsSection.jsx');

const torneio = (over = {}) => ({
  id: 't1', arena_id: 'a1', name: 'Americano de sábado', date: '2099-10-03', start_time: '14:00',
  status: 'scheduled', max_participants: 8, enrolled: 2, entry_fee: 0, participants: [], format: 'americano', ...over,
});

let container, root;
beforeEach(() => {
  Object.assign(estado, { logado: true, torneios: [], ladder: [], ligados: new Set() });
  consultas.length = 0;
  entrar.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render() {
  await act(async () => {
    root.render(<MemoryRouter><Secao arena={{ id: 'a1', name: 'Arena' }} /></MemoryRouter>);
  });
}

describe('Torneios da casa na página da arena', () => {
  it('sem torneio e sem classificação, não aparece', async () => {
    await render();
    expect(container.innerHTML).toBe('');
  });

  it('⭐ o próximo torneio aberto aparece, com a inscrição ali mesmo', async () => {
    estado.torneios = [torneio()];
    await render();
    expect(container.textContent).toContain('Americano de sábado');
    expect(container.textContent).toContain('gratuito');
    const b = [...container.querySelectorAll('button')].find((x) => x.textContent === 'Quero jogar');
    await act(async () => { b.click(); });
    expect(entrar).toHaveBeenCalledWith({ arenaId: 'a1', tid: 't1' });
  });

  it('quem já está inscrito vê isso', async () => {
    estado.torneios = [torneio({ participants: ['eu'] })];
    await render();
    expect(container.textContent).toContain('Você está inscrito');
  });

  it('o torneio rolando leva ao jogo', async () => {
    estado.torneios = [torneio({ status: 'running', game_day_id: 'gd1' })];
    await render();
    const link = [...container.querySelectorAll('a')].find((a) => a.textContent.includes('Acompanhar'));
    expect(link.getAttribute('href')).toBe('/dia-de-jogo/gd1');
  });

  it('torneio passado, cancelado ou encerrado não entra na vitrine', async () => {
    estado.torneios = [
      torneio({ id: 'a', date: '2020-01-01' }),
      torneio({ id: 'b', status: 'cancelled' }),
      torneio({ id: 'c', status: 'finished' }),
    ];
    await render();
    expect(container.innerHTML).toBe('');
  });

  it('com o ladder ligado, mostra o topo da classificação', async () => {
    estado.ligados.add(ARENA_MODULE_ID.LEAGUES_LADDER);
    estado.ladder = [{ user_id: 'u1', name: 'Ana', points: 170, ladder_position: 1 }];
    await render();
    expect(container.textContent).toContain('1º Ana · 170 pts');
  });

  it('sem login, nem consulta', async () => {
    estado.logado = false;
    estado.torneios = [torneio()];
    await render();
    expect(consultas.every((id) => id === null)).toBe(true);
    expect(container.innerHTML).toBe('');
  });
});
