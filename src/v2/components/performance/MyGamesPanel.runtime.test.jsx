/**
 * Meus jogos → Próximos: os jogos agendados nos torneios E os jogos de liga
 * sem placar, numa lista só. A liga que não carregou é dita — nunca "nenhum
 * jogo agendado".
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const est = vi.hoisted(() => ({ torneio: [], liga: {} }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'eu' } }) }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }) => ({ data: queryKey[0] === 'my-games-upcoming' ? est.torneio : [], isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('@/modules/tournament/services/upcomingService', () => ({ getMyUpcomingMatches: vi.fn(), getMyFinishedMatches: vi.fn() }));
vi.mock('@/modules/games/hooks/useGameDays', () => ({ useMyGameDayGames: () => ({ data: [], isLoading: false }) }));
vi.mock('@/modules/leagues/hooks/useLeagues', () => ({ useMyLeagueActivity: () => est.liga }));

import MyGamesPanel from './MyGamesPanel';

let raiz;
let el;
function montar() {
  el = document.createElement('div');
  document.body.appendChild(el);
  raiz = createRoot(el);
  act(() => raiz.render(<MemoryRouter><MyGamesPanel /></MemoryRouter>));
  return el;
}
afterEach(() => { act(() => raiz?.unmount()); document.body.innerHTML = ''; });

const daLiga = (id, extra = {}) => ({ id, leagueId: 'l1', leagueName: 'Liga de Outono', round: 3, date: '2099-01-10', time: '19:30', team: '', partner: 'Ana', opponent: 'Bia / Caio', ...extra });
const okLiga = (upcoming) => ({ data: { games: [], upcoming, seasons: [] }, isLoading: false, isError: false, refetch: vi.fn() });

describe('Meus jogos — Próximos', () => {
  it('⭐ junta torneio e liga pela data; o jogo de liga sem data fica por último', () => {
    est.torneio = [{ matchId: 'm1', tournamentId: 't1', tournamentName: 'Open', partner: 'Ana', opponent: 'Duda / Eva', scheduledAt: new Date(2099, 0, 20, 10).getTime(), court: 'Quadra 2' }];
    est.liga = okLiga([daLiga('a'), daLiga('b', { date: null, opponent: 'Fê / Gui' })]);
    const out = montar();
    expect(out.textContent).toContain('Próximos (3)');
    const titulos = [...out.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(titulos).toEqual(['/ligas/l1', '/torneios/t1', '/ligas/l1']);
    expect(out.textContent).toContain('Liga de Outono · Rodada 3');
    expect(out.textContent).toContain('Você / Ana');
    expect(out.textContent).toContain('Data a combinar');
    expect(out.textContent).toContain('A combinar');
  });

  it('nas equipes o meu lado é a equipe', () => {
    est.torneio = [];
    est.liga = okLiga([daLiga('a', { team: 'Os Dinks', partner: '', opponent: 'Kitchen FC' })]);
    const out = montar();
    expect(out.textContent).toContain('Os Dinks');
    expect(out.textContent).not.toContain('Você');
  });

  it('🔴 a liga que não carregou é dita: não afirma "nenhum jogo agendado"', () => {
    est.torneio = [];
    est.liga = { data: undefined, isLoading: false, isError: true, refetch: vi.fn() };
    const out = montar();
    expect(out.textContent).toContain('Os jogos de liga não carregaram');
    expect(out.textContent).not.toContain('Nenhum jogo agendado');
  });

  it('sem nada marcado em torneio nem liga, diz que não há jogo agendado', () => {
    est.torneio = [];
    est.liga = okLiga([]);
    expect(montar().textContent).toContain('Nenhum jogo agendado');
  });
});
