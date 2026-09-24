/**
 * "Indique e ganhe" na página da arena.
 *
 * O que protege:
 *  1. ⭐ abrir a página NÃO cria código — ele nasce quando a pessoa pede;
 *  2. ⭐ falha ao ler não vira "você ainda não tem código" (o botão de criar
 *     só aparece quando a leitura CONFIRMOU que não há);
 *  3. com o código, mostra copiar e convidar, e quantas pessoas já usaram;
 *  4. módulo desligado ou ninguém logado: nada, e nem a consulta sai.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const LIGADOS = new Set();
const estado = { uid: 'u1', consulta: null };
const consultas = [];
const criar = vi.fn(async () => ({ code: 'NOVO42' }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: estado.uid ? { uid: estado.uid } : null }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id), isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useMyReferralCode: (arenaId) => {
    consultas.push(arenaId);
    return estado.consulta;
  },
  useCreateMyReferralCode: () => ({ mutateAsync: criar, isPending: false }),
}));

const { default: ArenaReferralCard } = await import('./ArenaReferralCard.jsx');
const { ARENA_MODULE_ID } = await import('@/modules/arenas/domain/modules');

const ok = (data) => ({ data, isLoading: false, isError: false, isSuccess: true, refetch: vi.fn() });

let container, root;
beforeEach(() => {
  LIGADOS.clear();
  LIGADOS.add(ARENA_MODULE_ID.MARKETING);
  LIGADOS.add(ARENA_MODULE_ID.MARKETING_REFERRAL);
  estado.uid = 'u1';
  estado.consulta = ok(null);
  consultas.length = 0;
  criar.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render() {
  await act(async () => { root.render(<ArenaReferralCard arena={{ id: 'a1', name: 'Arena Teste' }} />); });
}

describe('Indique e ganhe na página da arena', () => {
  it('⭐ sem código ainda: oferece criar, e abrir a página não cria nada', async () => {
    await render();
    expect(container.textContent).toContain('Indique e ganhe');
    expect(container.textContent).toContain('Quero meu código');
    expect(criar).not.toHaveBeenCalled();
  });

  it('pedir o código cria nesta arena', async () => {
    await render();
    const botao = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Quero meu código'));
    await act(async () => { botao.click(); });
    expect(criar).toHaveBeenCalledWith({ arenaId: 'a1' });
  });

  it('com código: mostra o código, copiar, convidar e quantos já usaram', async () => {
    estado.consulta = ok({ code: 'ANA123', redeemed_count: 2 });
    await render();
    expect(container.textContent).toContain('ANA123');
    expect(container.querySelector('button[aria-label="Copiar o código ANA123"]')).toBeTruthy();
    expect(container.textContent).toContain('Convidar');
    expect(container.textContent).toContain('2 pessoas já usaram o seu código');
    expect(container.textContent).not.toContain('Quero meu código');
  });

  it('⭐ falha ao ler NÃO oferece criar — diz que falhou e deixa tentar de novo', async () => {
    estado.consulta = { data: undefined, isLoading: false, isError: true, isSuccess: false, refetch: vi.fn() };
    await render();
    expect(container.textContent).toMatch(/Não foi possível buscar o seu código/);
    expect(container.textContent).toContain('Tentar de novo');
    expect(container.textContent).not.toContain('Quero meu código');
  });

  it('carregando: nem código nem botão de criar', async () => {
    estado.consulta = { data: undefined, isLoading: true, isError: false, isSuccess: false, refetch: vi.fn() };
    await render();
    expect(container.textContent).not.toContain('Quero meu código');
  });

  it('módulo de indicação desligado: nada, e a consulta não sai', async () => {
    LIGADOS.delete(ARENA_MODULE_ID.MARKETING_REFERRAL);
    await render();
    expect(container.innerHTML).toBe('');
    expect(consultas.every((id) => id === null)).toBe(true);
  });

  it('ninguém logado: nada', async () => {
    estado.uid = null;
    await render();
    expect(container.innerHTML).toBe('');
    expect(consultas.every((id) => id === null)).toBe(true);
  });
});
