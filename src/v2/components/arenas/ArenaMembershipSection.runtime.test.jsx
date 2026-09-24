/**
 * "Planos e vantagens" na página da arena.
 *
 * O que protege:
 *  1. ⭐ módulo desligado: a seção não existe;
 *  2. ⭐ quem não é membro vê os pacotes e COMPRA ali mesmo;
 *  3. ⭐ membro vê o que tem: nível, horas que restam, saldo;
 *  4. sem nada a oferecer, a seção não ocupa a página;
 *  5. a rota antiga /gerir/membros leva à aba da Central.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const LIGADOS = new Set();
const estado = { member: null, wallet: null, pacotes: [], mensalidade: null };
const comprar = vi.fn(() => Promise.resolve());

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'eu' } }) }));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id), isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaMember: () => ({ data: estado.member }),
  useArenaWallet: () => ({ data: estado.wallet }),
  useArenaPackages: () => ({ data: estado.pacotes }),
  useMemberSubscription: () => ({ data: estado.mensalidade }),
  useRequestPackage: () => ({ mutateAsync: comprar, isPending: false }),
}));

const { default: ArenaMembershipSection } = await import('./ArenaMembershipSection.jsx');
const { default: V2ArenaAdminMembers } = await import('@/v2/pages/V2ArenaAdminMembers.jsx');

const ARENA = { id: 'a1', name: 'Arena Teste' };
const PACOTE = { id: 'p1', name: '10 horas', hours: 10, price: 700, validity_days: 90 };

let container, root;
beforeEach(() => {
  LIGADOS.clear();
  comprar.mockClear();
  Object.assign(estado, { member: null, wallet: null, pacotes: [], mensalidade: null });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = async (el, rota = '/arenas/a1') => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/arenas/:arenaId" element={el} />
          <Route path="/arenas/:arenaId/gerir/membros" element={el} />
          <Route path="/arenas/:arenaId/gerir" element={<div>CENTRAL</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

describe('a seção na página da arena', () => {
  it('⭐ módulo desligado: não existe', async () => {
    estado.pacotes = [PACOTE];
    await render(<ArenaMembershipSection arena={ARENA} />);
    expect(container.textContent).toBe('');
  });

  it('⭐ quem não é membro vê os pacotes e compra ali mesmo', async () => {
    LIGADOS.add(ARENA_MODULE_ID.MEMBERS);
    LIGADOS.add(ARENA_MODULE_ID.MEMBERS_PACKAGES);
    estado.pacotes = [PACOTE];
    await render(<ArenaMembershipSection arena={ARENA} />);
    expect(container.textContent).toContain('Planos e vantagens');
    expect(container.textContent).toContain('10 horas');
    const botao = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Quero este pacote'));
    await act(async () => { botao.click(); });
    expect(comprar).toHaveBeenCalledWith({ arenaId: 'a1', pkgId: 'p1' });
  });

  it('no máximo dois pacotes na página — o resto em "Ver todos"', async () => {
    LIGADOS.add(ARENA_MODULE_ID.MEMBERS);
    LIGADOS.add(ARENA_MODULE_ID.MEMBERS_PACKAGES);
    estado.pacotes = [PACOTE, { ...PACOTE, id: 'p2', name: '20 horas' }, { ...PACOTE, id: 'p3', name: '30 horas' }];
    await render(<ArenaMembershipSection arena={ARENA} />);
    expect(container.textContent).not.toContain('30 horas');
    expect(container.textContent).toContain('Ver todos');
  });

  it('⭐ membro vê o que tem: nível, horas e saldo', async () => {
    LIGADOS.add(ARENA_MODULE_ID.MEMBERS);
    LIGADOS.add(ARENA_MODULE_ID.MEMBERS_TIERS);
    LIGADOS.add(ARENA_MODULE_ID.MEMBERS_PACKAGES);
    LIGADOS.add(ARENA_MODULE_ID.MEMBERS_WALLET);
    estado.member = { user_id: 'eu', points: 600 };
    estado.wallet = { balance: 45, packages: [{ total_hours: 10, used_hours: 3 }] };
    await render(<ArenaMembershipSection arena={ARENA} />);
    const txt = container.textContent;
    expect(txt).toContain('Você é membro');
    expect(txt).toContain('Ouro');
    expect(txt).toContain('7h de pacote');
    expect(txt).toContain('R$');
    expect(txt).toContain('Ver meu plano');
  });

  it('sem ser membro e sem pacote à venda, não ocupa a página', async () => {
    LIGADOS.add(ARENA_MODULE_ID.MEMBERS);
    await render(<ArenaMembershipSection arena={ARENA} />);
    expect(container.textContent).toBe('');
  });
});

describe('a rota antiga', () => {
  it('⭐ /gerir/membros leva à aba Membros da Central', async () => {
    await render(<V2ArenaAdminMembers />, '/arenas/a1/gerir/membros');
    expect(container.textContent).toContain('CENTRAL');
  });
});
