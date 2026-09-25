/**
 * "Meus códigos de indicação" no perfil (Onda BY).
 *
 * O que protege:
 *  1. ⭐ um código por arena, com o nome da arena e as REGRAS dela;
 *  2. arena com a indicação desligada: a linha some;
 *  3. sem código nenhum, a seção não aparece (nada de cartão vazio no perfil);
 *  4. ⭐ falha ao carregar diz que falhou — não some calada;
 *  5. copiar e convidar têm nome acessível.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { codigos: [], erro: false, desligada: new Set(), cupons: {} };

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArena: (id) => ({ data: id ? { id, name: id === 'a1' ? 'Arena Sol' : 'Arena Mar' } : undefined }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: (id) => ({ isOn: () => !estado.desligada.has(id), isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useMyReferralCodes: () => ({
    data: estado.erro ? undefined : estado.codigos, isError: estado.erro, refetch: vi.fn(),
  }),
  useArenaCoupons: (id) => ({ data: id ? (estado.cupons[id] || []) : undefined }),
}));

const { default: MyReferralCodes } = await import('./MyReferralCodes.jsx');

let container, root;
beforeEach(() => {
  Object.assign(estado, { codigos: [], erro: false, desligada: new Set(), cupons: {} });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const render = async () => {
  await act(async () => { root.render(<MemoryRouter><MyReferralCodes /></MemoryRouter>); });
};

describe('Meus códigos de indicação', () => {
  it('⭐ um código por arena, com o nome e as regras dela', async () => {
    estado.codigos = [
      { id: 'a1_u1', arena_id: 'a1', code: 'U1ABCD1234', redeemed_count: 2 },
      { id: 'a2_u1', arena_id: 'a2', code: 'U1WXYZ5678' },
    ];
    estado.cupons = { a1: [{ id: 'p', kind: 'referral', code: 'INDICACAO', active: true, referrer_reward: 25 }] };
    await render();
    expect(container.textContent).toContain('Meus códigos de indicação');
    expect(container.textContent).toContain('Arena Sol');
    expect(container.textContent).toContain('U1ABCD1234');
    expect(container.textContent).toContain('Quem indica ganha R$ 25,00 em crédito');
    expect(container.textContent).toContain('2 pessoas usaram');
    expect(container.textContent).toContain('Arena Mar');
    expect(container.textContent).toContain('A arena ainda não publicou as regras.');
    expect(container.querySelector('button[aria-label="Copiar o código U1ABCD1234"]')).toBeTruthy();
    expect(container.querySelector('button[aria-label="Convidar alguém para a Arena Sol"]')).toBeTruthy();
  });

  it('arena com a indicação desligada: a linha some', async () => {
    estado.codigos = [{ id: 'a1_u1', arena_id: 'a1', code: 'U1ABCD1234' }, { id: 'a2_u1', arena_id: 'a2', code: 'U1WXYZ5678' }];
    estado.desligada = new Set(['a2']);
    await render();
    expect(container.textContent).toContain('Arena Sol');
    expect(container.textContent).not.toContain('Arena Mar');
  });

  it('sem código nenhum, a seção não aparece', async () => {
    await render();
    expect(container.innerHTML).toBe('');
  });

  it('⭐ falha ao carregar diz que falhou', async () => {
    estado.erro = true;
    await render();
    expect(container.textContent).toMatch(/Não foi possível carregar os seus códigos de indicação/);
  });
});
