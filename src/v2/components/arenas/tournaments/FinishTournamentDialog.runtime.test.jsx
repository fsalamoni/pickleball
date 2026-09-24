/**
 * Encerrar o torneio da casa.
 *
 * O que protege:
 *  1. ⭐ com placar, o pódio vem do ranking do dia e mostra os pontos de cada
 *     um ANTES de confirmar;
 *  2. ⭐ o que vai para o serviço é a classificação conferida, com posição;
 *  3. sem placar (Play), o pódio começa vazio — a arena escolhe;
 *  4. trocar alguém de posição não o deixa em duas.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { formato: 'americano', participantes: [], jogos: [] };
const encerrar = vi.fn(() => Promise.resolve([]));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useGameDay: () => ({ data: { id: 'gd1', format: estado.formato }, isLoading: false }),
  useGameDayParticipants: () => ({ data: estado.participantes, isLoading: false }),
  useGameDayGames: () => ({ data: estado.jogos, isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useFinishTournament: () => ({ mutateAsync: encerrar, isPending: false }),
}));

const { default: FinishTournamentDialog } = await import('./FinishTournamentDialog.jsx');

const p = (id, uid, name) => ({ id, user_id: uid, name });
const jogo = (a, b, sa, sb) => ({ side_a: a.map((id) => ({ id })), side_b: b.map((id) => ({ id })), score_a: sa, score_b: sb });
const torneio = { id: 't1', name: 'Copa', arena_id: 'a1', game_day_id: 'gd1', format: 'americano', roster: [] };

let container, root;
beforeEach(() => {
  encerrar.mockClear();
  Object.assign(estado, {
    formato: 'americano',
    participantes: [p('p1', 'u1', 'Ana'), p('p2', 'u2', 'Bia'), p('p3', 'u3', 'Caio'), p('p4', 'u4', 'Duda')],
    jogos: [jogo(['p1', 'p2'], ['p3', 'p4'], 11, 5), jogo(['p1', 'p3'], ['p2', 'p4'], 11, 9)],
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

async function render() {
  await act(async () => {
    root.render(<FinishTournamentDialog torneio={torneio} arenaId="a1" open onOpenChange={() => {}} />);
  });
}
const selects = () => [...document.body.querySelectorAll('select')];
const botao = (t) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes(t));

describe('encerrar o torneio', () => {
  it('⭐ com placar, o pódio já vem do ranking do dia', async () => {
    await render();
    expect(selects().map((s) => s.value)).toEqual(['u1', 'u2', 'u3', 'u4']);
    expect(document.body.textContent).toMatch(/1º · Ana\+100/);
    expect(document.body.textContent).toMatch(/4º · Duda\+35/);
  });

  it('⭐ confirma com a classificação conferida', async () => {
    await render();
    await act(async () => { botao('Encerrar e pontuar').click(); });
    expect(encerrar).toHaveBeenCalledTimes(1);
    const arg = encerrar.mock.calls[0][0];
    expect(arg).toMatchObject({ arenaId: 'a1', period: 'geral' });
    expect(arg.tournament.id).toBe('t1');
    expect(arg.classificacao.map((c) => [c.user_id, c.position, c.points])).toEqual([
      ['u1', 1, 100], ['u2', 2, 70], ['u3', 3, 50], ['u4', 4, 35],
    ]);
  });

  it('sem placar (Play), o pódio começa vazio e todos levam presença', async () => {
    estado.formato = 'play';
    await render();
    expect(selects().every((s) => s.value === '')).toBe(true);
    expect(botao('Encerrar sem pódio')).toBeTruthy();
    expect(document.body.textContent).toMatch(/Ana\+10/);
  });

  it('pôr alguém numa posição tira ele da outra', async () => {
    await render();
    const [primeiro] = selects();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(primeiro, 'u3');
      primeiro.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const valores = selects().map((s) => s.value);
    expect(valores[0]).toBe('u3');
    expect(valores.filter((v) => v === 'u3')).toHaveLength(1);
  });

  it('ninguém com conta no jogo: diz que não há o que pontuar', async () => {
    estado.participantes = [{ id: 'px', name: 'Convidado' }];
    await render();
    expect(document.body.textContent).toMatch(/não há o que pontuar/);
    expect(botao('Encerrar').disabled).toBe(true);
  });
});
