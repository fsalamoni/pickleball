/**
 * A loja da arena no aplicativo (`/arenas/:arenaId/loja`).
 *
 * O que estes testes protegem:
 *  1. ⭐ sem o módulo, a rota não existe;
 *  2. ⭐ a vitrine são os produtos do MERCADO (preço e estoque de lá);
 *  3. ⭐ o pedido manda SÓ produto e quantidade — o preço quem define é o
 *     banco, nunca a tela;
 *  4. ⭐ dividir a conta manda o comprador junto na lista;
 *  5. ⭐ quem entrou na divisão registra a PRÓPRIA parte;
 *  6. ⭐ quem pediu pode desistir do pedido em aberto;
 *  7. ⭐ quem gere a arena é levado ao balcão da Central (o balcão saiu daqui);
 *  8. o "+" para no estoque; esgotado não entra; falha vira aviso.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const LIGADOS = new Set();
const estado = { gere: false, produtos: [], produtosErro: false, minhas: [], pagamentos: [], atletas: [] };
const comprar = vi.fn(() => Promise.resolve('v1'));
const pagarParte = vi.fn(() => Promise.resolve());
const desistir = vi.fn(() => Promise.resolve());
const refetch = vi.fn();

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'eu' }, isPlatformAdmin: false, isAuthenticated: true }),
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArena: () => ({
    data: {
      id: 'a1', name: 'Arena Teste', owner_id: estado.gere ? 'eu' : 'outro',
      payment: { pix_key: 'arena@pix.com', pix_key_type: 'email', active: true },
    },
    isLoading: false,
  }),
  useMyManagedArenas: () => ({ data: [] }),
}));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({
  useAthletes: () => ({ data: estado.atletas }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id), isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useShopProducts: () => ({
    data: estado.produtosErro ? undefined : estado.produtos,
    isLoading: false, isError: estado.produtosErro, isSuccess: !estado.produtosErro, refetch,
  }),
  useCreateSale: () => ({ mutateAsync: comprar, isPending: false }),
  useMySales: () => ({ data: estado.minhas, isLoading: false, isError: false }),
  useMyPayments: () => ({ data: estado.pagamentos }),
  usePayMyShare: () => ({ mutateAsync: pagarParte, isPending: false }),
  useCancelMyOrder: () => ({ mutateAsync: desistir, isPending: false }),
}));

const { default: V2ArenaPDV } = await import('./V2ArenaPDV.jsx');
const { default: V2ArenaAdminPDV } = await import('./V2ArenaAdminPDV.jsx');

const msDeHoje = new Date().setHours(12, 0, 0, 0);

// Produto como a vitrine recebe (`shopProducts` do Mercado).
const produto = (over = {}) => ({
  id: 'p1', name: 'Água 500ml', price: 6, category: 'Bebida', stock: 10, detail: '', ...over,
});

let container, root;

beforeEach(() => {
  LIGADOS.clear();
  LIGADOS.add(ARENA_MODULE_ID.PDV);
  comprar.mockClear(); pagarParte.mockClear(); desistir.mockClear(); refetch.mockClear();
  Object.assign(estado, { gere: false, produtos: [], produtosErro: false, minhas: [], pagamentos: [], atletas: [] });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

async function render(rota = '/arenas/a1/loja') {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/arenas/:arenaId/loja" element={<V2ArenaPDV />} />
          <Route path="/arenas/:arenaId/gerir/pdv" element={<V2ArenaAdminPDV />} />
          <Route path="/arenas/:arenaId/gerir" element={<div>CENTRAL</div>} />
          <Route path="/arenas/:arenaId" element={<div>PÁGINA DA ARENA</div>} />
          <Route path="/arenas" element={<div>DIRETÓRIO</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

async function clicar(texto) {
  const alvo = [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
  expect(alvo, `botão "${texto}" não encontrado`).toBeTruthy();
  await act(async () => { alvo.click(); });
}

async function clicarAria(label) {
  const alvo = container.querySelector(`[aria-label="${label}"]`);
  expect(alvo, `botão "${label}" não encontrado`).toBeTruthy();
  await act(async () => { alvo.click(); });
}

/* ================================================================ guarda === */

