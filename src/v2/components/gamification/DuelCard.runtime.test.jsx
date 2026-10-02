import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const state = { duels: [], isLoading: false, isError: false, refetch: vi.fn(), decline: vi.fn() };
vi.mock('@/modules/progression/hooks/useChallenges', () => ({
  useMyDuels: () => ({
    duels: state.duels, isLoading: state.isLoading, isError: state.isError, refetch: state.refetch,
    decline: { mutate: (...a) => state.decline(...a), isPending: false },
  }),
}));

import DuelCard from './DuelCard.jsx';

let container; let root;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  Object.assign(state, { duels: [], isLoading: false, isError: false, refetch: vi.fn(), decline: vi.fn() });
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (records = []) => act(async () => { root.render(<DuelCard uid="eu" records={records} />); });

const NOW = Date.now();
const ativo = (over = {}) => ({ id: 'd1', uidA: 'eu', uidB: 'x', nameA: 'Eu', nameB: 'Xuxa', status: 'active', startsAt: NOW - 86_400_000, endsAt: NOW + 5 * 86_400_000, ...over });

describe('DuelCard', () => {
  it('sem duelo: explica como entrar (e como sair)', async () => {
    await render();
    expect(container.textContent).toContain('Toda segunda-feira');
    expect(container.textContent).toContain('desligue em Preferências');
  });

  it('em andamento: mostra as MINHAS vitórias da semana (do que eu sei) e esconde o placar do adversário', async () => {
    state.duels = [ativo()];
    await render([
      { at: NOW - 3_600_000, won: true }, { at: NOW - 7_200_000, won: false }, { at: NOW - 30 * 86_400_000, won: true },
    ]);
    expect(container.textContent).toContain('Contra Xuxa');
    expect(container.querySelector('[data-duel="d1"]').textContent).toContain('1'); // 1 vitória no período
    expect(container.textContent).toContain('2 jogos');
    expect(container.textContent).toContain('só no final');
  });

  it('recusar é um toque, sem penalidade', async () => {
    state.duels = [ativo()];
    await render();
    await act(async () => { Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Recusar')).click(); });
    expect(state.decline.mock.calls[0][0]).toBe('d1');
  });

  it('terminado: placar dos dois lados e quem venceu', async () => {
    state.duels = [ativo({ status: 'finished', winner: 'eu', outcome: 'a', resultA: { games: 4, wins: 3 }, resultB: { games: 5, wins: 2 } })];
    await render();
    expect(container.textContent).toContain('você venceu');
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('vitórias de Xuxa');
  });

  it('eu sou o lado B: o resultado é lido do lado certo', async () => {
    state.duels = [ativo({ uidA: 'x', uidB: 'eu', nameA: 'Xuxa', nameB: 'Eu', status: 'finished', winner: 'x', outcome: 'a', resultA: { games: 4, wins: 3 }, resultB: { games: 2, wins: 0 } })];
    await render();
    expect(container.textContent).toContain('ficou com o adversário');
    expect(container.textContent).toContain('suas vitórias (2 jogos)');
  });

  it('empate é dito como empate', async () => {
    state.duels = [ativo({ status: 'finished', winner: null, outcome: 'tie', resultA: { games: 1, wins: 1 }, resultB: { games: 1, wins: 1 } })];
    await render();
    expect(container.textContent).toContain('empate');
  });

  it('falha tem texto próprio — não vira "sem duelo"', async () => {
    state.isError = true;
    await render();
    expect(container.textContent).toContain('Não deu para carregar o duelo');
    expect(container.textContent).not.toContain('Toda segunda-feira');
  });
});
