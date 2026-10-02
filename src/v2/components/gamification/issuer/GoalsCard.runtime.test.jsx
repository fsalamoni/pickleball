import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const state = { goals: [], isLoading: false, isError: false, refetch: vi.fn(), save: vi.fn() };
vi.mock('@/modules/progression/hooks/useOwnerGoals', () => ({
  useOwnerGoals: () => ({
    goals: state.goals, isLoading: state.isLoading, isError: state.isError, refetch: state.refetch,
    save: { mutateAsync: (...a) => state.save(...a), isPending: false },
  }),
}));

import GoalsCard from './GoalsCard.jsx';

let container; let root;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  Object.assign(state, { goals: [], isLoading: false, isError: false, refetch: vi.fn(), save: vi.fn(() => Promise.resolve([])) });
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (actuals = {}) => act(async () => { root.render(<GoalsCard ownerType="coach" ownerId="c1" monthKey="2026-10" actuals={actuals} />); });

describe('GoalsCard', () => {
  it('sem metas: convida a definir', async () => {
    await render();
    expect(container.textContent).toContain('Sem metas para este mês');
    expect(container.textContent).toContain('Definir metas');
  });

  it('o progresso é MEDIDO: mostra "x de y", o que falta e marca a meta batida', async () => {
    state.goals = [{ metric: 'lessons', target: 20 }, { metric: 'new_students', target: 3 }];
    await render({ lessons: 12, new_students: 3 });
    const aulas = container.querySelector('[data-goal="lessons"]');
    expect(aulas.textContent).toContain('12 de 20 aulas');
    expect(aulas.textContent).toContain('Faltam 8 aulas');
    expect(container.querySelector('[data-goal="new_students"]').textContent).toContain('Meta batida');
  });

  it('o que ainda não dá para medir NÃO vira "0 de 20"', async () => {
    state.goals = [{ metric: 'lessons', target: 20 }];
    await render({ lessons: null });
    expect(container.textContent).toContain('ainda não dá para medir');
    expect(container.textContent).not.toContain('0 de 20');
  });

  it('editar e salvar manda a lista limpa (sem repetir medida)', async () => {
    await render();
    await act(async () => { Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Definir metas')).click(); });
    // já vem com a primeira medida e a sugestão de meta
    expect(container.querySelector('select[aria-label="Medida"]').value).toBe('lessons');
    await act(async () => { Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Meta')).click(); });
    const medidas = Array.from(container.querySelectorAll('select[aria-label="Medida"]')).map((s) => s.value);
    expect(new Set(medidas).size).toBe(2);
    await act(async () => { Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Salvar').click(); });
    expect(state.save).toHaveBeenCalledTimes(1);
    expect(state.save.mock.calls[0][0].map((g) => g.metric)).toEqual(medidas);
  });

  it('falha de leitura não deixa editar (salvar por cima apagaria as metas)', async () => {
    state.isError = true;
    await render();
    expect(container.textContent).toContain('Não deu para carregar as metas');
    expect(container.textContent).not.toContain('Definir metas');
  });
});
