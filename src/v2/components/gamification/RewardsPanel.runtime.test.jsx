import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/useClipboard', () => ({ useClipboard: () => ({ copy: vi.fn(), copied: false }) }));

const state = {
  rewards: { rewards: [], isLoading: false, isError: false, refetch: vi.fn() },
  claims: { claims: [], isLoading: false, isError: false, refetch: vi.fn() },
  request: vi.fn(), cancel: vi.fn(),
};
vi.mock('@/modules/progression/hooks/useRewards', () => ({
  useRewards: () => state.rewards,
  useMyClaims: () => state.claims,
  useClaimActions: () => ({
    request: { mutateAsync: (...a) => state.request(...a), isPending: false },
    cancel: { mutate: (...a) => state.cancel(...a) },
  }),
}));

import RewardsPanel from './RewardsPanel.jsx';
import { buildEligibilitySnapshot } from '@/modules/progression/domain/rewards';

let container; let root;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  state.rewards = { rewards: [], isLoading: false, isError: false, refetch: vi.fn() };
  state.claims = { claims: [], isLoading: false, isError: false, refetch: vi.fn() };
  state.request = vi.fn(() => Promise.resolve({ id: 'x', code: 'RWD-ABC123' }));
  state.cancel = vi.fn();
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const snap = (over) => buildEligibilitySnapshot({ tier: 'Jogador', level: 6, games: 30, streakWeeks: 3, ...over });
const render = (props) => act(async () => { root.render(<RewardsPanel uid="eu" user={{ uid: 'eu', displayName: 'Eu' }} snapshot={snap()} {...props} />); });
const reward = (over = {}) => ({ id: 'r1', title: 'Hora grátis', kind: 'free_class', issuerType: 'arena', issuerId: 'a1', issuerName: 'Arena Sol', status: 'active', quantity: 10, approvedCount: 2, eligibility: { minTier: 'Aprendiz' }, ...over });

describe('RewardsPanel', () => {
  it('quem se qualifica pode pedir; o pedido sai com o retrato da pessoa', async () => {
    state.rewards.rewards = [reward()];
    await render();
    expect(container.textContent).toContain('Arena Sol');
    expect(container.textContent).toContain('8 unidades restantes');
    await act(async () => { Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Pedir')).click(); });
    expect(state.request.mock.calls[0][0].reward.id).toBe('r1');
    expect(state.request.mock.calls[0][0].snapshot.tier).toBe('Jogador');
  });

  it('quem não se qualifica vê, critério a critério, o que falta (e não vê o botão)', async () => {
    state.rewards.rewards = [reward({ eligibility: { minTier: 'Expert', minGames: 100 } })];
    await render();
    const falta = container.querySelector('[aria-label="O que falta"]');
    expect(falta.textContent).toContain('Tier mínimo');
    expect(falta.textContent).toContain('Jogador');
    expect(falta.textContent).toContain('Expert');
    expect(falta.textContent).toContain('Jogos');
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent.includes('Pedir'))).toBe(false);
  });

  it('esgotada ou vencida diz o motivo', async () => {
    state.rewards.rewards = [reward({ quantity: 5, approvedCount: 5 }), reward({ id: 'r2', validUntil: 1 })];
    await render();
    expect(container.textContent).toContain('Todas as unidades já foram liberadas');
    expect(container.textContent).toContain('A validade acabou');
  });

  it('o que já foi pedido mostra o estado e o código para copiar', async () => {
    state.rewards.rewards = [reward()];
    state.claims.claims = [{ id: 'r1_eu', rewardId: 'r1', rewardTitle: 'Hora grátis', status: 'approved', code: 'RWD-K7Q3XM', createdAt: 5 }];
    await render();
    expect(container.textContent).toContain('Liberada — apresente o código');
    expect(container.querySelector('[aria-label="Copiar o código RWD-K7Q3XM"]')).toBeTruthy();
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent.includes('Pedir'))).toBe(false);
  });

  it('Meus pedidos: lista, copia o código e permite cancelar o que está em aberto', async () => {
    state.rewards.rewards = [reward()];
    state.claims.claims = [
      { id: 'r1_eu', rewardId: 'r1', rewardTitle: 'Hora grátis', status: 'requested', code: 'RWD-AAAAAA', createdAt: 5 },
      { id: 'r9_eu', rewardId: 'r9', rewardTitle: 'Brinde', status: 'redeemed', code: 'RWD-BBBBBB', createdAt: 4 },
    ];
    await render();
    await act(async () => { Array.from(container.querySelectorAll('nav button')).find((b) => b.textContent.includes('Meus pedidos')).click(); });
    expect(container.textContent).toContain('Brinde');
    expect(container.textContent).toContain('Usada');
    await act(async () => { Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Cancelar').click(); });
    expect(state.cancel).toHaveBeenCalledWith('r1_eu');
  });

  it('sem recompensas: estado vazio; falha: erro com botão (nunca "nenhuma recompensa")', async () => {
    await render();
    expect(container.textContent).toContain('Nenhuma recompensa por aqui ainda');
    state.rewards.isError = true;
    await render();
    expect(container.textContent).toContain('Não deu para carregar as recompensas');
    expect(container.textContent).not.toContain('Nenhuma recompensa por aqui ainda');
  });

  it('recompensa pausada não aparece, a menos que a pessoa já a tenha pedido', async () => {
    state.rewards.rewards = [reward({ status: 'paused' })];
    await render();
    expect(container.textContent).toContain('Nenhuma recompensa por aqui ainda');
  });
});
