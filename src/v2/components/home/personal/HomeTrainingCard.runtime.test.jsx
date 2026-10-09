/**
 * Card "Treino" do início: o treino de hoje, os recebidos não lidos e a
 * porta para o Centro de Treino — e falha nunca vira "monte o seu treino".
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const q = (over = {}) => ({ isSuccess: true, isError: false, data: [], refetch: vi.fn(), ...over });
const estado = {};
function reset() {
  Object.assign(estado, {
    sessao: { source: 'recomendacao', title: 'Treino sugerido', note: 'Sugestão a partir da sua rotina.', itemIds: ['i1'] },
    items: [{ id: 'i1', title: 'Dinks cruzados', duration_min: 15 }],
    minutos: 45,
    routine: { days: [1, 3] },
    visiveis: { incompleto: false, refetch: vi.fn() },
    planos: q(),
    inbox: q(),
    meta: q(),
    isLoading: false,
  });
}

vi.mock('@/modules/training/hooks/useTrainingIdentity', () => ({ useTrainingIdentity: () => ({ uid: 'u1', activeCoachIds: [] }) }));
vi.mock('@/modules/training/hooks/useTodaySession', () => ({ useTodaySession: () => estado }));

const { default: HomeTrainingCard } = await import('./HomeTrainingCard.jsx');

let container; let root;
beforeEach(() => {
  reset();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const render = () => act(async () => { root.render(<MemoryRouter><HomeTrainingCard /></MemoryRouter>); });
const links = () => [...container.querySelectorAll('a')].map((a) => [a.textContent.trim(), a.getAttribute('href')]);

describe('card Treino do início', () => {
  it('mostra o treino de hoje e leva a cada item e ao Hoje', async () => {
    await render();
    expect(container.textContent).toContain('Treino sugerido');
    expect(container.textContent).toContain('cerca de 45 min');
    expect(links()).toContainEqual(['Dinks cruzados15 min', '/treino/item/i1']);
    expect(links()).toContainEqual(['Começar o treino de hoje', '/treino?aba=hoje']);
    expect(links()).toContainEqual(['Abrir o treino', '/treino']);
  });

  it('o que o professor mandou e ainda não foi visto vira um atalho para os recebidos', async () => {
    estado.inbox = q({ data: [{ id: 's1' }, { id: 's2', read_at: null }, { id: 's3', read_at: 'x' }] });
    await render();
    expect(links()).toContainEqual(['2 itens novos do seu professorNovo', '/treino?aba=recebidos']);
  });

  it('⭐ sem os planos: diz que não deu para montar, sem sugerir outra coisa', async () => {
    estado.planos = q({ isSuccess: false, isError: true, data: undefined });
    await render();
    expect(container.textContent).toContain('Não deu para montar o treino de hoje');
    expect(container.textContent).not.toContain('Treino sugerido');
  });

  it('⭐ biblioteca pela metade: não afirma "monte o seu treino"', async () => {
    Object.assign(estado, {
      sessao: { source: 'vazio', title: 'Monte o seu treino', note: 'Ainda não há itens.', itemIds: [] },
      items: [],
      visiveis: { incompleto: true, refetch: vi.fn() },
    });
    await render();
    expect(container.textContent).toContain('Ficou de fora: uma parte da biblioteca');
    expect(container.textContent).not.toContain('Monte o seu treino');
    expect(links().map(([, to]) => to)).not.toContain('/treino?aba=biblioteca');
  });

  it('sem rotina: convida a montar a rotina', async () => {
    estado.routine = null;
    await render();
    expect(links()).toContainEqual(['Montar a minha rotina', '/treino']);
  });

  it('o que o professor mandou que não carregou não vira zero', async () => {
    estado.inbox = q({ isSuccess: false, isError: true, data: undefined });
    await render();
    expect(container.textContent).toContain('Ficou de fora: o que o professor mandou');
    expect(container.textContent).not.toMatch(/itens? novos?/);
  });
});
