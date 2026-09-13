/**
 * O console de operação da arena.
 *
 * O que estes testes protegem:
 *  1. ⭐ quem não gere a arena não entra;
 *  2. ⭐ cada ferramenta depende do SEU módulo;
 *  3. ⭐ o checkmark de ONTEM não aparece marcado hoje — era o defeito central;
 *  4. ⭐ o resumo do dia mostra o que está pendente, e some quando não há nada;
 *  5. ⭐ a ordem que fecha a quadra DIZ que fecha, e o motivo não vaza;
 *  6. ⭐ o alerta de estoque chega aqui, não só na aba Mercado;
 *  7. a equipe não pede telefone.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { todayISO } from '@/modules/arenas/domain/subscription';

const LIGADOS = new Set();
const estado = {
  gere: true, checklists: [], ordens: [], staff: [],
  produtos: [], entradas: [], saidas: [],
};
const virar = vi.fn();

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'eu' }, isPlatformAdmin: false, isAuthenticated: true }),
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArena: () => ({ data: { id: 'a1', name: 'Arena Teste', owner_id: estado.gere ? 'eu' : 'outro' }, isLoading: false }),
  useMyManagedArenas: () => ({ data: [] }),
  useArenaCourts: () => ({ data: [{ id: 'q1', name: 'Quadra 1' }, { id: 'q2', name: 'Quadra 2' }] }),
  useInventoryProducts: () => ({ data: estado.produtos }),
  useInventoryEntries: () => ({ data: estado.entradas }),
  useInventoryExits: () => ({ data: estado.saidas }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id), isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaChecklists: () => ({ data: estado.checklists, isLoading: false }),
  useCreateChecklist: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useToggleChecklistItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateChecklist: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteChecklist: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRollChecklistDay: () => ({ mutate: virar, isPending: false }),
  useArenaMaintenance: () => ({ data: estado.ordens, isLoading: false }),
  useCreateMaintenance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateMaintenanceStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateMaintenance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteMaintenance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArenaStaff: () => ({ data: estado.staff, isLoading: false }),
  useSaveArenaStaff: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const { default: V2ArenaOperations } = await import('./V2ArenaOperations.jsx');

const HOJE = todayISO();
const ONTEM = (() => {
  const d = new Date(Date.now() - 86_400_000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

let container, root;

beforeEach(() => {
  LIGADOS.clear();
  LIGADOS.add(ARENA_MODULE_ID.OPERATIONS);
  virar.mockClear();
  Object.assign(estado, {
    gere: true, checklists: [], ordens: [], staff: [],
    produtos: [], entradas: [], saidas: [],
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

async function render() {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/arenas/a1/gerir/operacoes']}>
        <Routes>
          <Route path="/arenas/:arenaId/gerir/operacoes" element={<V2ArenaOperations />} />
          <Route path="/arenas/:arenaId" element={<div>PÁGINA DA ARENA</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

const itens = (...marcados) => marcados.map((c, i) => ({
  title: `Tarefa ${i + 1}`, required: true, order: i, completed: c,
}));

/* ================================================================ guarda === */

describe('quem entra aqui', () => {
  it('⭐ quem não gere a arena volta para a página dela', async () => {
    estado.gere = false;
    await render();
    expect(container.textContent).toContain('PÁGINA DA ARENA');
  });

  it('⭐ sem o módulo de operações, a rota não existe', async () => {
    LIGADOS.clear();
    await render();
    expect(container.textContent).toContain('PÁGINA DA ARENA');
  });

  it('com o módulo ligado, a página abre', async () => {
    await render();
    expect(container.textContent).toContain('Operação');
  });

  it('nenhuma ferramenta ativa: diz onde ligar', async () => {
    await render();
    expect(container.textContent).toMatch(/Nenhuma ferramenta de operação ativa/i);
  });
});

/* ============================================================= checklist === */

