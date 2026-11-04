import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const state = { data: undefined, isLoading: false, isError: false, refetch: vi.fn() };
vi.mock('../hooks/useProgression.js', () => ({
  useGoals: () => ({ data: state.data, isLoading: state.isLoading, isError: state.isError, refetch: state.refetch }),
  useCreateGoal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteGoal: () => ({ mutate: vi.fn() }),
}));

import GoalsCard from './GoalsCard.jsx';

let container; let root;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  Object.assign(state, { data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = () => act(async () => { root.render(<GoalsCard uid="u1" values={{ games: 3 }} />); });

describe('GoalsCard pessoal', () => {
  it('sem metas (consulta respondeu vazio): convida a criar', async () => {
    state.data = [];
    await render();
    expect(container.textContent).toContain('Você ainda não definiu metas');
  });

  it('⭐ leitura que FALHA não vira "não definiu metas": diz que não carregou e oferece tentar de novo', async () => {
    state.isError = true;
    await render();
    expect(container.textContent).not.toContain('Você ainda não definiu metas');
    expect(container.textContent).toContain('Não deu para carregar as metas');
    const botao = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Tentar de novo'));
    expect(botao).toBeTruthy();
    await act(async () => { botao.click(); });
    expect(state.refetch).toHaveBeenCalled();
    // sem saber quais metas existem, não oferece criar outra
    expect(container.querySelector('form')).toBeNull();
  });

  it('⭐ falha numa atualização de FUNDO (dado em mãos) avisa sem esconder as metas', async () => {
    state.data = [{ id: 'g1', metric: 'games', target: 10 }];
    state.isError = true;
    await render();
    expect(container.textContent).toContain('3/10');
    expect(container.textContent).toContain('Não deu para carregar as metas');
  });

  it('carregando: não afirma que está vazio', async () => {
    state.isLoading = true;
    await render();
    expect(container.textContent).not.toContain('Você ainda não definiu metas');
  });

  it('com metas: mostra o progresso', async () => {
    state.data = [{ id: 'g1', metric: 'games', target: 10 }];
    await render();
    expect(container.textContent).toContain('3/10');
  });
});
