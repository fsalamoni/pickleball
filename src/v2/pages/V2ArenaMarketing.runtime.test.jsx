/**
 * O console de marketing da arena.
 *
 * O que estes testes protegem:
 *  1. ⭐ quem não gere a arena não entra — é a mesa dela, não uma tela pública;
 *  2. ⭐ cada ferramenta depende do SEU módulo (cupom sem campanha, e vice-versa);
 *  3. ⭐ a campanha diz PARA QUANTAS PESSOAS vai antes de enviar;
 *  4. ⭐ público vazio não deixa enviar — mensagem para ninguém é bug, não ação;
 *  5. o cupom desligado continua na lista, para poder ser religado;
 *  6. ⭐ o NPS mostra os COMENTÁRIOS, que são a parte acionável da nota;
 *  7. falha ao carregar cupom não vira "esta arena não tem cupons".
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const LIGADOS = new Set();
const estado = {
  gere: true,
  cupons: [],
  cuponsErro: false,
  campanhas: [],
  membros: [],
  reservas: [],
  nps: { nps: 40, count: 5 },
  respostas: [],
};

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'eu' }, isPlatformAdmin: false, isAuthenticated: true }),
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArena: () => ({ data: { id: 'a1', name: 'Arena Teste', owner_id: estado.gere ? 'eu' : 'outro' }, isLoading: false }),
  useMyManagedArenas: () => ({ data: [] }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id), isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useBookings', () => ({
  useArenaBookings: () => ({ data: estado.reservas }),
}));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({
  useAthletes: () => ({ data: [] }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaCouponsAll: () => ({
    data: estado.cupons, isLoading: false, isError: estado.cuponsErro, refetch: vi.fn(),
  }),
  useCreateCoupon: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateCoupon: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetCouponActive: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteCoupon: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArenaCampaigns: () => ({ data: estado.campanhas }),
  useSendCampaign: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArenaNps: () => ({ data: estado.nps }),
  useArenaNpsResponses: () => ({ data: estado.respostas, isLoading: false }),
  useArenaMembers: () => ({ data: estado.membros }),
  useRedeemReferral: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const { default: V2ArenaMarketing } = await import('./V2ArenaMarketing.jsx');

let container, root;

beforeEach(() => {
  LIGADOS.clear();
  LIGADOS.add(ARENA_MODULE_ID.MARKETING);
  Object.assign(estado, {
    gere: true, cupons: [], cuponsErro: false, campanhas: [], membros: [],
    reservas: [], nps: { nps: 40, count: 5 }, respostas: [],
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
      <MemoryRouter initialEntries={['/arenas/a1/gerir/marketing']}>
        <Routes>
          <Route path="/arenas/:arenaId/gerir/marketing" element={<V2ArenaMarketing />} />
          <Route path="/arenas/:arenaId" element={<div>PÁGINA DA ARENA</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

/** Clica no botão cujo texto contém `texto`. */
async function clicar(texto) {
  const alvo = [...container.querySelectorAll('button')]
    .find((b) => b.textContent.includes(texto));
  expect(alvo, `botão "${texto}" não encontrado`).toBeTruthy();
  await act(async () => { alvo.click(); });
}

/* ================================================================ guarda === */

describe('quem entra aqui', () => {
  it('⭐ quem não gere a arena volta para a página dela', async () => {
    estado.gere = false;
    await render();
    expect(container.textContent).toContain('PÁGINA DA ARENA');
  });

  it('⭐ sem o módulo de marketing, a rota não existe', async () => {
    LIGADOS.clear();
    await render();
    expect(container.textContent).toContain('PÁGINA DA ARENA');
  });

  it('com o módulo ligado, a página abre', async () => {
    await render();
    expect(container.textContent).toContain('Marketing e fidelidade');
  });

  it('módulo pai ligado e nenhuma ferramenta: diz o que fazer', async () => {
    await render();
    expect(container.textContent).toMatch(/Nenhuma ferramenta de marketing ativa/i);
  });
});

/* ================================================================ cupons === */

