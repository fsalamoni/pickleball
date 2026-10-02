import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const state = {
  data: { rewards: [], claims: [], isLoading: false, isError: false, refetch: vi.fn() },
  create: vi.fn(), update: vi.fn(), remove: vi.fn(), decide: vi.fn(),
};
vi.mock('@/modules/progression/hooks/useRewards', () => ({
  useIssuerRewards: () => ({
    ...state.data,
    create: { mutateAsync: (...a) => state.create(...a), isPending: false },
    update: { mutateAsync: (...a) => state.update(...a), isPending: false },
    remove: { mutate: (...a) => state.remove(...a) },
    decide: { mutateAsync: (...a) => state.decide(...a), isPending: false },
  }),
}));

import IssuerRewardsManager from './IssuerRewardsManager.jsx';

let container; let root;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  state.data = { rewards: [], claims: [], isLoading: false, isError: false, refetch: vi.fn() };
  state.create = vi.fn(() => Promise.resolve('id')); state.update = vi.fn(() => Promise.resolve()); state.remove = vi.fn();
  state.decide = vi.fn(() => Promise.resolve());
});
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ''; });
const render = () => act(async () => { root.render(<IssuerRewardsManager issuer={{ type: 'arena', id: 'a1', name: 'Arena Sol' }} actor={{ uid: 'g' }} />); });
const preencher = async (el, valor) => {
  await act(async () => {
    const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, valor);
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
};
const botao = (rotulo, raiz = document.body) => Array.from(raiz.querySelectorAll('button')).find((b) => b.textContent.trim() === rotulo);
const claim = (over = {}) => ({ id: 'r1_u1', rewardId: 'r1', rewardTitle: 'Hora grátis', uid: 'u1', userName: 'Una', status: 'requested', code: 'RWD-ABC234', snapshot: { tier: 'Regular', level: 9, games: 40, streakWeeks: 5 }, createdAt: 9, ...over });

describe('IssuerRewardsManager', () => {
  it('criar: nome obrigatório, critérios opcionais viram números e sem limite = em branco', async () => {
    await render();
    await act(async () => { botao('Nova recompensa', container).click(); });
    await act(async () => { botao('Salvar').click(); });
    expect(document.body.querySelector('[role="alert"]').textContent).toContain('Dê um nome');
    await preencher(document.body.querySelector('#rw-title'), 'Hora grátis');
    await preencher(document.body.querySelector('#rw-tier'), 'Regular');
    await preencher(document.body.querySelector('#rw-games'), '20');
    await act(async () => { botao('Salvar').click(); });
    const entrada = state.create.mock.calls[0][0];
    expect(entrada).toMatchObject({ title: 'Hora grátis', quantity: null, status: 'active' });
    expect(entrada.eligibility).toMatchObject({ minTier: 'Regular', minGames: 20 });
  });

  it('lista com o critério em palavras e o quanto já foi liberado', async () => {
    state.data.rewards = [{ id: 'r1', title: 'Hora grátis', kind: 'free_class', eligibility: { minTier: 'Regular', minGames: 20 }, quantity: 10, approvedCount: 3, status: 'active' }];
    await render();
    expect(container.textContent).toContain('tier Regular ou acima');
    expect(container.textContent).toContain('3 de 10 liberadas');
    expect(container.textContent).toContain('disponível');
  });

  it('a aba Pedidos mostra o número de pendentes e o retrato de quem pediu', async () => {
    state.data.claims = [claim()];
    await render();
    expect(Array.from(container.querySelectorAll('nav button')).some((b) => b.textContent.includes('Pedidos (1)'))).toBe(true);
    await act(async () => { Array.from(container.querySelectorAll('nav button')).find((b) => b.textContent.includes('Pedidos')).click(); });
    expect(container.textContent).toContain('Una pediu Hora grátis');
    expect(container.textContent).toContain('RWD-ABC234');
    expect(container.textContent).toContain('Regular nível 9');
  });

  it('liberar, usar e recusar passam o estado certo e a observação', async () => {
    state.data.claims = [claim(), claim({ id: 'r1_u2', uid: 'u2', userName: 'Duda', status: 'approved' })];
    await render();
    await act(async () => { Array.from(container.querySelectorAll('nav button')).find((b) => b.textContent.includes('Pedidos')).click(); });
    const itens = container.querySelectorAll('[data-claim]');
    await act(async () => { botao('Liberar', itens[0]).click(); });
    expect(state.decide.mock.calls[0][0]).toMatchObject({ next: 'approved', note: '' });
    await act(async () => { botao('Marcar como usada', itens[1]).click(); });
    expect(state.decide.mock.calls[1][0].next).toBe('redeemed');
    await act(async () => { botao('Recusar', itens[0]).click(); });
    expect(state.decide.mock.calls[2][0].next).toBe('rejected');
  });

  it('já decidido não oferece ação, e fica no histórico', async () => {
    state.data.claims = [claim({ status: 'redeemed' })];
    await render();
    await act(async () => { Array.from(container.querySelectorAll('nav button')).find((b) => b.textContent.includes('Pedidos')).click(); });
    expect(container.querySelectorAll('[data-claim]').length).toBe(0);
    expect(container.textContent).toContain('Já decididos');
  });

  it('falha de leitura não deixa criar nem diz "nenhuma recompensa"', async () => {
    state.data.isError = true;
    await render();
    expect(container.textContent).toContain('Não deu para carregar as recompensas');
    expect(botao('Nova recompensa', container)).toBeUndefined();
  });
});
