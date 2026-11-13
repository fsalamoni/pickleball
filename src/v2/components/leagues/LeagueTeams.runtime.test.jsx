/**
 * As EQUIPES na tela: o confronto mostra o placar por jogo (feminina,
 * masculina, mistas) e o DreamBreaker; o lançamento pede uma linha por jogo e
 * só abre o DreamBreaker quando os jogos empatam em 2 a 2.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';

const mutateAsync = vi.fn(async () => ({}));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u-1' } }) }));
vi.mock('@/modules/leagues/hooks/useLeagues', () => ({ useLeagueAction: () => ({ mutateAsync, isPending: false }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { MatchRow } = await import('./LeagueRounds.jsx');

const league = { id: 'l1', format: 'team_milp', status: 'running' };
const nome = (id) => ({ ea: 'Os Dinks', eb: 'Kitchen' }[id]);
const feito = {
  id: 'm1', side_a: 'ea', side_b: 'eb', phase: 'season', round: 1, status: 'done',
  games: [{ a: 21, b: 15 }, { a: 18, b: 21 }, { a: 21, b: 19 }, { a: 12, b: 21 }], dreambreaker: { a: 21, b: 17 },
};

let root;
let el;
async function render(node) {
  el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => { root.render(<MemoryRouter><ul>{node}</ul></MemoryRouter>); });
  return el;
}
afterEach(() => { act(() => root.unmount()); el.remove(); mutateAsync.mockClear(); });

const digita = (input, valor) => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(input, valor);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('confronto de equipes', () => {
  it('mostra 2–2 com o DreamBreaker e o placar de cada jogo', async () => {
    const c = await render(<MatchRow league={league} match={feito} nome={nome} meu={false} editavel={false} />);
    expect(c.textContent).toContain('2–2 · DB 21–17');
    expect(c.textContent).toContain('Duplas femininas');
    expect(c.textContent).toContain('Mista 2');
    expect(c.querySelector('.font-bold.text-ink')?.textContent).toBe('Os Dinks');
  });

  it('o lançamento tem uma linha por jogo e abre o DreamBreaker só no empate', async () => {
    const c = await render(<MatchRow league={league} match={{ ...feito, games: [], dreambreaker: null, status: 'scheduled' }} nome={nome} meu={false} editavel />);
    await act(async () => { c.querySelector('button[aria-label="Lançar o placar"]').click(); });
    const campos = () => [...c.querySelectorAll('input[type="number"]')];
    expect(campos()).toHaveLength(8);
    expect(c.textContent).not.toContain('Mais um game');
    const placar = [21, 15, 18, 21, 21, 19, 12, 21];
    await act(async () => { campos().forEach((i, k) => digita(i, String(placar[k]))); });
    expect(c.textContent).toContain('Empate nos jogos: informe o placar do DreamBreaker.');
    expect(campos()).toHaveLength(10);
    const salvar = () => [...c.querySelectorAll('button')].find((b) => b.textContent === 'Salvar placar');
    expect(salvar().disabled).toBe(true);
    await act(async () => { digita(campos()[8], '21'); digita(campos()[9], '17'); });
    expect(salvar().disabled).toBe(false);
    await act(async () => { salvar().click(); });
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ action: 'result', dreambreaker: { a: 21, b: 17 } }));
  });
});
