/**
 * A loja DENTRO da arena — as três telas que passaram a mostrá-la.
 *
 * O que protege:
 *  1. ⭐ Central → Pedidos do app: o que falta entregar, "Entreguei", o valor
 *     conferido contra a tabela de hoje, cada parte da conta dividida (e
 *     "Recebi no balcão" por quem não registrou), e o caminho para o Mercado
 *     quando nada está à venda pelo app;
 *  2. ⭐ a cópia do estoque é conferida UMA vez ao abrir a aba;
 *  3. ⭐ página da arena: loja desligada, a seção não existe; ligada, o meu
 *     pedido em aberto aparece; a vitrine só com `pdv_catalog`;
 *  4. ⭐ falha de leitura NÃO some com a seção — vira aviso;
 *  5. ⭐ Minhas reservas: o que retirar e a parte a pagar, de todas as arenas.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const LIGADOS = new Set();
const estado = {
  vendas: [], vendasErro: false, pagamentosArena: [], mercado: [], atletas: [],
  vitrine: [], vitrineErro: false, minhas: [], minhasErro: false, meusPagamentos: [],
};
const entregar = vi.fn(() => Promise.resolve());
const receber = vi.fn(() => Promise.resolve());
const confirmarPg = vi.fn(() => Promise.resolve());
const sincronizar = vi.fn();
const pagarParte = vi.fn(() => Promise.resolve());
const refetch = vi.fn();
const mut = (fn = vi.fn(() => Promise.resolve())) => ({ mutateAsync: fn, isPending: false });

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'eu' }, isAuthenticated: true }) }));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id), isLoading: false }),
}));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({ useAthletes: () => ({ data: estado.atletas }) }));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useInventoryProducts: () => ({ data: estado.mercado, isSuccess: true }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaSales: () => ({
    data: estado.vendasErro ? undefined : estado.vendas,
    isLoading: false, isError: estado.vendasErro, isSuccess: !estado.vendasErro, refetch,
  }),
  useArenaPayments: () => ({ data: estado.pagamentosArena }),
  useConfirmSale: () => mut(entregar),
  useCancelSale: () => mut(),
  useConfirmPayment: () => mut(confirmarPg),
  useReceiveShareAtCounter: () => mut(receber),
  useSyncShopStock: () => ({ mutate: sincronizar }),
  useShopProducts: (arenaId) => ({
    data: arenaId ? (estado.vitrineErro ? undefined : estado.vitrine) : undefined,
    isLoading: false, isError: Boolean(arenaId) && estado.vitrineErro, refetch,
  }),
  useMySales: (arenaId) => ({ data: arenaId ? estado.minhas.filter((s) => s.arena_id === arenaId) : [] }),
  useMyShopSales: () => ({
    data: estado.minhasErro ? undefined : estado.minhas, isError: estado.minhasErro, refetch,
  }),
  useMyPayments: () => ({ data: estado.meusPagamentos }),
  usePayMyShare: () => mut(pagarParte),
  useCancelMyOrder: () => mut(),
}));

const { default: ArenaShopOrdersPanel } = await import('./ArenaShopOrdersPanel.jsx');
const { default: ArenaShopSection } = await import('./ArenaShopSection.jsx');
const { default: MyShopPurchases } = await import('./MyShopPurchases.jsx');

const ARENA = { id: 'a1', name: 'Arena Teste' };
const agora = Date.now();
const pedido = (id, over = {}) => ({
  id, arena_id: 'a1', arena_name: 'Arena Teste', catalog: 'mercado', buyer_id: 'ana', buyer_name: 'Ana',
  items: [{ product_id: 'agua', name: 'Água', quantity: 2, price: 5 }], total: 10,
  status: 'pending', stock_applied: false, split_with: [], created_at_ms: agora, ...over,
});
const agua = { id: 'agua', name: 'Água', sale_price: 5, sell_online: true, active: true };

let container;
let root;
beforeEach(() => {
  LIGADOS.clear();
  [entregar, receber, confirmarPg, sincronizar, pagarParte, refetch].forEach((f) => f.mockClear());
  Object.assign(estado, {
    vendas: [], vendasErro: false, pagamentosArena: [], mercado: [agua], atletas: [],
    vitrine: [], vitrineErro: false, minhas: [], minhasErro: false, meusPagamentos: [],
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const render = async (el) => {
  await act(async () => { root.render(<MemoryRouter>{el}</MemoryRouter>); });
};
const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
const texto = () => container.textContent.replace(/\u00a0/g, ' ');

describe('Central → Pedidos do app', () => {
  it('⭐ mostra o que falta entregar, e "Entreguei" entrega', async () => {
    estado.vendas = [pedido('v1'), pedido('v2', { buyer_name: 'Beto', stock_applied: true })];
    await render(<ArenaShopOrdersPanel arena={ARENA} />);
    expect(texto()).toContain('Ana');
    expect(texto()).not.toContain('Beto'); // já entregue: fora da lista padrão
    await act(async () => { botao('Entreguei').click(); });
    expect(entregar).toHaveBeenCalledWith({ arenaId: 'a1', saleId: 'v1' });
  });

  it('⭐ a cópia do estoque é conferida UMA vez ao abrir', async () => {
    await render(<ArenaShopOrdersPanel arena={ARENA} />);
    await render(<ArenaShopOrdersPanel arena={ARENA} />);
    expect(sincronizar).toHaveBeenCalledTimes(1);
    expect(sincronizar).toHaveBeenCalledWith({ arenaId: 'a1' });
  });

  it('⭐ pedido com valor que não bate com a tabela de hoje aparece marcado', async () => {
    estado.vendas = [pedido('v1', { total: 0.02 })];
    await render(<ArenaShopOrdersPanel arena={ARENA} />);
    expect(texto()).toContain('Pela tabela de hoje este pedido dá R$ 10,00');
  });

  it('pedido com o preço da tabela não tem aviso', async () => {
    estado.vendas = [pedido('v1')];
    await render(<ArenaShopOrdersPanel arena={ARENA} />);
    expect(texto()).not.toContain('Pela tabela de hoje');
  });

  it('⭐ a conta dividida mostra cada parte; a arena recebe no balcão por quem não registrou', async () => {
    estado.atletas = [{ id: 'bia', platform_name: 'Bia' }];
    estado.vendas = [pedido('v1', {
      split_with: ['ana', 'bia'],
      split_details: [{ user_id: 'ana', amount: 5 }, { user_id: 'bia', amount: 5 }],
    })];
    estado.pagamentosArena = [{ id: 'v1_ana', sale_id: 'v1', payer_id: 'ana', status: 'pending' }];
    await render(<ArenaShopOrdersPanel arena={ARENA} />);
    expect(texto()).toContain('Diz que pagou');
    expect(texto()).toContain('Bia');
    expect(texto()).toContain('Não registrou');
    await act(async () => { botao('Confirmar recebimento').click(); });
    expect(confirmarPg).toHaveBeenCalledWith({ arenaId: 'a1', paymentId: 'v1_ana' });
    await act(async () => { botao('Recebi no balcão').click(); });
    expect(receber).toHaveBeenCalledWith({ arenaId: 'a1', saleId: 'v1', payerId: 'bia' });
  });

  it('⭐ nada à venda pelo app: explica e leva ao Mercado', async () => {
    estado.mercado = [{ ...agua, sell_online: false }];
    const irAoMercado = vi.fn();
    await render(<ArenaShopOrdersPanel arena={ARENA} onIrAoMercado={irAoMercado} />);
    expect(texto()).toContain('Nenhum produto à venda pelo app ainda');
    await act(async () => { botao('Abrir o Mercado').click(); });
    expect(irAoMercado).toHaveBeenCalled();
  });

  it('balcão em dia é dito — e só depois de a consulta dar certo', async () => {
    await render(<ArenaShopOrdersPanel arena={ARENA} />);
    expect(texto()).toContain('Nada a entregar. Balcão em dia.');
  });

  it('⭐ falha ao ler os pedidos vira aviso, não "balcão em dia"', async () => {
    estado.vendasErro = true;
    await render(<ArenaShopOrdersPanel arena={ARENA} />);
    expect(texto()).toContain('Não foi possível carregar os pedidos');
    expect(texto()).not.toContain('Balcão em dia');
  });
});

describe('a seção na página da arena', () => {
  it('⭐ loja desligada: não existe', async () => {
    estado.vitrine = [{ id: 'agua', name: 'Água', price: 5, stock: 3 }];
    await render(<ArenaShopSection arena={ARENA} />);
    expect(container.textContent).toBe('');
  });

  it('⭐ ligada: leva à loja; a vitrine só aparece com o catálogo', async () => {
    LIGADOS.add(ARENA_MODULE_ID.PDV);
    estado.vitrine = [{ id: 'agua', name: 'Água', price: 5, stock: 3 }];
    await render(<ArenaShopSection arena={ARENA} />);
    expect(texto()).toContain('Loja');
    expect(container.querySelector('a[href="/arenas/a1/loja"]')).toBeTruthy();
    expect(texto()).not.toContain('Últimas 3');

    LIGADOS.add(ARENA_MODULE_ID.PDV_CATALOG);
    await render(<ArenaShopSection arena={ARENA} />);
    expect(texto()).toContain('Água');
    expect(texto()).toContain('Últimas 3');
  });

  it('⭐ o meu pedido em aberto aqui aparece primeiro', async () => {
    LIGADOS.add(ARENA_MODULE_ID.PDV);
    estado.vitrine = [{ id: 'agua', name: 'Água', price: 5, stock: null }];
    estado.minhas = [pedido('m1', { buyer_id: 'eu' })];
    await render(<ArenaShopSection arena={ARENA} />);
    expect(texto()).toContain('Seus pedidos aqui');
    expect(texto()).toContain('Retire no balcão');
  });

  it('sem nada à venda e sem pedido meu: não ocupa a página', async () => {
    LIGADOS.add(ARENA_MODULE_ID.PDV);
    await render(<ArenaShopSection arena={ARENA} />);
    expect(container.textContent).toBe('');
  });

  it('⭐ falha de leitura vira aviso, não some', async () => {
    LIGADOS.add(ARENA_MODULE_ID.PDV);
    estado.vitrineErro = true;
    await render(<ArenaShopSection arena={ARENA} />);
    expect(texto()).toContain('Não foi possível carregar a loja');
  });
});

describe('Minhas reservas → Compras nas arenas', () => {
  it('⭐ o que retirar e a parte a pagar, de todas as arenas', async () => {
    estado.minhas = [
      pedido('m1', { buyer_id: 'eu', arena_name: 'Arena Norte' }),
      pedido('m2', {
        arena_id: 'a2', arena_name: 'Arena Sul', buyer_id: 'ana',
        split_with: ['ana', 'eu'], split_details: [{ user_id: 'ana', amount: 5 }, { user_id: 'eu', amount: 5 }],
      }),
    ];
    await render(<MyShopPurchases />);
    expect(texto()).toContain('Compras nas arenas');
    expect(texto()).toContain('Arena Norte');
    expect(texto()).toContain('Arena Sul');
    await act(async () => { botao('Registrar a minha parte').click(); });
    expect(pagarParte).toHaveBeenCalledWith({ arenaId: 'a2', saleId: 'm2' });
  });

  it('o histórico vem recolhido, para não empurrar as reservas', async () => {
    estado.minhas = [pedido('m1', { buyer_id: 'eu', stock_applied: true, status: 'paid' })];
    await render(<MyShopPurchases />);
    expect(texto()).toContain('Últimas compras (1)');
    expect(texto()).not.toContain('Entregue');
    await act(async () => { botao('Últimas compras').click(); });
    expect(texto()).toContain('Entregue');
  });

  it('⭐ falha de leitura vira aviso (sumir seria dizer que não há compra)', async () => {
    estado.minhasErro = true;
    await render(<MyShopPurchases />);
    expect(texto()).toContain('Não foi possível carregar as suas compras nas arenas');
  });

  it('sem compra nenhuma: a seção não aparece', async () => {
    await render(<MyShopPurchases />);
    expect(container.textContent).toBe('');
  });
});
