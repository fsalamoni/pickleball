/**
 * A presença do dia, do lado da arena.
 *
 * O que estes testes protegem:
 *  1. ⭐ sem o módulo (ou sem gerir a arena), a rota não existe;
 *  2. ⭐ a falta só é afirmada depois que a janela FECHA;
 *  3. ⭐ marcar as faltas do dia é UM toque, sobre quem o sistema já sabe;
 *  4. ⭐ a taxa sai sobre o que foi decidido, não sobre o dia inteiro;
 *  5. a arena confirma e desfaz a chegada de alguém;
 *  6. presença pelo totem é distinguida da confirmada na recepção.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const LIGADOS = new Set();
const estado = { gere: true, reservas: [] };
const confirmar = vi.fn(() => Promise.resolve());
const desfazer = vi.fn(() => Promise.resolve());
const emLote = vi.fn(() => Promise.resolve(2));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'eu' }, isPlatformAdmin: false, isAuthenticated: true }),
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArena: () => ({
    data: { id: 'a1', name: 'Arena Teste', owner_id: estado.gere ? 'eu' : 'outro' },
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
vi.mock('@/modules/arenas/hooks/useCheckin', () => ({
  useConfirmArrival: () => ({ mutateAsync: confirmar, isPending: false }),
  useUndoArrival: () => ({ mutateAsync: desfazer, isPending: false }),
  useMarkNoShowBatch: () => ({ mutateAsync: emLote, isPending: false }),
}));

const { default: V2ArenaAttendance } = await import('./V2ArenaAttendance.jsx');

const p = (n) => String(n).padStart(2, '0');

// RELÓGIO FIXO ao MEIO-DIA. `slotRelativo` monta a hora a partir de `Date.now()`
// mas a DATA sempre como "hoje": com o relógio real, rodar a suíte de noite
// fazia `slotRelativo(+200)` virar 00:10 — uma hora no PASSADO dentro do mesmo
// dia —, e a reserva "que ainda vai acontecer" entrava na conta das decididas.
// O teste passava de manhã e reprovava à noite. Ao meio-dia, ±4h nunca cruzam
// a virada do dia. Só `Date` é falseado: os temporizadores do React continuam
// reais, senão a renderização não avança.
const AGORA = new Date(2026, 5, 15, 12, 0, 0); // 15/06/2026, 12:00 (local)
const HOJE = `${AGORA.getFullYear()}-${p(AGORA.getMonth() + 1)}-${p(AGORA.getDate())}`;

function slotRelativo(emMinutos, duracaoMin = 60) {
  const ini = new Date(Date.now() + emMinutos * 60_000);
  const fim = new Date(ini.getTime() + duracaoMin * 60_000);
  return {
    date: HOJE,
    start: `${p(ini.getHours())}:${p(ini.getMinutes())}`,
    end: `${p(fim.getHours())}:${p(fim.getMinutes())}`,
  };
}

const reserva = (over = {}) => ({
  id: 'b1', arena_id: 'a1', athlete_id: 'u1', athlete_name: 'Ana Souza',
  status: 'confirmed', slots: [slotRelativo(10)], ...over,
});

let container, root;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(AGORA);
  LIGADOS.clear();
  LIGADOS.add(ARENA_MODULE_ID.IOT_QR_KIOSK);
  confirmar.mockClear(); desfazer.mockClear(); emLote.mockClear();
  Object.assign(estado, { gere: true, reservas: [] });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

async function render() {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/arenas/a1/gerir/presenca']}>
        <Routes>
          <Route path="/arenas/:arenaId/gerir/presenca" element={<V2ArenaAttendance />} />
          <Route path="/arenas/:arenaId" element={<div>PÁGINA DA ARENA</div>} />
          <Route path="/arenas" element={<div>DIRETÓRIO</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

/** Procura no documento inteiro: o diálogo de confirmação sai em portal. */
async function clicar(texto, escopo = container) {
  const alvo = [...escopo.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
  expect(alvo, `botão "${texto}" não encontrado`).toBeTruthy();
  await act(async () => { alvo.click(); });
}

/* ================================================================ guarda === */

describe('quem entra aqui', () => {
  it('⭐ sem o módulo, volta para a arena', async () => {
    LIGADOS.clear();
    await render();
    expect(container.textContent).toContain('PÁGINA DA ARENA');
  });

  it('⭐ quem não gere a arena, volta para a arena', async () => {
    estado.gere = false;
    await render();
    expect(container.textContent).toContain('PÁGINA DA ARENA');
  });

  it('com o módulo, o painel abre', async () => {
    await render();
    expect(container.textContent).toContain('Presença');
    expect(container.textContent).toContain('Arena Teste');
  });
});

/* ============================================================== a janela === */

describe('a falta', () => {
  it('⭐ não é afirmada enquanto a janela está aberta', async () => {
    estado.reservas = [reserva()];
    await render();
    expect(container.textContent).toContain('Aguardando');
    expect(container.textContent).not.toContain('Não veio');
  });

  it('⭐ é afirmada depois que a janela fecha', async () => {
    // Começou há 3 horas: acabou há 2, muito além dos 30 minutos de tolerância.
    estado.reservas = [reserva({ slots: [slotRelativo(-180)] })];
    await render();
    expect(container.textContent).toContain('Não veio');
  });

  it('⭐ marcar as faltas do dia é UM toque', async () => {
    estado.reservas = [
      reserva({ id: 'b1', slots: [slotRelativo(-180)] }),
      reserva({ id: 'b2', slots: [slotRelativo(-240)] }),
    ];
    await render();
    expect(container.textContent).toContain('horários passaram sem ninguém confirmar chegada');
    await clicar('Marcar 2 como falta');
    await clicar('Marcar faltas', document.body);
    expect(emLote).toHaveBeenCalledTimes(1);
    expect(emLote.mock.calls[0][0].bookings.map((b) => b.id)).toEqual(['b2', 'b1']);
  });

  it('não oferece o lote quando não há nada pendente', async () => {
    estado.reservas = [reserva()];
    await render();
    expect(container.textContent).not.toContain('como falta');
  });

  it('quem a arena JÁ marcou não volta para a fila do lote', async () => {
    estado.reservas = [reserva({ slots: [slotRelativo(-180)], no_show: true })];
    await render();
    expect(container.textContent).toContain('Não veio');
    expect(container.textContent).not.toContain('como falta');
  });
});

/* ================================================================= taxa === */

describe('os números do topo', () => {
  it('⭐ a taxa sai sobre o que foi DECIDIDO, não sobre o dia inteiro', async () => {
    estado.reservas = [
      reserva({ id: 'veio', checked_in_at: { toMillis: () => Date.now() } }),
      reserva({ id: 'faltou', slots: [slotRelativo(-180)] }),
      reserva({ id: 'porVir', slots: [slotRelativo(200)] }),
    ];
    await render();
    // 1 falta em 2 decididas = 50%, e não 33% (que contaria a que ainda vem).
    expect(container.textContent).toContain('50%');
  });
});

/* =============================================================== ações === */

describe('a recepção', () => {
  it('confirma a chegada de alguém', async () => {
    estado.reservas = [reserva()];
    await render();
    await clicar('Chegou');
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(confirmar.mock.calls[0][0].booking.id).toBe('b1');
  });

  it('desfaz uma chegada marcada por engano', async () => {
    estado.reservas = [reserva({ checked_in_at: { toMillis: () => Date.now() } })];
    await render();
    await clicar('Desfazer');
    expect(desfazer).toHaveBeenCalledTimes(1);
  });

  it('distingue quem veio pelo totem de quem foi confirmado no balcão', async () => {
    estado.reservas = [reserva({ checked_in_at: {}, checked_in_by: 'athlete' })];
    await render();
    expect(container.textContent).toContain('pelo totem');

    await act(async () => root.unmount());
    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    estado.reservas = [reserva({ checked_in_at: {}, checked_in_by: 'arena' })];
    await render();
    expect(container.textContent).toContain('confirmado na recepção');
  });
});
