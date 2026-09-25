/**
 * "Precisa de você" no topo da Central da arena.
 *
 * O que protege:
 *  1. ⭐ cada pendência vira um item que leva à aba que resolve;
 *  2. ⭐ consulta que falhou NÃO vira "0 pedidos" — o item some;
 *  3. módulo desligado: nem o item, nem a consulta;
 *  4. nada pendente: a faixa não existe (e não diz "tudo em dia").
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { todayISO } from '@/modules/arenas/domain/subscription';

const LIGADOS = new Set();
const estado = { reservas: null, vendas: null, mensalidades: null };
const consultas = { vendas: [], mensalidades: [] };
const ok = (data) => ({ data, isSuccess: true, isError: false });
const falha = () => ({ data: undefined, isSuccess: false, isError: true });

vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id) }),
}));
vi.mock('@/modules/arenas/hooks/useBookings', () => ({ useArenaBookings: () => estado.reservas }));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaSales: (id) => { consultas.vendas.push(id); return id ? estado.vendas : { data: undefined, isSuccess: false }; },
  useArenaSubscriptions: (id) => { consultas.mensalidades.push(id); return id ? estado.mensalidades : { data: undefined, isSuccess: false }; },
}));

const { default: ArenaPendencias } = await import('./ArenaPendencias.jsx');

const HOJE = todayISO();
const irPara = vi.fn();
let container, root;
beforeEach(() => {
  LIGADOS.clear();
  [ARENA_MODULE_ID.PDV, ARENA_MODULE_ID.MEMBERS, ARENA_MODULE_ID.MEMBERS_SUBSCRIPTION].forEach((m) => LIGADOS.add(m));
  estado.reservas = ok([{ id: 'b1', status: 'requested', slots: [{ date: '2999-01-01', start: '19:00', end: '20:00' }] }]);
  estado.vendas = ok([{ id: 's1', status: 'pending', stock_applied: false }, { id: 's2', status: 'pending', stock_applied: false }]);
  estado.mensalidades = ok([{ status: 'active', started_on: '2020-01-01', billing_day: 1, paid_months: [] }]);
  consultas.vendas.length = 0;
  consultas.mensalidades.length = 0;
  irPara.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render() {
  await act(async () => { root.render(<ArenaPendencias arena={{ id: 'a1' }} onIrParaAba={irPara} />); });
}
const botoes = () => [...container.querySelectorAll('button')];

describe('Precisa de você', () => {
  it('⭐ cada pendência leva à aba que resolve', async () => {
    await render();
    const textos = botoes().map((b) => b.textContent);
    expect(textos).toEqual(['1 reserva para confirmar', '2 pedidos do app para entregar', '1 mensalidade em atraso']);
    await act(async () => { botoes()[1].click(); });
    expect(irPara).toHaveBeenCalledWith('pedidos');
    await act(async () => { botoes()[2].click(); });
    expect(irPara).toHaveBeenCalledWith('membros');
  });

  it('⭐ consulta que falhou não vira zero — o item some', async () => {
    estado.vendas = falha();
    await render();
    const textos = botoes().map((b) => b.textContent).join(' | ');
    expect(textos).not.toMatch(/pedido/);
    expect(textos).toMatch(/reserva para confirmar/);
  });

  it('módulo desligado: nem o item, nem a consulta', async () => {
    LIGADOS.delete(ARENA_MODULE_ID.PDV);
    await render();
    expect(botoes().map((b) => b.textContent).join(' ')).not.toMatch(/pedido/);
    expect(consultas.vendas.every((id) => id === null)).toBe(true);
  });

  it('nada pendente: a faixa não existe', async () => {
    estado.reservas = ok([]);
    estado.vendas = ok([]);
    estado.mensalidades = ok([]);
    await render();
    expect(container.innerHTML).toBe('');
    expect(HOJE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
