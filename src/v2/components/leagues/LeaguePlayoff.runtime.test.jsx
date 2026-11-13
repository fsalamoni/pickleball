/**
 * O PLAYOFF na tela: sem chave, quem organiza vê os N primeiros da tabela e
 * monta a chave com eles (na ordem da classificação); com a final jogada, o
 * campeão, o vice e o 3º lugar aparecem no topo.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';

const mutateAsync = vi.fn(async () => ({}));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u-1' } }) }));
vi.mock('@/modules/leagues/hooks/useLeagues', () => ({ useLeagueAction: () => ({ mutateAsync, isPending: false }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { default: LeaguePlayoff } = await import('./LeaguePlayoff.jsx');

const q = (data) => ({ data, isLoading: false, isError: false });
const league = { id: 'l1', format: 'divisional_pairs', status: 'running', season: { playoff: { enabled: true, size: 4, third_place: true } } };
const entries = ['A', 'B', 'C', 'D', 'E'].map((n) => ({ id: `e${n}`, division_id: 'd1', name: `Dupla ${n}`, status: 'active', player_uids: [] }));
const venceu = (a, b, lado = 'a', extra = {}) => ({ id: `${a}-${b}`, division_id: 'd1', phase: 'season', side_a: a, side_b: b, status: 'done', games: [lado === 'a' ? { a: 11, b: 3 } : { a: 3, b: 11 }], ...extra });
// D vence todo mundo, depois B, C, A, E.
const temporada = [
  venceu('eD', 'eB'), venceu('eD', 'eC'), venceu('eD', 'eA'), venceu('eD', 'eE'),
  venceu('eB', 'eC'), venceu('eB', 'eA'), venceu('eB', 'eE'), venceu('eC', 'eA'), venceu('eC', 'eE'), venceu('eA', 'eE'),
];

let root;
let el;
async function render(matches) {
  el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => {
    root.render(<MemoryRouter><LeaguePlayoff league={league} divisions={q([{ id: 'd1', name: 'Ouro' }])} entries={q(entries)} matches={q(matches)} canManage /></MemoryRouter>);
  });
  return el;
}
afterEach(() => { act(() => root.unmount()); el.remove(); mutateAsync.mockClear(); });

describe('playoff da liga', () => {
  it('mostra os 4 primeiros da tabela e monta a chave na ordem da classificação', async () => {
    const c = await render(temporada);
    expect(c.textContent).toContain('Playoff com os 4 primeiros');
    expect([...c.querySelectorAll('ol li')].map((li) => li.textContent)).toEqual(['1Dupla D', '2Dupla B', '3Dupla C', '4Dupla A']);
    const botao = [...c.querySelectorAll('button')].find((b) => b.textContent === 'Montar a chave');
    await act(async () => { botao.click(); });
    expect(mutateAsync).toHaveBeenCalledWith({ leagueId: 'l1', divisionId: 'd1', action: 'playoff', seeds: ['eD', 'eB', 'eC', 'eA', 'eE'] });
  });

  it('com a final jogada mostra o campeão e cada fase com as cabeças', async () => {
    const po = (a, b, lado, extra) => venceu(a, b, lado, { phase: 'playoff', ...extra });
    const c = await render([
      ...temporada,
      po('eD', 'eA', 'a', { round: 1, slot: 0, seed_a: 1, seed_b: 4 }),
      po('eB', 'eC', 'b', { round: 1, slot: 1, seed_a: 2, seed_b: 3 }),
      po('eD', 'eC', 'b', { round: 2, slot: 0 }),
      po('eA', 'eB', 'a', { round: 2, slot: 1, third: true }),
    ]);
    expect(c.textContent).toContain('Campeão da divisão Ouro');
    expect(c.textContent).toContain('Vice: Dupla D');
    expect(c.textContent).toContain('3º lugar: Dupla A');
    expect(c.textContent).toContain('Semifinal');
    expect(c.textContent).toContain('Disputa do 3º lugar');
    expect(c.textContent).toContain('(1) Dupla D');
    expect(c.textContent).not.toContain('Refazer a chave');
  });
});