describe('rotinas do dia', () => {
  beforeEach(() => LIGADOS.add(ARENA_MODULE_ID.OPERATIONS_CHECKLIST));

  it('⭐ o que foi marcado ONTEM aparece desmarcado hoje', async () => {
    estado.checklists = [{
      id: 'c1', title: 'Abertura', kind: 'opening', recurring: true,
      run_date: ONTEM, items: itens(true, true),
    }];
    await render();
    // 0 de 2 — e não 2 de 2, que era o que a tela dizia antes.
    expect(container.textContent).toContain('0/2');
  });

  it('⭐ e a virada do dia é disparada ao abrir a tela', async () => {
    estado.checklists = [{
      id: 'c1', title: 'Abertura', recurring: true, run_date: ONTEM, items: itens(true),
    }];
    await render();
    expect(virar).toHaveBeenCalledTimes(1);
    expect(virar.mock.calls[0][0].todayISO).toBe(HOJE);
  });

  it('checklist já virado hoje não dispara gravação nenhuma', async () => {
    estado.checklists = [{
      id: 'c1', title: 'Abertura', recurring: true, run_date: HOJE, items: itens(false),
    }];
    await render();
    expect(virar).not.toHaveBeenCalled();
  });

  it('o que foi feito HOJE continua marcado', async () => {
    estado.checklists = [{
      id: 'c1', title: 'Abertura', recurring: true, run_date: HOJE, items: itens(true, false),
    }];
    await render();
    expect(container.textContent).toContain('1/2');
  });

  it('⭐ lista não recorrente não é virada nem zerada', async () => {
    estado.checklists = [{
      id: 'c1', title: 'Compras', recurring: false, run_date: ONTEM, items: itens(true, true),
    }];
    await render();
    expect(virar).not.toHaveBeenCalled();
    expect(container.textContent).toContain('2/2');
  });

  it('mostra o histórico dos últimos dias', async () => {
    estado.checklists = [{
      id: 'c1', title: 'Fechamento', recurring: true, run_date: HOJE, items: itens(false),
      history: [{ date: '2026-09-10', progress: 100, done: 3, total: 3 }],
    }];
    await render();
    expect(container.textContent).toMatch(/Últimos dias/i);
    expect(container.textContent).toContain('100%');
  });

  it('sem rotina, convida a criar a primeira', async () => {
    await render();
    expect(container.textContent).toMatch(/Nenhuma rotina ainda/i);
  });
});

/* ============================================================= resumo ===== */

describe('o resumo do dia', () => {
  beforeEach(() => {
    LIGADOS.add(ARENA_MODULE_ID.OPERATIONS_CHECKLIST);
    LIGADOS.add(ARENA_MODULE_ID.OPERATIONS_MAINTENANCE);
  });

  it('⭐ nada pendente: diz isso, em vez de encher a tela de cartões verdes', async () => {
    estado.checklists = [{ id: 'c1', title: 'Abertura', recurring: true, run_date: HOJE, items: itens(true, true) }];
    await render();
    expect(container.textContent).toMatch(/Nada pendente/i);
  });

  it('⭐ conta os itens pendentes e as ordens abertas', async () => {
    estado.checklists = [{ id: 'c1', title: 'Abertura', recurring: true, run_date: HOJE, items: itens(true, false, false) }];
    estado.ordens = [
      { id: 'o1', title: 'Rede', status: 'pending', priority: 'urgent' },
      { id: 'o2', title: 'Luz', status: 'done', priority: 'low' },
    ];
    await render();
    const texto = container.textContent;
    expect(texto).toMatch(/Rotina/);
    expect(texto).toMatch(/itens pendentes/);
    expect(texto).toMatch(/1 urgente/);
  });
});

/* =========================================================== manutenção === */

describe('manutenção', () => {
  beforeEach(() => LIGADOS.add(ARENA_MODULE_ID.OPERATIONS_MAINTENANCE));

  it('⭐ ordem que fecha a quadra DIZ que fecha, com quadra e período', async () => {
    estado.ordens = [{
      id: 'o1', title: 'Trocar o piso', status: 'pending', priority: 'high',
      court_id: 'q2', blocks_court: true,
      starts_on: '2026-10-01', ends_on: '2026-10-03',
      start_time: '08:00', end_time: '18:00',
    }];
    await render();
    const texto = container.textContent;
    expect(texto).toContain('Quadra 2');
    expect(texto).toMatch(/Fecha/);
    expect(texto).toContain('08:00');
  });

  it('ordem que não fecha nada também diz isso', async () => {
    estado.ordens = [{ id: 'o1', title: 'Comprar lâmpadas', status: 'pending', priority: 'low' }];
    await render();
    expect(container.textContent).toMatch(/Não tira nada da venda/i);
  });

  it('ordem sem quadra vale para a arena inteira', async () => {
    estado.ordens = [{ id: 'o1', title: 'Dedetização', status: 'pending', blocks_court: true, starts_on: '2026-10-01', start_time: '08:00', end_time: '12:00' }];
    await render();
    expect(container.textContent).toContain('Arena inteira');
  });

  it('⭐ ordem concluída sai da lista de abertas', async () => {
    estado.ordens = [{ id: 'o1', title: 'Já resolvida', status: 'done' }];
    await render();
    expect(container.textContent).toMatch(/Nenhuma ordem aberta/i);
    expect(container.textContent).toContain('Encerradas (1)');
  });

  it('⭐ o aviso explica que o motivo não aparece para o atleta', async () => {
    await render();
    expect(container.textContent).toMatch(/Manutenção programada/);
    expect(container.textContent).toMatch(/não precisa saber/i);
  });

  it('sem o módulo, a seção não existe', async () => {
    LIGADOS.delete(ARENA_MODULE_ID.OPERATIONS_MAINTENANCE);
    LIGADOS.add(ARENA_MODULE_ID.OPERATIONS_CHECKLIST);
    estado.ordens = [{ id: 'o1', title: 'Trocar o piso', status: 'pending' }];
    await render();
    expect(container.textContent).not.toContain('Trocar o piso');
  });
});

