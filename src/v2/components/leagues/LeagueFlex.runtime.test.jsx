/**
 * A LIGA FLEXÍVEL na tela: quem joga lança o placar (sem W.O.) e o outro lado
 * vê "a confirmar" com o placar lançado e confirma ou contesta.
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

const league = { id: 'l1', format: 'flex_pairs', status: 'running' };
const nome = (id) => ({ ea: 'Os Dinks', eb: 'Kitchen' }[id]);
const jogo = { id: 'm1', side_a: 'ea', side_b: 'eb', phase: 'season', round: 1, status: 'scheduled', games: [] };

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
const botao = (c, texto) => [...c.querySelectorAll('button')].find((b) => b.textContent === texto);

describe('liga flexível', () => {
  it('quem joga lança o placar, sem W.O.', async () => {
    const c = await render(<MatchRow league={league} match={jogo} nome={nome} meu meuLado="a" editavel={false} />);
    await act(async () => { c.querySelector('button[aria-label="Lançar o placar"]').click(); });
    expect(c.querySelector('select')).toBeNull();
    const [a, b] = c.querySelectorAll('input[type="number"]');
    await act(async () => { digita(a, '11'); digita(b, '7'); });
    await act(async () => { botao(c, 'Salvar placar').click(); });
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ action: 'report', games: [{ a: 11, b: 7 }], wo_winner: undefined }));
  });

  it('o outro lado vê o placar a confirmar e confirma', async () => {
    const lancado = { ...jogo, status: 'reported', report: { side: 'a', by: 'u-2', games: [{ a: 11, b: 7 }] } };
    const c = await render(<MatchRow league={league} match={lancado} nome={nome} meu meuLado="b" editavel={false} />);
    expect(c.textContent).toContain('A confirmar');
    expect(c.textContent).toContain('Lançado por Os Dinks: 11–7');
    expect(c.querySelector('button[aria-label="Lançar o placar"]')).toBeNull();
    await act(async () => { botao(c, 'Confirmar o placar').click(); });
    expect(mutateAsync).toHaveBeenCalledWith({ action: 'confirm', leagueId: 'l1', matchId: 'm1', accept: true });
  });

  it('quem não joga não lança nem confirma', async () => {
    const lancado = { ...jogo, status: 'reported', report: { side: 'a', by: 'u-2', games: [{ a: 11, b: 7 }] } };
    const c = await render(<MatchRow league={league} match={lancado} nome={nome} meu={false} editavel={false} />);
    expect(botao(c, 'Confirmar o placar')).toBeUndefined();
    expect(c.querySelector('button[aria-label="Lançar o placar"]')).toBeNull();
  });
});
