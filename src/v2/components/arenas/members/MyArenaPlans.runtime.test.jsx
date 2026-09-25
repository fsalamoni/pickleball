/**
 * "Planos e saldo nas arenas", em Minhas reservas.
 *
 * O que protege:
 *  1. ⭐ uma linha por arena: horas (com o vencimento mais próximo), saldo,
 *     nível e mensalidade — levando ao "meu plano" daquela arena;
 *  2. ⭐ falha de leitura vira aviso, nunca "some" (quem tem horas pagas
 *     concluiria que elas sumiram);
 *  3. ⭐ arena com o programa de membros desligado: a linha some (as horas não
 *     seriam abatidas lá);
 *  4. sem carteira ligada, não se fala em saldo; mensalidade atrasada aparece;
 *  5. nada para mostrar: a seção não existe.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const TODOS = [
  ARENA_MODULE_ID.MEMBERS, ARENA_MODULE_ID.MEMBERS_PACKAGES, ARENA_MODULE_ID.MEMBERS_WALLET,
  ARENA_MODULE_ID.MEMBERS_TIERS, ARENA_MODULE_ID.MEMBERS_SUBSCRIPTION,
];
const estado = { consulta: null, modulos: {}, arenas: {} };

vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({ useMyArenaPlans: () => estado.consulta }));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({ useArena: (id) => ({ data: estado.arenas[id] }) }));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: (id) => ({ isOn: (m) => (estado.modulos[id] || new Set()).has(m) }),
}));
vi.mock('@/modules/arenas/hooks/useArenaPrefetch', () => ({ useArenaPrefetch: () => () => {} }));

const { default: MyArenaPlans } = await import('./MyArenaPlans.jsx');

const hoje = new Date();
const EM_DIAS = (n) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + n, 12).getTime();
const ok = (data) => ({ data, isLoading: false, isError: false, refetch: vi.fn() });
const plano = (over = {}) => ({
  arenaId: 'a1', member: { points: 0 }, wallet: null, subscription: null,
  hours: 0, balance: 0, nextExpiry: null, ...over,
});

let container, root;
beforeEach(() => {
  estado.modulos = { a1: new Set(TODOS), a2: new Set(TODOS) };
  estado.arenas = { a1: { id: 'a1', name: 'Arena Norte' }, a2: { id: 'a2', name: 'Arena Sul' } };
  estado.consulta = ok([]);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render() {
  await act(async () => { root.render(<MemoryRouter><MyArenaPlans /></MemoryRouter>); });
}
const texto = () => container.textContent.replace(/\u00a0/g, ' ');

describe('Planos e saldo nas arenas', () => {
  it('⭐ uma linha por arena, com horas, vencimento, saldo e o caminho para o plano', async () => {
    estado.consulta = ok([
      plano({ hours: 6, balance: 15, nextExpiry: EM_DIAS(5) }),
      plano({ arenaId: 'a2', member: null, balance: 40 }),
    ]);
    await render();
    expect(texto()).toContain('Planos e saldo nas arenas');
    expect(texto()).toContain('Arena Norte');
    expect(texto()).toMatch(/6h de pacote · a primeira vence .+ · R\$ 15,00 de saldo/);
    expect(texto()).toContain('Arena Sul');
    expect(texto()).toContain('R$ 40,00 de saldo');
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/arenas/a1/membros', '/arenas/a2/membros']);
  });

  it('⭐ falha de leitura vira aviso, com tentar de novo', async () => {
    estado.consulta = { data: undefined, isLoading: false, isError: true, refetch: vi.fn() };
    await render();
    expect(texto()).toContain('Não foi possível carregar os seus planos nas arenas');
    expect(texto()).toContain('Tentar de novo');
  });

  it('⭐ arena com o programa de membros desligado: a linha some', async () => {
    estado.modulos.a2 = new Set();
    estado.consulta = ok([plano({ hours: 2 }), plano({ arenaId: 'a2', hours: 8 })]);
    await render();
    expect(texto()).toContain('Arena Norte');
    expect(texto()).not.toContain('Arena Sul');
  });

  it('sem carteira ligada, não se fala em saldo', async () => {
    estado.modulos.a1 = new Set([ARENA_MODULE_ID.MEMBERS]);
    estado.consulta = ok([plano({ balance: 99 })]);
    await render();
    expect(container.querySelector('li').textContent).not.toMatch(/de saldo/);
    expect(texto()).toContain('Você é membro');
  });

  it('mensalidade atrasada aparece', async () => {
    estado.consulta = ok([plano({
      subscription: { status: 'active', started_on: '2020-01-01', billing_day: 1, paid_months: [] },
    })]);
    await render();
    expect(texto()).toContain('Mensalidade em atraso');
  });

  it('nada para mostrar (ou ainda carregando): a seção não existe', async () => {
    await render();
    expect(container.innerHTML).toBe('');
    estado.consulta = { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
    await render();
    expect(container.innerHTML).toBe('');
  });
});
