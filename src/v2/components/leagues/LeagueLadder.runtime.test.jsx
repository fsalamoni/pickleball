/**
 * A escada na tela: a aba Escada mostra a posição e quem subiu; a aba Sessões
 * mostra as quadras com Sobe/Desce; a chamada de Gerir → Sessões prevê as
 * quadras e diz quando o número de presentes não fecha.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { americanoCourtMatches } from '@/core/domain/americanoGroups';

vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u-A' } }) }));
vi.mock('@/modules/leagues/hooks/useLeagues', () => ({ useLeagueAction: () => ({ mutateAsync: vi.fn(), isPending: false }) }));

const { default: LeagueLadder, LeagueSessions } = await import('./LeagueLadder.jsx');
const { default: LeagueSessionPanel } = await import('./LeagueSessionPanel.jsx');

const ok = (data) => ({ data, isSuccess: true, isLoading: false, isError: false, refetch: vi.fn() });
const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const entries = ids.map((id, i) => ({
  id, name: `Atleta ${id}`, status: 'active', division_id: 'd1', player_uids: [`u-${id}`],
  players: [{ dupr: 5 - i * 0.1 }], created_at: { seconds: 1, nanoseconds: 0 },
}));
const jogos = [['A', 'B', 'C', 'D'], ['E', 'F', 'G', 'H']].flatMap((q, g) => americanoCourtMatches(q).map((m, k) => ({
  id: `j${g}${k}`, division_id: 'd1', phase: 'ladder', session: 1, group: g, round: m.round, team_a: m.team_a, team_b: m.team_b,
  games: [{ a: 11, b: 4 }], wo_winner: null, status: 'done', created_at: { seconds: 10, nanoseconds: 0 },
})));
const league = { id: 'l1', format: 'ladder_individual', status: 'running', season: { cadence: 'weekly', start_date: '2026-11-16' }, standings: {} };
const props = { league, divisions: ok([{ id: 'd1', name: 'Principal' }]), entries: ok(entries), matches: ok(jogos), canManage: true };

let root;
let el;
async function render(node) {
  el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => { root.render(<MemoryRouter>{node}</MemoryRouter>); });
  return el;
}
afterEach(() => { act(() => root.unmount()); el.remove(); });

describe('telas da escada', () => {
  it('a escada mostra todos e a nota da sessão', async () => {
    const c = await render(<LeagueLadder {...props} />);
    expect(c.textContent).toContain('Depois da sessão 1');
    expect(c.querySelectorAll('tbody tr')).toHaveLength(8);
    expect(c.textContent).toContain('Subiu de quadra');
  });

  it('as sessões mostram as duas quadras com quem sobe e quem desce', async () => {
    const c = await render(<LeagueSessions {...props} />);
    expect(c.textContent).toContain('Sessão 1');
    expect(c.textContent).toContain('Quadra 2');
    expect(c.textContent).toContain('Sobe');
    expect(c.textContent).toContain('Desce');
  });

  it('a chamada prevê as quadras e avisa quando não fecha', async () => {
    const c = await render(<LeagueSessionPanel {...props} salvar={vi.fn()} pending={false} />);
    expect(c.textContent).toContain('8 presentes em 2 quadras');
    expect(c.textContent).toContain('Gerar a sessão 2');
    const caixas = [...c.querySelectorAll('[role="checkbox"]')];
    await act(async () => { caixas[0].click(); caixas[1].click(); });
    expect(c.textContent).toContain('Fecha com 5 ou 8 presentes.');
    const gerar = [...c.querySelectorAll('button')].find((b) => b.textContent.includes('Gerar a sessão 2'));
    expect(gerar.disabled).toBe(true);
  });
});