/* ============================================================== estoque === */

describe('estoque', () => {
  beforeEach(() => LIGADOS.add(ARENA_MODULE_ID.OPERATIONS_INVENTORY));

  it('⭐ produto abaixo do mínimo aparece AQUI, não só na aba Mercado', async () => {
    estado.produtos = [{ id: 'p1', name: 'Água 500ml', unit: 'un', min_stock: 20, active: true }];
    estado.entradas = [{ product_id: 'p1', quantity: 24, total_cost: 24 }];
    estado.saidas = [{ product_id: 'p1', quantity: 20, total_price: 60 }];
    await render();
    expect(container.textContent).toContain('Água 500ml');
    expect(container.textContent).toContain('Acabando');
  });

  it('produto esgotado é dito como esgotado', async () => {
    estado.produtos = [{ id: 'p1', name: 'Isotônico', unit: 'un', min_stock: 5, active: true }];
    estado.entradas = [{ product_id: 'p1', quantity: 10, total_cost: 50 }];
    estado.saidas = [{ product_id: 'p1', quantity: 10, total_price: 90 }];
    await render();
    expect(container.textContent).toContain('Esgotado');
  });

  it('estoque saudável não vira alarme', async () => {
    estado.produtos = [{ id: 'p1', name: 'Bola', unit: 'un', min_stock: 2, active: true }];
    estado.entradas = [{ product_id: 'p1', quantity: 50, total_cost: 500 }];
    await render();
    expect(container.textContent).toMatch(/Nenhum produto abaixo do mínimo/i);
  });

  it('produto inativo não entra no alerta', async () => {
    estado.produtos = [{ id: 'p1', name: 'Descontinuado', min_stock: 10, active: false }];
    await render();
    expect(container.textContent).not.toContain('Descontinuado');
  });
});

/* =============================================================== equipe === */

describe('equipe', () => {
  beforeEach(() => LIGADOS.add(ARENA_MODULE_ID.OPERATIONS_STAFF));

  it('sem ninguém, explica para que serve — e que não pede telefone', async () => {
    await render();
    expect(container.textContent).toMatch(/Ninguém cadastrado/i);
    expect(container.textContent).toMatch(/não pede telefone nem documento/i);
  });

  it('lista a equipe agrupada por função', async () => {
    estado.staff = [
      { id: 's1', name: 'Ana', role: 'reception', shift: 'morning', active: true },
      { id: 's2', name: 'Beto', role: 'maintenance', shift: 'full', active: true },
    ];
    await render();
    expect(container.textContent).toContain('Ana');
    expect(container.textContent).toContain('Recepção');
    expect(container.textContent).toContain('Beto');
    expect(container.textContent).toContain('Manutenção');
  });

  it('⭐ diz quem está de plantão agora', async () => {
    estado.staff = [{ id: 's1', name: 'Plantonista', role: 'reception', shift: 'full', active: true }];
    await render();
    expect(container.textContent).toMatch(/De plantão agora/i);
    expect(container.textContent).toContain('Plantonista');
  });

  it('sem o módulo, a seção não existe', async () => {
    LIGADOS.delete(ARENA_MODULE_ID.OPERATIONS_STAFF);
    LIGADOS.add(ARENA_MODULE_ID.OPERATIONS_CHECKLIST);
    estado.staff = [{ id: 's1', name: 'Ana', role: 'reception', shift: 'full' }];
    await render();
    expect(container.textContent).not.toContain('Ana');
  });
});
