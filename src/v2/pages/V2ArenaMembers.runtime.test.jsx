/**
 * "Você nesta arena" — a relação do atleta com a arena.
 *
 * O que estes testes protegem:
 *  1. ⭐ módulo `members` desligado: a rota não existe;
 *  2. ⭐ cada bloco depende do SEU módulo — a arena pode ter membros sem
 *     carteira, ou pacotes sem níveis;
 *  3. ⭐ o nível diz PARA QUE SERVE (o desconto), não só o nome bonito;
 *  4. quanto falta para o próximo nível — o número que faz voltar;
 *  5. ⭐ pacote VENCIDO não conta como hora disponível;
 *  6. o pacote que vence primeiro é o primeiro a ser usado, e isso é dito;
 *  7. falha ao carregar os pacotes não vira "esta arena não vende pacotes".
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const LIGADOS = new Set();
const estado = { member: null, wallet: null, catalogo: [], erro: false, sub: null };

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'eu' }, isAuthenticated: true }),
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArena: () => ({ data: { id: 'a1', name: 'Arena Teste' }, isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id), isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaMember: () => ({ data: estado.member }),
  useArenaWallet: () => ({ data: estado.wallet }),
  useArenaPackages: () => ({ data: estado.catalogo, isError: estado.erro, refetch: vi.fn() }),
  usePurchasePackage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMemberSubscription: () => ({ data: estado.sub }),
}));

const { default: V2ArenaMembers } = await import('./V2ArenaMembers.jsx');

let container, root;
const DIA = 86_400_000;

beforeEach(() => {
  LIGADOS.clear();
  LIGADOS.add(ARENA_MODULE_ID.MEMBERS);
  estado.member = { user_id: 'eu', points: 0, status: 'active' };
  estado.wallet = null;
  estado.catalogo = [];
  estado.erro = false;
  estado.sub = null;
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
      <MemoryRouter initialEntries={['/arenas/a1/membros']}>
        <Routes>
          <Route path="/arenas/:arenaId/membros" element={<V2ArenaMembers />} />
          <Route path="/arenas/:arenaId" element={<div>PÁGINA DA ARENA</div>} />
          <Route path="/arenas" element={<div>DIRETÓRIO</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

/* ================================================================ guarda === */

describe('quem entra aqui', () => {
  it('⭐ sem o módulo de membros, volta para a arena', async () => {
    LIGADOS.clear();
    await render();
    expect(container.textContent).toContain('PÁGINA DA ARENA');
  });

  it('com membros ligado, a página abre', async () => {
    await render();
    expect(container.textContent).toContain('Você nesta arena');
  });
});

/* ================================================================= nível === */

describe('⭐ o nível diz para que serve', () => {
  beforeEach(() => LIGADOS.add(ARENA_MODULE_ID.MEMBERS_TIERS));

  it('mostra o nível, os pontos e o DESCONTO', async () => {
    estado.member = { user_id: 'eu', points: 600, status: 'active' };
    await render();
    expect(container.textContent).toContain('Ouro');
    expect(container.textContent).toContain('600 pontos');
    expect(container.textContent).toContain('10% de desconto');
  });

  it('diz quanto falta para o próximo nível', async () => {
    estado.member = { user_id: 'eu', points: 60, status: 'active' };
    await render();
    expect(container.textContent).toMatch(/Faltam\s*40\s*pontos para Prata/);
  });

  it('no topo, não promete um próximo nível que não existe', async () => {
    estado.member = { user_id: 'eu', points: 99999, status: 'active' };
    await render();
    expect(container.textContent).not.toMatch(/Faltam/);
  });

  it('sem o módulo de níveis, o bloco não existe', async () => {
    LIGADOS.delete(ARENA_MODULE_ID.MEMBERS_TIERS);
    estado.member = { user_id: 'eu', points: 600, status: 'active' };
    await render();
    expect(container.textContent).not.toContain('Seu nível aqui');
  });
});

describe('quem ainda não é membro', () => {
  it('é convidado a falar com a arena, em vez de ver uma tela vazia', async () => {
    estado.member = null;
    await render();
    expect(container.textContent).toMatch(/ainda não é membro/i);
  });
});

/* =============================================================== pacotes === */