describe('cupons', () => {
  beforeEach(() => LIGADOS.add(ARENA_MODULE_ID.MARKETING_COUPONS));

  it('sem cupom, convida a criar o primeiro em vez de mostrar vazio', async () => {
    await render();
    expect(container.textContent).toMatch(/Nenhum cupom ainda/i);
  });

  it('mostra o cupom com o desconto legível e a contagem de usos', async () => {
    estado.cupons = [{ id: 'c1', code: 'VERAO10', type: 'percent', value: 10, used_count: 3, active: true }];
    await render();
    expect(container.textContent).toContain('VERAO10');
    expect(container.textContent).toContain('10%');
    expect(container.textContent).toContain('3');
  });

  it('⭐ cupom DESLIGADO continua na lista, com o botão de religar', async () => {
    estado.cupons = [{ id: 'c1', code: 'ANTIGO', type: 'percent', value: 10, active: false }];
    await render();
    expect(container.textContent).toContain('ANTIGO');
    expect(container.textContent).toContain('Desligado');
    expect(container.textContent).toContain('Religar');
  });

  it('⭐ cupom esgotado é dito, não some', async () => {
    estado.cupons = [{ id: 'c1', code: 'CHEIO', type: 'percent', value: 10, max_uses: 5, used_count: 5, active: true }];
    await render();
    expect(container.textContent).toContain('Esgotado');
  });

  it('⭐ falha ao carregar NÃO vira "esta arena não tem cupons"', async () => {
    estado.cuponsErro = true;
    await render();
    expect(container.textContent).toMatch(/não foi possível carregar os cupons/i);
    expect(container.textContent).not.toMatch(/Nenhum cupom ainda/i);
  });

  it('sem o módulo de cupons, a seção não existe', async () => {
    LIGADOS.delete(ARENA_MODULE_ID.MARKETING_COUPONS);
    LIGADOS.add(ARENA_MODULE_ID.MARKETING_NPS);
    estado.cupons = [{ id: 'c1', code: 'VERAO10', type: 'percent', value: 10, active: true }];
    await render();
    expect(container.textContent).not.toContain('VERAO10');
  });
});

/* ============================================================= campanhas === */

describe('campanhas', () => {
  beforeEach(() => {
    LIGADOS.add(ARENA_MODULE_ID.MARKETING_CAMPAIGNS);
    estado.membros = [{ user_id: 'u1' }, { user_id: 'u2' }];
    estado.reservas = [
      { athlete_id: 'u3', status: 'completed', slots: [{ date: '2026-09-10' }] },
    ];
  });

  it('⭐ diz para QUANTAS pessoas cada público vai, antes de enviar', async () => {
    await render();
    await clicar('Nova campanha');
    // Membros = 2; todo mundo = 3 (dois membros + um que já reservou).
    expect(container.textContent).toMatch(/Membros/);
    expect(container.textContent).toMatch(/2 pessoas/);
    expect(container.textContent).toMatch(/3 pessoas/);
  });

  it('⭐ público vazio avisa em vez de deixar enviar para ninguém', async () => {
    estado.membros = [];
    estado.reservas = [];
    await render();
    await clicar('Nova campanha');
    expect(container.textContent).toMatch(/Ninguém neste público ainda/i);
    const enviar = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Enviar');
    expect(enviar?.disabled).toBe(true);
  });

  it('lista a campanha já enviada com quantas pessoas receberam', async () => {
    estado.campanhas = [{ id: 'k1', name: 'Quinta barata', status: 'sent', sent_count: 12, target_audience: 'all' }];
    await render();
    expect(container.textContent).toContain('Quinta barata');
    expect(container.textContent).toContain('12 pessoas');
    expect(container.textContent).toContain('Enviada');
  });
});

/* =================================================================== NPS === */

describe('satisfação', () => {
  beforeEach(() => LIGADOS.add(ARENA_MODULE_ID.MARKETING_NPS));

  it('sem resposta, explica quando a pergunta aparece', async () => {
    estado.respostas = [];
    await render();
    expect(container.textContent).toMatch(/Ninguém respondeu ainda/i);
  });

  it('⭐ mostra os COMENTÁRIOS, não só a nota', async () => {
    estado.respostas = [
      { id: 'r1', score: 10, comment: 'Quadra impecável', created_at: Date.now() },
      { id: 'r2', score: 3, comment: 'Vestiário sujo', created_at: Date.now() },
    ];
    estado.nps = { nps: 0, count: 2 };
    await render();
    expect(container.textContent).toContain('Quadra impecável');
    expect(container.textContent).toContain('Vestiário sujo');
    expect(container.textContent).toContain('Promotor');
    expect(container.textContent).toContain('Detrator');
  });

  it('nota sem comentário não finge que há texto', async () => {
    estado.respostas = [{ id: 'r1', score: 9, comment: '', created_at: Date.now() }];
    estado.nps = { nps: 100, count: 1 };
    await render();
    expect(container.textContent).toMatch(/vieram sem comentário/i);
  });
});
