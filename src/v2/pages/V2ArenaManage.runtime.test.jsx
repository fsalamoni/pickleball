/**
 * A Central da arena — abas pela URL e o módulo Membros integrado.
 *
 * O que protege:
 *  1. ⭐ `?aba=` abre a aba certa — e os links antigos `?secao=&aba=` das
 *     outras telas, que caíam sempre em Reservas, funcionam;
 *  2. ⭐ clicar numa aba grava a aba na URL (recarregar não perde o lugar);
 *  3. ⭐ aba de módulo DESLIGADO cai em Reservas, sem tela em branco;
 *  4. ⭐ com Membros ligado, há seção Membros — e a aba Clientes diz quem é
 *     membro e oferece "Tornar membro" a quem reserva sempre;
 *  5. sem Membros, a aba Clientes é a de antes.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { FEATURE_FLAG } from '@/core/featureFlags';

const LIGADOS = new Set();
const estado = { reservas: [], membros: [] };
const incluir = vi.fn(() => Promise.resolve());
const mutacao = () => ({ mutateAsync: vi.fn(), isPending: false });

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'eu' }, isPlatformAdmin: false }),
}));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({
  useFeatureFlag: (k) => k === FEATURE_FLAG.ARENA_MODULES,
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArena: () => ({ data: { id: 'a1', name: 'Arena Teste', owner_id: 'eu' }, isLoading: false }),
  useMyManagedArenas: () => ({ data: [] }),
  useUpdateArena: () => mutacao(),
  useSetArenaPhotos: () => mutacao(),
  useDeleteArena: () => mutacao(),
  useArenaManagers: () => ({ data: [] }),
  useAddManager: () => mutacao(),
  useRemoveManager: () => mutacao(),
  useArenaCourts: () => ({ data: [] }),
  useArenaCourtSchedules: () => ({ data: [] }),
}));
vi.mock('@/modules/arenas/hooks/useBookings', () => ({
  useArenaBookings: () => ({ data: estado.reservas, isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id), isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaMembers: () => ({ data: estado.membros }),
  useAddArenaMember: () => ({ mutateAsync: incluir, isPending: false }),
}));
vi.mock('@/v2/pages/V2ArenaAdminMembers', () => ({
  default: () => null,
  ArenaMembersPanel: ({ view }) => <div>PAINEL MEMBROS {view}</div>,
}));
vi.mock('@/v2/components/arenas/ArenaModulesPanel', () => ({
  default: () => <div>PAINEL MODULOS</div>,
}));

const { default: V2ArenaManage } = await import('./V2ArenaManage.jsx');

function Onde() {
  const loc = useLocation();
  return <div data-testid="onde">{loc.search}</div>;
}

let container, root;

beforeEach(() => {
  LIGADOS.clear();
  incluir.mockClear();
  estado.reservas = [];
  estado.membros = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

async function render(rota) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/arenas/:arenaId/gerir" element={<><V2ArenaManage /><Onde /></>} />
          <Route path="/arenas/:arenaId" element={<div>PÁGINA DA ARENA</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });
  // abas entram por `lazy`
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === texto);
const clicar = async (el) => {
  await act(async () => { el.click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
const onde = () => container.querySelector('[data-testid="onde"]').textContent;

const reserva = (athlete_id, athlete_name, over = {}) => ({
  id: `${athlete_id}-${Math.random()}`, athlete_id, athlete_name, status: 'confirmed', agreed_price: 80,
  slots: [{ date: '2026-09-01', start: '19:00', end: '20:00' }], ...over,
});

describe('abas pela URL', () => {
  it('sem aba na URL, abre Reservas', async () => {
    await render('/arenas/a1/gerir');
    expect(container.textContent).toContain('Nenhuma solicitação de reserva ainda');
  });

  it('⭐ o link antigo "?secao=configuracoes&aba=modulos" abre Módulos', async () => {
    await render('/arenas/a1/gerir?secao=configuracoes&aba=modulos');
    expect(container.textContent).toContain('PAINEL MODULOS');
  });

  it('só a seção também serve: abre a primeira aba dela', async () => {
    await render('/arenas/a1/gerir?secao=configuracoes');
    expect(container.textContent).toContain('PAINEL MODULOS');
  });

  it('⭐ clicar numa aba grava a aba na URL', async () => {
    await render('/arenas/a1/gerir');
    await clicar(botao('Configurações'));
    expect(onde()).toContain('aba=modulos');
    expect(container.textContent).toContain('PAINEL MODULOS');
  });

  it('⭐ aba de módulo desligado cai em Reservas — nunca tela em branco', async () => {
    await render('/arenas/a1/gerir?aba=membros');
    expect(container.textContent).toContain('Nenhuma solicitação de reserva ainda');
    expect(container.textContent).not.toContain('PAINEL MEMBROS');
  });
});

describe('Membros dentro da Central', () => {
  it('⭐ com o módulo, há a seção Membros e a aba abre o painel', async () => {
    LIGADOS.add(ARENA_MODULE_ID.MEMBERS);
    await render('/arenas/a1/gerir?aba=membros');
    expect(botao('Membros')).toBeTruthy();
    expect(container.textContent).toContain('PAINEL MEMBROS membros');
  });

  it('Pacotes de horas é aba da mesma seção, com o módulo de pacotes', async () => {
    LIGADOS.add(ARENA_MODULE_ID.MEMBERS);
    LIGADOS.add(ARENA_MODULE_ID.MEMBERS_PACKAGES);
    await render('/arenas/a1/gerir?aba=planos');
    expect(container.textContent).toContain('PAINEL MEMBROS planos');
  });

  it('⭐ Clientes diz quem é membro e oferece "Tornar membro" a quem reserva sempre', async () => {
    LIGADOS.add(ARENA_MODULE_ID.MEMBERS);
    estado.reservas = [
      reserva('u1', 'Ana Frequente'), reserva('u1', 'Ana Frequente'), reserva('u1', 'Ana Frequente'),
      reserva('u2', 'Bia Membro'),
      reserva(null, 'Seu Zé'), reserva(null, 'Seu Zé'), reserva(null, 'Seu Zé'),
    ];
    estado.membros = [{ user_id: 'u2', points: 600 }];
    await render('/arenas/a1/gerir?aba=clientes');
    const txt = container.textContent;
    expect(txt).toContain('Ouro'); // 600 pontos
    expect(txt).toContain('Frequentes sem ser membro');
    const tornar = botao('Tornar membro');
    expect(tornar).toBeTruthy();
    // o avulso, com as mesmas 3 reservas, não é candidato: não tem conta
    expect([...container.querySelectorAll('button')].filter((b) => b.textContent.includes('Tornar membro'))).toHaveLength(1);
    await clicar(tornar);
    expect(incluir).toHaveBeenCalledWith({ arenaId: 'a1', target: { user_id: 'u1', user_name: 'Ana Frequente' } });
  });

  it('sem o módulo, Clientes é a de antes (sem coluna de membro)', async () => {
    estado.reservas = [reserva('u1', 'Ana'), reserva('u1', 'Ana'), reserva('u1', 'Ana')];
    await render('/arenas/a1/gerir?aba=clientes');
    expect(container.textContent).not.toContain('Tornar membro');
    expect(container.textContent).not.toContain('Frequentes sem ser membro');
  });

  it('a data da última reserva sai em pt-BR', async () => {
    estado.reservas = [reserva('u1', 'Ana')];
    await render('/arenas/a1/gerir?aba=clientes');
    expect(container.textContent).not.toContain('2026-09-01');
    expect(container.textContent).toContain('01/09');
  });
});