describe('minhas horas', () => {
  beforeEach(() => LIGADOS.add(ARENA_MODULE_ID.MEMBERS_PACKAGES));

  it('soma as horas disponíveis', async () => {
    estado.wallet = {
      packages: [
        { pkg_id: 'p1', pkg_name: 'Mensal', total_hours: 10, used_hours: 3, expires_at: Date.now() + 30 * DIA },
      ],
    };
    await render();
    expect(container.textContent).toContain('7h disponíveis');
  });

  it('⭐ pacote VENCIDO não conta como hora disponível', async () => {
    estado.wallet = {
      packages: [
        { pkg_id: 'p1', pkg_name: 'Velho', total_hours: 10, used_hours: 0, expires_at: Date.now() - DIA },
      ],
    };
    await render();
    expect(container.textContent).not.toContain('Suas horas');
  });

  it('⭐ diz qual pacote será usado primeiro', async () => {
    estado.wallet = {
      packages: [
        { pkg_id: 'p2', pkg_name: 'Novo', total_hours: 5, used_hours: 0, expires_at: Date.now() + 60 * DIA },
        { pkg_id: 'p1', pkg_name: 'Antigo', total_hours: 5, used_hours: 0, expires_at: Date.now() + 2 * DIA },
      ],
    };
    await render();
    expect(container.textContent).toContain('é o primeiro a ser usado');
    // O "Antigo" (que vence antes) vem primeiro na lista.
    const texto = container.textContent;
    expect(texto.indexOf('Antigo')).toBeLessThan(texto.indexOf('Novo'));
  });

  it('sem o módulo de pacotes, nem as horas nem a vitrine aparecem', async () => {
    LIGADOS.delete(ARENA_MODULE_ID.MEMBERS_PACKAGES);
    estado.wallet = { packages: [{ pkg_id: 'p1', total_hours: 5, used_hours: 0 }] };
    estado.catalogo = [{ id: 'c1', name: 'Mensal', hours: 10, price: 250, validity_days: 60 }];
    await render();
    expect(container.textContent).not.toContain('Suas horas');
    expect(container.textContent).not.toContain('Pacotes de horas');
  });

  it('⭐ falha ao carregar NÃO vira "esta arena não vende pacotes"', async () => {
    estado.erro = true;
    await render();
    expect(container.textContent).toMatch(/não foi possível carregar os pacotes/i);
    expect(container.textContent).not.toMatch(/ainda não vende pacotes/i);
  });

  it('a vitrine mostra o preço por hora, que é o argumento de venda', async () => {
    estado.catalogo = [{ id: 'c1', name: 'Mensal 10h', hours: 10, price: 250, validity_days: 60 }];
    await render();
    expect(container.textContent).toContain('Mensal 10h');
    expect(container.textContent).toMatch(/25,00\/h/);
  });
});

/* ============================================================== carteira === */

describe('minha carteira', () => {
  beforeEach(() => LIGADOS.add(ARENA_MODULE_ID.MEMBERS_WALLET));

  it('mostra o saldo', async () => {
    estado.wallet = { balance: 42.5, transactions: [] };
    await render();
    expect(container.textContent).toContain('42,50');
  });

  it('mostra o extrato, com crédito e débito distinguidos', async () => {
    estado.wallet = {
      balance: 10,
      transactions: [
        { type: 'credit', amount: 30, source: 'cortesia' },
        { type: 'debit', amount: 20, source: 'reserva x' },
      ],
    };
    await render();
    expect(container.textContent).toContain('cortesia');
    expect(container.textContent).toContain('reserva x');
  });

  it('uso de pacote aparece em HORAS, não em reais', async () => {
    estado.wallet = {
      balance: 0,
      transactions: [{ type: 'package_use', hours: 2, source: 'reserva y' }],
    };
    await render();
    expect(container.textContent).toContain('2h de pacote');
  });

  it('sem o módulo de carteira, o bloco não existe', async () => {
    LIGADOS.delete(ARENA_MODULE_ID.MEMBERS_WALLET);
    estado.wallet = { balance: 42.5, transactions: [] };
    await render();
    expect(container.textContent).not.toContain('Sua carteira');
  });
});

/* =========================================================== mensalidade === */

describe('minha mensalidade', () => {
  beforeEach(() => LIGADOS.add(ARENA_MODULE_ID.MEMBERS_SUBSCRIPTION));

  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  it('em dia: diz o próximo vencimento, sem alarme', async () => {
    estado.sub = {
      plan_name: 'Mensal', price: 200, billing_day: 10, status: 'active',
      started_on: `${mesAtual}-01`, paid_months: [mesAtual],
    };
    await render();
    expect(container.textContent).toContain('Em dia');
    expect(container.textContent).toMatch(/próximo vencimento/i);
  });

  it('⭐ em atraso: diz QUANTOS meses e QUANTO, não só "em atraso"', async () => {
    estado.sub = {
      plan_name: 'Mensal', price: 200, billing_day: 1, status: 'active',
      started_on: '2020-01-01', paid_months: [],
    };
    await render();
    expect(container.textContent).toContain('Em atraso');
    expect(container.textContent).toMatch(/meses em aberto/);
  });

  it('mensalidade encerrada não aparece', async () => {
    estado.sub = { plan_name: 'Mensal', price: 200, billing_day: 10, status: 'cancelled' };
    await render();
    expect(container.textContent).not.toContain('Sua mensalidade');
  });

  it('sem o módulo, o bloco não existe', async () => {
    LIGADOS.delete(ARENA_MODULE_ID.MEMBERS_SUBSCRIPTION);
    estado.sub = {
      plan_name: 'Mensal', price: 200, billing_day: 10, status: 'active',
      started_on: `${mesAtual}-01`, paid_months: [mesAtual],
    };
    await render();
    expect(container.textContent).not.toContain('Sua mensalidade');
  });
});