describe('quem entra aqui', () => {
  it('⭐ sem o módulo, volta para a arena', async () => {
    LIGADOS.clear();
    await render();
    expect(container.textContent).toContain('PÁGINA DA ARENA');
  });

  it('com o módulo, a loja abre', async () => {
    await render();
    expect(container.textContent).toContain('Loja da Arena Teste');
  });

  it('⭐ a rota antiga do balcão leva à aba da Central', async () => {
    await render('/arenas/a1/gerir/pdv');
    expect(container.textContent).toBe('CENTRAL');
  });
});

/* =============================================================== atleta === */

describe('o atleta', () => {
  it('⭐ vê o produto do Mercado com preço e estoque', async () => {
    estado.produtos = [produto()];
    await render();
    expect(container.textContent).toContain('Água 500ml');
    expect(container.textContent).toMatch(/6,00/);
    expect(container.textContent).toContain('10 disponíveis');
  });

  it('últimas unidades aparecem como tal', async () => {
    estado.produtos = [produto({ stock: 2 })];
    await render();
    expect(container.textContent).toContain('Últimas 2');
  });

  it('⭐ produto esgotado não entra no carrinho', async () => {
    estado.produtos = [produto({ stock: 0 })];
    await render();
    expect(container.textContent).toContain('Esgotado');
    expect(container.querySelector('[aria-label="Colocar um Água 500ml no carrinho"]').disabled).toBe(true);
  });

  it('o "+" para no estoque: pedir o que não existe seria descobrir no balcão', async () => {
    estado.produtos = [produto({ stock: 1 })];
    await render();
    await clicarAria('Colocar um Água 500ml no carrinho');
    expect(container.querySelector('[aria-label="Colocar um Água 500ml no carrinho"]').disabled).toBe(true);
  });

  it('produto sem controle de estoque (null) não aparece como esgotado', async () => {
    estado.produtos = [produto({ stock: null })];
    await render();
    expect(container.textContent).not.toContain('Esgotado');
    expect(container.querySelector('[aria-label="Colocar um Água 500ml no carrinho"]').disabled).toBe(false);
  });

  it('⭐ o pedido manda SÓ produto e quantidade — o preço é o do banco', async () => {
    estado.produtos = [produto()];
    await render();
    await clicarAria('Colocar um Água 500ml no carrinho');
    await clicarAria('Colocar um Água 500ml no carrinho');
    expect(container.textContent).toContain('Seu pedido');
    await clicar('Fazer o pedido');
    expect(comprar).toHaveBeenCalledTimes(1);
    const pedido = comprar.mock.calls[0][0];
    expect(pedido).toMatchObject({ arenaId: 'a1', splitWith: [] });
    expect(pedido.items).toEqual([{ product_id: 'p1', quantity: 2 }]);
  });

  it('a tela avisa que a arena é avisada e que vale o preço da arena', async () => {
    estado.produtos = [produto()];
    await render();
    await clicarAria('Colocar um Água 500ml no carrinho');
    expect(container.textContent).toMatch(/A arena é avisada na hora/);
    expect(container.textContent).toMatch(/Vale o preço da arena no momento do pedido/);
  });

  it('com mais de uma categoria, a vitrine se agrupa', async () => {
    estado.produtos = [produto(), produto({ id: 'p2', name: 'Grip', category: 'Acessórios', price: 25 })];
    await render();
    const texto = container.textContent;
    expect(texto.indexOf('Acessórios')).toBeLessThan(texto.indexOf('Grip'));
    expect(texto.indexOf('Bebida')).toBeLessThan(texto.indexOf('Água 500ml'));
  });

  it('⭐ dividir a conta manda o COMPRADOR junto na lista', async () => {
    LIGADOS.add(ARENA_MODULE_ID.PDV_SPLIT);
    estado.produtos = [produto({ price: 10 })];
    estado.atletas = [{ id: 'amigo', platform_name: 'Amigo' }];
    await render();
    await clicarAria('Colocar um Água 500ml no carrinho');

    const busca = container.querySelector('input[aria-label="Buscar quem divide a conta"]');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(busca, 'Amigo');
      busca.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clicar('Amigo');
    await clicar('Fazer o pedido');

    expect(comprar.mock.calls[0][0].splitWith).toEqual(['eu', 'amigo']);
  });

  it('sem o módulo de divisão, não oferece dividir', async () => {
    estado.produtos = [produto()];
    await render();
    await clicarAria('Colocar um Água 500ml no carrinho');
    expect(container.textContent).not.toMatch(/Dividir com/i);
  });

  it('⭐ quem entrou na divisão registra a PRÓPRIA parte', async () => {
    estado.minhas = [{
      id: 'v1', arena_id: 'a1', buyer_id: 'outro', total: 20,
      items: [{ name: 'Água', quantity: 2 }], status: 'pending', stock_applied: false,
      created_at_ms: msDeHoje, split_with: ['outro', 'eu'],
      split_details: [{ user_id: 'outro', amount: 10 }, { user_id: 'eu', amount: 10 }],
    }];
    await render();
    expect(container.textContent).toContain('Suas compras aqui');
    await clicar('Registrar a minha parte');
    expect(pagarParte).toHaveBeenCalledWith({ arenaId: 'a1', saleId: 'v1' });
  });

  it('⭐ quem pediu desiste do pedido em aberto', async () => {
    estado.minhas = [{
      id: 'v9', arena_id: 'a1', buyer_id: 'eu', total: 6, items: [{ name: 'Água', quantity: 1 }],
      status: 'pending', stock_applied: false, split_with: [], created_at_ms: msDeHoje,
    }];
    await render();
    expect(container.textContent).toContain('Retire no balcão');
    await clicar('Desistir');
    // O diálogo de confirmação tem o seu próprio botão "Desistir".
    const botoes = [...document.body.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Desistir');
    await act(async () => { botoes[botoes.length - 1].click(); });
    expect(desistir).toHaveBeenCalledWith({ arenaId: 'a1', saleId: 'v9' });
  });

  it('mostra a chave Pix da arena quando o módulo está ligado e há compra em aberto', async () => {
    LIGADOS.add(ARENA_MODULE_ID.PDV_PIX_NATIVE);
    estado.minhas = [{ id: 'v1', arena_id: 'a1', buyer_id: 'eu', total: 6, items: [], status: 'pending', created_at_ms: msDeHoje }];
    await render();
    expect(container.textContent).toContain('arena@pix.com');
  });

  it('sem o módulo Pix, a chave não aparece', async () => {
    estado.minhas = [{ id: 'v1', arena_id: 'a1', buyer_id: 'eu', total: 6, items: [], status: 'pending', created_at_ms: msDeHoje }];
    await render();
    expect(container.textContent).not.toContain('arena@pix.com');
  });

  it('⭐ falha ao carregar os produtos vira aviso com "tentar de novo" (não "sem produtos")', async () => {
    estado.produtosErro = true;
    await render();
    expect(container.textContent).toContain('Não foi possível carregar os produtos');
    expect(container.textContent).not.toContain('ainda não colocou produtos');
    await clicar('Tentar de novo');
    expect(refetch).toHaveBeenCalled();
  });
});

/* ================================================================ arena === */

describe('quem gere a arena', () => {
  it('⭐ é levado ao balcão da Central — o balcão saiu desta tela', async () => {
    estado.gere = true;
    await render();
    expect(container.querySelector('a[href="/arenas/a1/gerir?aba=pedidos"]')).toBeTruthy();
    expect(container.textContent).not.toContain('Balcão em dia');
  });
});
