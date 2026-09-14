/**
 * O totem de chegada da arena.
 *
 * O que estes testes protegem:
 *  1. ⭐ sem o módulo (ou sem gerir a arena), a tela não abre;
 *  2. ⭐ o código é gerado ao ligar a tela e aparece grande;
 *  3. ⭐ ao fechar a tela, o código MORRE (senão vale de casa);
 *  4. ⭐ a tela cumprimenta só o ÚLTIMO que chegou, e pelo primeiro nome;
 *  5. ⭐ chegada antiga não fica cumprimentando a sala a tarde toda;
 *  6. sem totem cadastrado, um clique resolve;
 *  7. a tela sai com a marca da arena.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const LIGADOS = new Set();
const estado = { gere: true, devices: [], reservas: [], branding: null };
const girar = vi.fn(() => Promise.resolve({ code: 'AB2CD' }));
const desligar = vi.fn();
const criarDispositivo = vi.fn(() => Promise.resolve('dev1'));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('qrcode', () => ({ default: { toDataURL: () => Promise.resolve('data:image/png;base64,QR') } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'eu' }, isPlatformAdmin: false, isAuthenticated: true }),
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArena: () => ({
    data: {
      id: 'a1', name: 'Arena Teste',
      owner_id: estado.gere ? 'eu' : 'outro',
      branding: estado.branding,
    },
    isLoading: false,
  }),
  useMyManagedArenas: () => ({ data: [] }),
}));
vi.mock('@/modules/arenas/hooks/useBookings', () => ({
  useArenaBookings: () => ({ data: estado.reservas, isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id), isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaDevices: () => ({ data: estado.devices, isLoading: false }),
  useCreateDevice: () => ({ mutateAsync: criarDispositivo, isPending: false }),
}));
vi.mock('@/modules/arenas/hooks/useCheckin', () => ({
  useRotateKioskToken: () => ({ mutateAsync: girar, isPending: false }),
  useMarkKioskOffline: () => ({ mutate: desligar, isPending: false }),
}));

const { default: V2ArenaKiosk } = await import('./V2ArenaKiosk.jsx');

const p = (n) => String(n).padStart(2, '0');
const HOJE = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

const chegada = (nome, haMs, over = {}) => ({
  id: `b-${nome}`, arena_id: 'a1', athlete_name: nome, status: 'confirmed',
  slots: [{ date: HOJE, start: '19:00', end: '20:00' }],
  checked_in_by: 'athlete',
  checked_in_at: { toMillis: () => Date.now() - haMs },
  ...over,
});

let container, root;

beforeEach(() => {
  LIGADOS.clear();
  LIGADOS.add(ARENA_MODULE_ID.IOT_QR_KIOSK);
  girar.mockClear(); desligar.mockClear(); criarDispositivo.mockClear();
  Object.assign(estado, {
    gere: true,
    devices: [{ id: 'dev1', arena_id: 'a1', kind: 'qr_kiosk', name: 'Totem' }],
    reservas: [],
    branding: null,
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  container.remove();
  document.body.innerHTML = '';
});

async function render() {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/arenas/a1/totem']}>
        <Routes>
          <Route path="/arenas/:arenaId/totem" element={<V2ArenaKiosk />} />
          <Route path="/arenas/:arenaId" element={<div>PÁGINA DA ARENA</div>} />
          <Route path="/arenas" element={<div>DIRETÓRIO</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

/* ================================================================ guarda === */

describe('quem liga o totem', () => {
  it('⭐ sem o módulo, a tela não abre', async () => {
    LIGADOS.clear();
    await render();
    expect(container.textContent).toContain('PÁGINA DA ARENA');
    await act(async () => root.unmount());
  });

  it('⭐ quem não gere a arena não liga totem nenhum', async () => {
    estado.gere = false;
    await render();
    expect(container.textContent).toContain('PÁGINA DA ARENA');
    await act(async () => root.unmount());
  });
});

/* ================================================================ código === */

describe('o código', () => {
  it('⭐ é gerado ao ligar a tela e aparece grande', async () => {
    await render();
    expect(girar).toHaveBeenCalledWith({ deviceId: 'dev1' });
    expect(container.textContent).toContain('AB2CD');
    expect(container.textContent).toContain('Aponte a câmera');
    await act(async () => root.unmount());
  });

  it('⭐ MORRE quando a tela é fechada', async () => {
    await render();
    expect(desligar).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    expect(desligar).toHaveBeenCalledWith({ deviceId: 'dev1' });
  });
});

/* ============================================================= saudação === */

describe('o cumprimento', () => {
  it('⭐ é do ÚLTIMO que chegou, e pelo primeiro nome', async () => {
    estado.reservas = [chegada('Ana Souza', 15_000), chegada('Bruno Lima', 2_000)];
    await render();
    expect(container.textContent).toContain('Bem-vindo, Bruno!');
    expect(container.textContent).not.toContain('Ana');
    await act(async () => root.unmount());
  });

  it('⭐ some depois de pouco tempo — a tela não é uma lista de presença', async () => {
    estado.reservas = [chegada('Ana Souza', 120_000)];
    await render();
    expect(container.textContent).not.toContain('Bem-vindo');
    await act(async () => root.unmount());
  });

  it('não cumprimenta quem a recepção confirmou (essa pessoa está no balcão)', async () => {
    estado.reservas = [chegada('Ana Souza', 2_000, { checked_in_by: 'arena' })];
    await render();
    expect(container.textContent).not.toContain('Bem-vindo');
    await act(async () => root.unmount());
  });
});

/* ============================================================ sem totem === */

describe('arena sem totem cadastrado', () => {
  it('oferece criar num clique, em vez de mandar cadastrar equipamento', async () => {
    estado.devices = [];
    await render();
    expect(container.textContent).toContain('Nenhum totem cadastrado');
    const botao = [...container.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Criar o totem'));
    await act(async () => { botao.click(); });
    expect(criarDispositivo).toHaveBeenCalledTimes(1);
    expect(criarDispositivo.mock.calls[0][0].input.kind).toBe('qr_kiosk');
    await act(async () => root.unmount());
  });

  it('dispositivo de outro tipo não vira totem', async () => {
    estado.devices = [{ id: 'l1', arena_id: 'a1', kind: 'lighting', name: 'Luz' }];
    await render();
    expect(container.textContent).toContain('Nenhum totem cadastrado');
    await act(async () => root.unmount());
  });
});

/* ================================================================ marca === */

describe('a marca da arena', () => {
  it('⭐ pinta a tela mais vista pelo cliente', async () => {
    estado.branding = { enabled: true, primary_color: '#0044CC', tagline: 'Jogue mais' };
    await render();
    const raiz = container.firstElementChild;
    expect(raiz.style.backgroundColor).toBe('rgb(0, 68, 204)');
    expect(container.textContent).toContain('Jogue mais');
    await act(async () => root.unmount());
  });

  it('sem marca, o fundo é o da plataforma', async () => {
    await render();
    const raiz = container.firstElementChild;
    expect(raiz.style.backgroundColor).toBe('rgb(11, 11, 11)');
    await act(async () => root.unmount());
  });
});
