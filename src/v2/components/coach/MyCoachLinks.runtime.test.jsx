/**
 * "Meus professores": a pessoa aceita/recusa o convite e deixa de ser aluno;
 * falha diz que falhou; sem vínculo aberto a seção some.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ok = (data) => ({ isPending: false, isError: false, isSuccess: true, data, refetch: vi.fn() });
const est = {};
const mutateAsync = vi.fn(async () => {});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'ana' } }) }));
vi.mock('@/modules/coaches/hooks/useCoaches', () => ({ useCoach: () => ok({ display_name: 'Prof. Rui' }) }));
vi.mock('@/modules/coaches/hooks/useStudents', () => ({
  useStudentCoaches: () => est.links,
  useSetStudentStatus: () => ({ mutateAsync, isPending: false }),
}));
vi.mock('@/components/ConfirmDialog', () => ({
  // Confirma na hora: o diálogo em si é testado no componente dele.
  default: ({ trigger, onConfirm }) => React.cloneElement(trigger, { onClick: onConfirm }),
}));

const { default: MyCoachLinks } = await import('./MyCoachLinks.jsx');

let container;
let root;
beforeEach(() => {
  mutateAsync.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const render = async () => {
  await act(async () => { root.render(<MemoryRouter><MyCoachLinks /></MemoryRouter>); });
};
const botao = (t) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(t));
const link = (status) => ({ id: `prof_${status}`, coach_id: 'prof', student_id: 'ana', status });

describe('Meus professores', () => {
  it('aluno ativo deixa de ser aluno', async () => {
    est.links = ok([link('active')]);
    await render();
    expect(container.textContent).toContain('Prof. Rui');
    await act(async () => { botao('Deixar de ser aluno').click(); });
    expect(mutateAsync).toHaveBeenCalledWith({ student: link('active'), nextStatus: 'ended' });
  });

  it('convite: aceitar ou recusar', async () => {
    est.links = ok([link('invited')]);
    await render();
    await act(async () => { botao('Aceitar').click(); });
    expect(mutateAsync.mock.calls[0][0].nextStatus).toBe('active');
    await act(async () => { botao('Recusar').click(); });
    expect(mutateAsync.mock.calls[1][0].nextStatus).toBe('ended');
  });

  it('só os vínculos encerrados: a seção não aparece', async () => {
    est.links = ok([link('ended')]);
    await render();
    expect(container.textContent).toBe('');
  });

  it('falha diz que falhou', async () => {
    est.links = { isPending: false, isError: true, isSuccess: false, data: undefined, refetch: vi.fn() };
    await render();
    expect(container.textContent).toContain('Não foi possível carregar os seus professores');
  });
});
