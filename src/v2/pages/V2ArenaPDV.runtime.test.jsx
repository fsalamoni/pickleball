/**
 * A loja da arena.
 *
 * O que estes testes protegem:
 *  1. ⭐ sem o módulo, a rota não existe;
 *  2. ⭐ o atleta compra — e o estoque NÃO baixa aí (baixa na entrega);
 *  3. ⭐ dividir a conta manda o comprador junto na lista;
 *  4. ⭐ quem entrou na divisão registra a PRÓPRIA parte;
 *  5. ⭐ o balcão mostra o que falta entregar e o caixa do dia;
 *  6. produto esgotado não entra no carrinho.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const LIGADOS = new Set();
const estado = { gere: false, produtos: [], vendas: [], minhas: [], atletas: [] };
const comprar = vi.fn(() => Promise.resolve('v1'));
const entregar = vi.fn(() => Promise.resolve());
const pagarParte = vi.fn(() => Promise.resolve());

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
  useArenaProducts: () => ({ data: estado.produtos, isLoading: false }),
  useCreateProduct: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateProduct: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteProduct: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateSale: () => ({ mutateAsync: comprar, isPending: false }),
  useArenaSales: () => ({ data: estado.vendas, isLoading: false }),
  useMySales: () => ({ data: estado.minhas, isLoading: false }),
  useConfirmSale: () => ({ mutateAsync: entregar, isPending: false }),
  useCancelSale: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePayMyShare: () => ({ mutateAsync: pagarParte, isPending: false }),
}));

const { default: V2ArenaPDV } = await import('./V2ArenaPDV.jsx');

const HOJE = (() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();
const msDeHoje = new Date(`${HOJE}T12:00:00`).getTime();

const produto = (over = {}) => ({
  id: 'p1', arena_id: 'a1', name: 'Água 500ml', price: 6,
  category: 'bebidas', stock: 10, active: true, ...over,
});

let container, root;

beforeEach(() => {
  LIGADOS.clear();
  LIGADOS.add(ARENA_MODULE_ID.PDV);
  LIGADOS.add(ARENA_MODULE_ID.PDV_CATALOG);
  comprar.mockClear(); entregar.mockClear(); pagarParte.mockClear();
  Object.assign(estado, { gere: false, produtos: [], vendas: [], minhas: [], atletas: [] });
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
          <Route path="/arenas/:arenaId/gerir/pdv" element={<V2ArenaPDV />} />
          <Route path="/arenas/:arenaId" element={<div>PÁGINA DA ARENA</div>} />
          <Route path="/arenas" element={<div>DIRETÓRIO</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

async function clicar(texto) {
  const alvo = [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
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
});

/* =============================================================== atleta === */

