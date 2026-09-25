/**
 * Métricas da arena — o dinheiro dos módulos.
 *
 * O que protege:
 *  1. ⭐ sem módulo ligado, o painel é o de antes (sem cartão novo, total igual);
 *  2. ⭐ com os módulos, aparecem Planos, Aulas e Torneios, e o total do mês
 *     soma o que foi RECEBIDO (aula: só a parte da arena);
 *  3. o torneio da casa é PREVISTO e não entra no total;
 *  4. 🐞 a venda paga da loja entra UMA vez (antes, duas);
 *  5. ⭐ o pedido do app entregue conta pelo Mercado — e não de novo como venda;
 *  6. ⭐ reservas ou vendas falhando: nada de "R$ 0,00" — a tela diz que falhou;
 *  7. uma parte secundária falhando: os números saem, com o aviso de que estão
 *     incompletos e do que ficou de fora.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const LIGADOS = new Set();
const hoje = new Date();
const MES = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
const vazio = { data: [], isLoading: false };
const dados = { vendas: [], saidas: [], falhaReservas: false, falhaAulas: false };
const falha = () => ({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });

vi.mock('@/modules/arenas/hooks/useBookings', () => ({
  useArenaBookings: () => (dados.falhaReservas ? falha() : vazio),
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArenaReviews: () => vazio, useArenaCourtSchedules: () => vazio, useArenaCourts: () => vazio,
  useInventoryEntries: () => vazio, useInventoryExits: () => ({ data: dados.saidas, isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id) }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaSales: () => ({ data: dados.vendas, isLoading: false }),
  useArenaClasses: (id) => (id && dados.falhaAulas ? falha() : { data: id ? [{ id: 'k1', date: `${MES}-10` }] : [] }),
  useArenaClassBookingsAll: (id) => ({ data: id ? [{ class_id: 'k1', paid: true, amount: 100, arena_amount: 20 }] : [] }),
  useArenaWallets: (id) => ({ data: id ? [{ transactions: [{ type: 'package_purchase', amount: 500, at: new Date() }] }] : [] }),
  useArenaSubscriptions: (id) => ({ data: id ? [{ price: 150, paid_months: [MES] }] : [] }),
  useArenaInternalTournaments: (id) => ({ data: id ? [{ date: `${MES}-20`, enrolled: 10, entry_fee: 40 }] : [] }),
}));

const { default: V2ArenaMetrics } = await import('./V2ArenaMetrics.jsx');

let container, root;
beforeEach(() => {
  LIGADOS.clear();
  dados.vendas = [];
  dados.saidas = [];
  dados.falhaReservas = false;
  dados.falhaAulas = false;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render() {
  await act(async () => { root.render(<V2ArenaMetrics arena={{ id: 'a1' }} />); });
}

describe('o dinheiro dos módulos nas métricas', () => {
  it('⭐ sem módulo ligado, o painel é o de antes', async () => {
    await render();
    expect(container.textContent).not.toContain('Planos (membros)');
    expect(container.textContent).not.toContain('Torneios da casa');
    expect(container.textContent).toContain('Reservas + PDV + Mercado');
    expect(container.textContent).not.toContain('Planos e aulas');
  });

  it('⭐ com os módulos, os cartões aparecem e o total soma o RECEBIDO', async () => {
    [ARENA_MODULE_ID.CLASSES, ARENA_MODULE_ID.MEMBERS_PACKAGES,
      ARENA_MODULE_ID.MEMBERS_SUBSCRIPTION, ARENA_MODULE_ID.LEAGUES].forEach((m) => LIGADOS.add(m));
    await render();
    const t = container.textContent.replace(/\s+/g, ' ');
    expect(t).toContain('Planos (membros)');
    expect(t).toMatch(/R\$\s?650,00/);
    expect(t).toContain('1 pacote(s) vendido(s)');
    expect(t).toMatch(/Fica com a arena · R\$\s?100,00 recebidos de 1 aluno/);
    // Total: 500 (pacote) + 150 (mensalidade) + 20 (parte da arena na aula).
    expect(t).toMatch(/R\$\s?670,00/);
    expect(t).toContain('Planos e aulas');
  });

  it('o torneio da casa é PREVISTO e não entra no total', async () => {
    LIGADOS.add(ARENA_MODULE_ID.LEAGUES);
    await render();
    const t = container.textContent.replace(/\s+/g, ' ');
    expect(t).toMatch(/R\$\s?400,00/);
    expect(t).toContain('não entra no total');
    expect(t).toMatch(/Receita total \(mês\)\s?R\$\s?0,00/);
  });

  it('🐞 a venda paga da loja entra UMA vez no total (antes somava duas)', async () => {
    dados.vendas = [{ id: 'v1', status: 'paid', total: 10, created_at_ms: Date.now() }];
    await render();
    // O real sai com espaço inseparável (toLocaleString).
    expect(container.textContent.replace(/\u00a0/g, ' ')).toContain('Receita total (mês)R$ 10,00');
  });

  it('⭐ o pedido do app entregue conta pelo MERCADO, uma vez só', async () => {
    LIGADOS.add(ARENA_MODULE_ID.PDV);
    dados.vendas = [{
      id: 'v2', catalog: 'mercado', status: 'paid', stock_applied: true, total: 8, created_at_ms: Date.now(),
    }];
    dados.saidas = [{ date: `${MES}-05`, exit_type: 'sale', quantity: 1, total_price: 8, channel: 'app' }];
    await render();
    const texto = container.textContent.replace(/\u00a0/g, ' ');
    expect(texto).toContain('Receita total (mês)R$ 8,00');
    expect(texto).toContain('Pedidos do app');
    expect(texto).toContain('(R$ 8,00 pelo app)');
    expect(container.textContent).not.toContain('Receita de vendas (PDV)');
  });

  it('⭐ reservas falhando: a tela diz que falhou, e não mostra R$ 0,00', async () => {
    dados.falhaReservas = true;
    await render();
    expect(container.textContent).toMatch(/Não foi possível/);
    expect(container.textContent).toContain('Tentar de novo');
    expect(container.textContent).not.toContain('Receita total (mês)');
  });

  it('uma parte falhando: os números saem, avisando o que ficou de fora', async () => {
    LIGADOS.add(ARENA_MODULE_ID.CLASSES);
    dados.falhaAulas = true;
    await render();
    expect(container.textContent).toContain('Receita total (mês)');
    expect(container.textContent).toMatch(/Ficou de fora: aulas/);
  });
});
