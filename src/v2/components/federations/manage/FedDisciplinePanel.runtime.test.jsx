/**
 * Disciplina na Central: o filtro vem da URL (`?filtro=recurso` / `abertas`,
 * o que a faixa "Precisa de você" manda) e decidir recurso ou concluir
 * manifestação PERGUNTA antes, com a observação dentro da pergunta.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const disciplineAction = vi.fn(async () => ({ ok: true }));
const updateReport = vi.fn(async () => undefined);
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'eu' } }) }));
vi.mock('@/modules/federations/services/federationService', () => ({
  disciplineAction: (...a) => disciplineAction(...a),
  updateReport: (...a) => updateReport(...a),
}));
vi.mock('@/modules/federations/hooks/useFederations', async () => {
  const { useMutation } = await import('@tanstack/react-query');
  return { useFederationMutation: (fn) => useMutation({ mutationFn: fn }) };
});

const { default: FedDisciplinePanel } = await import('./FedDisciplinePanel');

const fed = { id: 'fpp', modules: { discipline: true } };
const q = (data) => ({ isSuccess: true, isLoading: false, isError: false, data });
const sancoes = q([
  { id: 's1', user_name: 'Ana Recorre', kind: 'warning', status: 'appealed', reason: 'Conduta', appeal: { text: 'Não fui eu' }, created_at_ms: 1 },
  { id: 's2', user_name: 'Bia Vigente', kind: 'warning', status: 'active', reason: 'Atraso', created_at_ms: 2 },
]);
const relatos = q([
  { id: 'r1', status: 'open', kind: 'other', body: 'Quadra ruim', created_at_ms: 1 },
  { id: 'r2', status: 'in_review', kind: 'other', body: 'Árbitro atrasou', created_at_ms: 2 },
]);

let container, root;
beforeEach(() => {
  disciplineAction.mockClear(); updateReport.mockClear();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async (url, tab) => {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[url]}><QueryClientProvider client={new QueryClient()}><FedDisciplinePanel federation={fed} membersQ={q([])} sanctionsQ={sancoes} reportsQ={relatos} tab={tab} /></QueryClientProvider></MemoryRouter>);
  });
};
const botao = (texto) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === texto || b.textContent.includes(texto));
const clicar = async (el) => { await act(async () => { el.click(); }); };

describe('FedDisciplinePanel', () => {
  it('?filtro=recurso mostra só o recurso, com a contagem, e decidir pergunta antes', async () => {
    await montar('/?aba=sancoes&filtro=recurso', 'sancoes');
    expect(container.textContent).toContain('Ana Recorre');
    expect(container.textContent).not.toContain('Bia Vigente');
    expect(botao('Com recurso (1)').getAttribute('aria-pressed')).toBe('true');
    await clicar(botao('Aceitar recurso'));
    expect(disciplineAction).not.toHaveBeenCalled();
    const nota = document.body.querySelector('#sa-nota-s1');
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(nota, 'Vídeo confirma');
    await act(async () => { nota.dispatchEvent(new Event('input', { bubbles: true })); });
    const confirmar = [...document.body.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent.includes('Aceitar recurso'));
    await clicar(confirmar);
    expect(disciplineAction).toHaveBeenCalledWith({ action: 'decide_appeal', decision: 'overturn', note: 'Vídeo confirma', sanctionId: 's1' });
  });

  it('?filtro=abertas mostra só as sem resposta, e concluir pergunta antes', async () => {
    await montar('/?aba=ouvidoria&filtro=abertas', 'ouvidoria');
    expect(container.textContent).toContain('Quadra ruim');
    expect(container.textContent).not.toContain('Árbitro atrasou');
    await clicar(botao('Concluir'));
    expect(updateReport).not.toHaveBeenCalled();
    const confirmar = [...document.body.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent.includes('Concluir'));
    await clicar(confirmar);
    expect(updateReport).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }), expect.objectContaining({ status: 'closed' }));
  });
});