describe('o atleta', () => {
  it('vê o produto com preço e estoque', async () => {
    estado.produtos = [produto()];
    await render();
    expect(container.textContent).toContain('Água 500ml');
    expect(container.textContent).toMatch(/6,00/);
    expect(container.textContent).toContain('10 em estoque');
  });

  it('⭐ produto esgotado não entra no carrinho', async () => {
    estado.produtos = [produto({ stock: 0 })];
    await render();
    expect(container.textContent).toContain('Esgotado');
    expect(container.querySelector('[aria-label="Colocar um Água 500ml no carrinho"]').disabled).toBe(true);
  });

  it('⭐ compra manda os itens e NÃO fala de estoque — quem baixa é a entrega', async () => {
    estado.produtos = [produto()];
    await render();
    await clicarAria('Colocar um Água 500ml no carrinho');
    expect(container.textContent).toContain('Seu carrinho');
    await clicar('Fechar a compra');
    expect(comprar).toHaveBeenCalledTimes(1);
    expect(comprar.mock.calls[0][0]).toMatchObject({
      arenaId: 'a1',
      items: [expect.objectContaining({ product_id: 'p1', quantity: 1, price: 6 })],
      splitWith: [],
    });
  });

  it('a tela avisa que o estoque só baixa na entrega', async () => {
    estado.produtos = [produto()];
    await render();
    await clicarAria('Colocar um Água 500ml no carrinho');
    expect(container.textContent).toMatch(/estoque só baixa na entrega/i);
  });

  it('⭐ dividir a conta manda o COMPRADOR junto na lista', async () => {
    // Dividir uma conta em que quem comprou não paga nada é o começo de uma
    // discussão no vestiário.
    LIGADOS.add(ARENA_MODULE_ID.PDV_SPLIT);
    estado.produtos = [produto({ price: 10 })];
    estado.atletas = [{ id: 'amigo', platform_name: 'Amigo' }];
    await render();
    await clicarAria('Colocar um Água 500ml no carrinho');

    const busca = [...container.querySelectorAll('input')]
      .find((i) => i.placeholder?.includes('divide a conta'));
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(busca, 'Amigo');
      busca.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clicar('Amigo');
    await clicar('Fechar a compra');

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
      items: [{ name: 'Água', quantity: 2 }], status: 'pending',
      created_at_ms: msDeHoje,
      split_details: [{ user_id: 'outro', amount: 10 }, { user_id: 'eu', amount: 10 }],
    }];
    await render();
    expect(container.textContent).toContain('Suas compras aqui');
    await clicar('Registrar a minha parte');
    expect(pagarParte).toHaveBeenCalledWith({ arenaId: 'a1', saleId: 'v1' });
  });

  it('mostra a chave Pix da arena quando o módulo está ligado', async () => {
    LIGADOS.add(ARENA_MODULE_ID.PDV_PIX_NATIVE);
    estado.minhas = [{ id: 'v1', arena_id: 'a1', buyer_id: 'eu', total: 6, items: [], created_at_ms: msDeHoje }];
    await render();
    expect(container.textContent).toContain('arena@pix.com');
  });

  it('sem o módulo Pix, a chave não aparece', async () => {
    estado.minhas = [{ id: 'v1', arena_id: 'a1', buyer_id: 'eu', total: 6, items: [], created_at_ms: msDeHoje }];
    await render();
    expect(container.textContent).not.toContain('arena@pix.com');
  });
});

/* ================================================================ arena === */

describe('a arena', () => {
  beforeEach(() => { estado.gere = true; });

  it('⭐ o balcão mostra o que falta entregar e o caixa do dia', async () => {
    estado.vendas = [
      { id: 'v1', arena_id: 'a1', buyer_name: 'Ana', total: 12, items: [{ name: 'Água', quantity: 2 }], status: 'pending', stock_applied: false, created_at_ms: msDeHoje },
      { id: 'v2', arena_id: 'a1', buyer_name: 'Beto', total: 8, items: [{ name: 'Grip', quantity: 1 }], status: 'pending', stock_applied: true, created_at_ms: msDeHoje },
    ];
    await render('/arenas/a1/gerir/pdv');
    expect(container.textContent).toContain('Balcão');
    expect(container.textContent).toMatch(/2 vendas hoje/);
    expect(container.textContent).toMatch(/20,00/);
    // Só a não entregue fica na lista padrão.
    expect(container.textContent).toContain('Ana');
    expect(container.textContent).not.toContain('Beto');
  });

  it('⭐ "Entreguei" é o que baixa o estoque', async () => {
    estado.vendas = [{
      id: 'v1', arena_id: 'a1', buyer_name: 'Ana', total: 12,
      items: [{ name: 'Água', quantity: 2 }], status: 'pending', stock_applied: false,
      created_at_ms: msDeHoje,
    }];
    await render('/arenas/a1/gerir/pdv');
    await clicar('Entreguei');
    expect(entregar).toHaveBeenCalledWith({ arenaId: 'a1', saleId: 'v1' });
  });

  it('nada a entregar diz que o balcão está em dia', async () => {
    await render('/arenas/a1/gerir/pdv');
    expect(container.textContent).toMatch(/Balcão em dia/i);
  });

  it('⭐ a tela explica por que o estoque baixa na entrega', async () => {
    await render('/arenas/a1/gerir/pdv');
    expect(container.textContent).toMatch(/não\s+na hora do pedido/i);
  });

  it('o catálogo é editável e mostra o que está fora de venda', async () => {
    estado.produtos = [produto({ active: false })];
    await render('/arenas/a1/gerir/pdv');
    expect(container.textContent).toContain('Fora de venda');
    expect(container.textContent).toContain('Editar');
  });

  it('a arena não vê o carrinho do atleta', async () => {
    estado.produtos = [produto()];
    await render('/arenas/a1/gerir/pdv');
    expect(container.textContent).not.toContain('Seu carrinho');
  });
});
