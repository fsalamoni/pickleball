/**
 * Membros na Central — o pedido de pacote e a venda de balcão.
 *
 * O que protege:
 *  1. ⭐ o aviso de pedido (`?pacote=&para=`) abre a confirmação: quem pediu,
 *     o quê, e "Recebi o pagamento — creditar" chama a VENDA com a pessoa;
 *  2. descartar só limpa o endereço;
 *  3. pedido de pacote que não existe mais é dito, não quebra;
 *  4. ⭐ "Vender pacote" na linha do membro credita o pacote escolhido;
 *  5. ⭐ lista de membros ou de pacotes FALHANDO: a tela diz que falhou e não
 *     oferece incluir/criar (duplicaria o que já existe) nem confirmar pedido.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const LIGADOS = new Set([ARENA_MODULE_ID.MEMBERS, ARENA_MODULE_ID.MEMBERS_PACKAGES]);
const estado = { membros: [], pacotes: [], atletas: [], falhaMembros: false, falhaPacotes: false };
const falha = () => ({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
const vender = vi.fn(() => Promise.resolve());
const mut = () => ({ mutateAsync: vi.fn(), isPending: false });

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({ useAthletes: () => ({ data: estado.atletas }) }));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id) }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaMembers: () => (estado.falhaMembros ? falha() : { data: estado.membros, isLoading: false }),
  useArenaPackages: () => (estado.falhaPacotes ? falha() : { data: estado.pacotes, isLoading: false }),
  useCreatePackage: mut, useDeletePackage: mut, useAddArenaMember: mut, useRemoveArenaMember: mut,
  useAddPointsToMember: mut, useCreditWallet: mut, useRedeemMemberPoints: mut,
  useArenaSubscriptions: () => ({ data: [] }), useSetMemberSubscription: mut,
  useSetSubscriptionMonthPaid: mut, useCancelMemberSubscription: mut,
  useSellPackageToMember: () => ({ mutateAsync: vender, isPending: false }),
}));

const { ArenaMembersPanel } = await import('./V2ArenaAdminMembers.jsx');

function Onde() { return <div data-testid="onde">{useLocation().search}</div>; }

let container, root;
beforeEach(() => {
  vender.mockClear();
  Object.assign(estado, {
    membros: [{ id: 'a1_m1', user_id: 'm1', user_name: 'Bia', points: 0 }],
    pacotes: [{ id: 'p1', name: '10 horas', hours: 10, price: 500, validity_days: 90, active: true }],
    atletas: [{ id: 'u1', platform_name: 'Ana' }],
    falhaMembros: false,
    falhaPacotes: false,
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render(rota = '/arenas/a1/gerir?aba=membros', view = 'membros') {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/arenas/:arenaId/gerir" element={<><ArenaMembersPanel arena={{ id: 'a1' }} view={view} /><Onde /></>} />
        </Routes>
      </MemoryRouter>,
    );
  });
}
const botao = (t) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(t));

describe('o pedido de pacote', () => {
  it('⭐ o aviso abre a confirmação, e creditar vende para quem pediu', async () => {
    await render('/arenas/a1/gerir?aba=membros&pacote=p1&para=u1');
    expect(container.textContent).toMatch(/Ana quer 10 horas/);
    expect(container.textContent).toMatch(/vira membro/);
    await act(async () => { botao('Recebi o pagamento').click(); });
    expect(vender).toHaveBeenCalledWith({
      arenaId: 'a1', pkgId: 'p1', target: { user_id: 'u1', user_name: 'Ana', user_photo: '' },
    });
    expect(container.querySelector('[data-testid="onde"]').textContent).toBe('?aba=membros');
  });

  it('descartar só limpa o endereço', async () => {
    await render('/arenas/a1/gerir?aba=membros&pacote=p1&para=u1');
    await act(async () => { botao('Descartar').click(); });
    expect(vender).not.toHaveBeenCalled();
    expect(container.textContent).not.toMatch(/Pedido de pacote/);
  });

  it('pacote que não existe mais é dito, sem quebrar', async () => {
    await render('/arenas/a1/gerir?aba=membros&pacote=sumiu&para=u1');
    expect(container.textContent).toMatch(/não existe mais/);
  });

  it('sem pedido no endereço, nada aparece', async () => {
    await render();
    expect(container.textContent).not.toMatch(/Pedido de pacote/);
  });
});

describe('venda de balcão', () => {
  it('⭐ "Vender pacote" na linha do membro credita o escolhido', async () => {
    await render();
    await act(async () => { botao('Vender pacote').click(); });
    await act(async () => { botao('Recebi — creditar').click(); });
    expect(vender).toHaveBeenCalledWith({
      arenaId: 'a1', pkgId: 'p1', target: { user_id: 'm1', user_name: 'Bia', user_photo: undefined },
    });
  });
});

describe('quando a leitura falha', () => {
  it('⭐ membros falhando: diz que falhou, sem "Incluir membro" nem pedido', async () => {
    estado.falhaMembros = true;
    await render('/arenas/a1/gerir?aba=membros&pacote=p1&para=u1');
    expect(container.textContent).toMatch(/Não foi possível carregar/);
    expect(botao('Incluir membro')).toBeUndefined();
    expect(container.textContent).not.toMatch(/Ana quer 10 horas/);
    expect(vender).not.toHaveBeenCalled();
  });

  it('⭐ pacotes falhando: diz que falhou, sem "Novo pacote"', async () => {
    estado.falhaPacotes = true;
    await render('/arenas/a1/gerir?aba=planos', 'planos');
    expect(container.textContent).toMatch(/Não foi possível carregar/);
    expect(botao('Novo pacote')).toBeUndefined();
  });

  it('pacotes falhando: a linha do membro não oferece vender pacote', async () => {
    estado.falhaPacotes = true;
    await render();
    expect(botao('Vender pacote')).toBeUndefined();
  });
});
