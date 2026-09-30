/**
 * A aba Estoque mostra o que HÁ PARA VENDER — não o cadastro inteiro.
 *
 * 🐞 Relatado: "o estoque está aparecendo a lista completa de itens do
 * mercado, mesmo que já esgotados". Era isso: a lista era o CADASTRO, e cada
 * item puxado do catálogo e nunca comprado aparecia como "Estoque: 0" no meio
 * do que de fato estava na prateleira. Agora a aba abre em "À venda", e o resto
 * fica nos filtros, com a contagem.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const dados = {
  products: [
    { id: 'agua', name: 'Água mineral', category: 'Bebida', sale_price: 5, active: true },
    { id: 'isotonico', name: 'Isotônico', category: 'Bebida', sale_price: 9, active: true },
    { id: 'bola', name: 'Bola de pickleball', category: 'Bola', sale_price: 30, active: true, catalog_id: 'cat_bola' },
    { id: 'suco', name: 'Suco de caixinha', category: 'Bebida', sale_price: 6, active: true, expiry_date: '2020-01-01' },
    { id: 'grip', name: 'Grip', category: 'Acessórios', sale_price: 25, active: false },
  ],
  entries: [
    { product_id: 'agua', quantity: 24 },
    { product_id: 'isotonico', quantity: 6 },
    { product_id: 'suco', quantity: 4 },
    { product_id: 'grip', quantity: 2 },
  ],
  exits: [{ product_id: 'isotonico', quantity: 6 }],
};

const consulta = (data) => ({ data, isLoading: false, isError: false, refetch: vi.fn() });
const mutacao = () => ({ mutateAsync: vi.fn(async () => ({})), isPending: false });

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useInventoryProducts: () => consulta(dados.products),
  useInventoryEntries: () => consulta(dados.entries),
  useInventoryExits: () => consulta(dados.exits),
  useCreateInventoryProduct: mutacao,
  useUpdateInventoryProduct: mutacao,
  useDeleteInventoryProduct: mutacao,
  useAddInventoryEntry: mutacao,
  useAddInventoryExit: mutacao,
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: () => false, isLoading: false }),
}));
// As abas irmãs não entram neste teste.
vi.mock('@/v2/components/arenas/V2ArenaCatalogBrowser', () => ({ default: () => <div>CATALOGO</div> }));
vi.mock('@/v2/components/arenas/V2ArenaFinanceTab', () => ({ default: () => <div>FINANCEIRO</div> }));

const { default: V2ArenaMercadoTab } = await import('./V2ArenaMercadoTab.jsx');

let host;
let root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  React.act(() => root.unmount());
  host.remove();
});

async function render() {
  await React.act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/arenas/a1/gerir']}>
        <Routes><Route path="/arenas/:arenaId/gerir" element={<V2ArenaMercadoTab />} /></Routes>
      </MemoryRouter>,
    );
  });
}

const texto = () => host.textContent || '';
const botao = (t) => [...host.querySelectorAll('button')].find((b) => (b.textContent || '').includes(t));
async function clicar(el) {
  await React.act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

describe('Mercado → Estoque', () => {
  it('⭐ abre em "À venda": só o que tem para vender agora', async () => {
    await render();
    await clicar(botao('Estoque'));
    expect(texto()).toContain('Água mineral');
    expect(texto()).toContain('Em estoque: 24');
    // esgotado, vencido, sem compra e inativo NÃO aparecem na frente
    expect(texto()).not.toContain('Isotônico');
    expect(texto()).not.toContain('Suco de caixinha');
    expect(texto()).not.toContain('Bola de pickleball');
    expect(texto()).not.toContain('Grip');
    expect(texto()).not.toContain('Estoque: 0');
  });

  it('o resto fica nos filtros, com a contagem — nada some', async () => {
    await render();
    await clicar(botao('Estoque'));
    const filtros = [...host.querySelectorAll('[aria-label="Mostrar no estoque"] button')].map((b) => b.textContent);
    expect(filtros).toEqual([
      'À venda 1', 'Esgotados 1', 'Vencidos 1', 'Sem compra registrada 1', 'Inativos 1', 'Todos 5',
    ]);

    await clicar(botao('Esgotados'));
    expect(texto()).toContain('Isotônico');
    expect(texto()).not.toContain('Água mineral');

    await clicar(botao('Sem compra registrada'));
    expect(texto()).toContain('Bola de pickleball');
    expect(texto()).toContain('Sem compra registrada');

    await clicar(botao('Vencidos'));
    expect(texto()).toContain('Suco de caixinha');
    expect(texto()).toContain('Fora da venda · 4 na prateleira');
    expect(texto()).toContain('Vencido há');
  });

  it('⭐ o Resumo não chama de "Esgotado" o que nunca foi comprado', async () => {
    await render();
    // o Resumo é a primeira aba
    expect(texto()).toContain('Reposição de estoque');
    expect(texto()).toContain('Isotônico'); // esgotou de verdade
    const reposicao = texto().slice(texto().indexOf('Reposição de estoque'), texto().indexOf('Validade'));
    expect(reposicao).not.toContain('Bola de pickleball');
    expect(reposicao).toContain('1 produto cadastrado ainda não tem compra');
    // validade: só o que está na prateleira (o suco vencido com 4 unidades)
    expect(texto()).toContain('4 na prateleira');
  });
});
