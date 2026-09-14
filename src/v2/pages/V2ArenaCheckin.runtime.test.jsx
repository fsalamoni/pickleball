/**
 * A chegada do atleta.
 *
 * O que estes testes protegem:
 *  1. ⭐ sem o módulo, a rota não existe;
 *  2. ⭐ quem chega pelo QR com UM horário aberto não toca em nada;
 *  3. ⭐ com dois horários abertos, NADA é confirmado sozinho — a pessoa escolhe;
 *  4. ⭐ o código do totem é enviado ao serviço (e o aparelho, quando veio na URL);
 *  5. cedo demais não confirma, e explica quanto falta;
 *  6. sem reserva hoje, a tela diz isso em vez de pedir código.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const LIGADOS = new Set();
const estado = { reservas: [], participo: [] };
const chegar = vi.fn(() => Promise.resolve(true));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'eu' }, isPlatformAdmin: false, isAuthenticated: true }),
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArena: () => ({ data: { id: 'a1', name: 'Arena Teste' }, isLoading: false }),
  useMyManagedArenas: () => ({ data: [] }),
}));
vi.mock('@/modules/arenas/hooks/useBookings', () => ({
  useMyBookings: () => ({ data: estado.reservas, isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useSharedBookings', () => ({
  useMyParticipations: () => ({ data: estado.participo, isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id), isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useCheckin', () => ({
  useCheckInBooking: () => ({ mutateAsync: chegar, isPending: false }),
}));

const { default: V2ArenaCheckin } = await import('./V2ArenaCheckin.jsx');

const p = (n) => String(n).padStart(2, '0');

// RELÓGIO FIXO ao MEIO-DIA. `slotRelativo` monta a HORA a partir de `Date.now()`
// e a DATA sempre como "hoje": com o relógio real, rodar a suíte de noite fazia
// `slotRelativo(+180)` virar 00:18 — uma hora no PASSADO dentro do mesmo dia —,
// e o horário "daqui a três horas" virava um horário vencido. O teste passava
// de manhã e reprovava à noite. Ao meio-dia, ±4h nunca cruzam a virada do dia.
// Só `Date` é falseado: os temporizadores do React continuam reais, senão a
// renderização não avança.
const AGORA = new Date(2026, 5, 15, 12, 0, 0); // 15/06/2026, 12:00 (local)
const HOJE = `${AGORA.getFullYear()}-${p(AGORA.getMonth() + 1)}-${p(AGORA.getDate())}`;

/** Um horário que começa daqui a `emMinutos` (pode ser negativo). */
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
  id: 'b1', arena_id: 'a1', athlete_id: 'eu', status: 'confirmed',
  slots: [slotRelativo(10)], ...over,
});

let container, root;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(AGORA);
  LIGADOS.clear();
  LIGADOS.add(ARENA_MODULE_ID.IOT_QR_KIOSK);
  chegar.mockClear();
  estado.reservas = [];
  estado.participo = [];
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

async function render(rota = '/arenas/a1/chegada') {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/arenas/:arenaId/chegada" element={<V2ArenaCheckin />} />
          <Route path="/arenas/:arenaId" element={<div>PÁGINA DA ARENA</div>} />
          <Route path="/arenas" element={<div>DIRETÓRIO</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

async function clicar(texto) {
  const alvo = [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
  expect(alvo, `botão "${texto}" não encontrado`).toBeTruthy();
  await act(async () => { alvo.click(); });
}

function digitar(id, valor) {
  const campo = container.querySelector(`#${id}`);
  expect(campo, `campo "${id}" não encontrado`).toBeTruthy();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  return act(async () => {
    setter.call(campo, valor);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/* ================================================================ guarda === */

describe('quem entra aqui', () => {
  it('⭐ sem o módulo, volta para a arena', async () => {
    LIGADOS.clear();
    estado.reservas = [reserva()];
    await render();
    expect(container.textContent).toContain('PÁGINA DA ARENA');
  });
});

/* =================================================================== QR === */

describe('quem chega pelo QR', () => {
  it('⭐ com UM horário aberto, a chegada é confirmada sem tocar em nada', async () => {
    estado.reservas = [reserva()];
    await render('/arenas/a1/chegada?d=dev1&c=AB2CD');
    expect(chegar).toHaveBeenCalledTimes(1);
    expect(chegar.mock.calls[0][0]).toMatchObject({ deviceId: 'dev1', code: 'AB2CD' });
    expect(container.textContent).toContain('Chegada confirmada');
  });

  it('⭐ com DOIS horários abertos, não confirma sozinho — pergunta qual', async () => {
    estado.reservas = [
      reserva({ id: 'b1' }),
      reserva({ id: 'b2', slots: [slotRelativo(20)] }),
    ];
    await render('/arenas/a1/chegada?d=dev1&c=AB2CD');
    expect(chegar).not.toHaveBeenCalled();
    expect(container.textContent).toContain('mais de um horário');
  });
});

/* =============================================================== código === */

describe('quem digita o código', () => {
  it('⭐ manda o código ao serviço, sem aparelho quando não veio na URL', async () => {
    estado.reservas = [reserva()];
    await render();
    expect(chegar).not.toHaveBeenCalled();
    await digitar('codigo-totem', 'ab2cd');
    await clicar('Confirmar minha chegada');
    expect(chegar).toHaveBeenCalledTimes(1);
    expect(chegar.mock.calls[0][0].code).toBe('AB2CD');
    expect(chegar.mock.calls[0][0].deviceId).toBeUndefined();
  });

  it('o botão só libera com o código completo', async () => {
    estado.reservas = [reserva()];
    await render();
    const botao = [...container.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Confirmar minha chegada'));
    expect(botao.disabled).toBe(true);
    await digitar('codigo-totem', 'AB2CD');
    const dps = [...container.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Confirmar minha chegada'));
    expect(dps.disabled).toBe(false);
  });
});

/* ================================================================ janela === */

describe('a janela', () => {
  it('cedo demais não confirma, e diz quanto falta', async () => {
    estado.reservas = [reserva({ slots: [slotRelativo(180)] })];
    await render('/arenas/a1/chegada?d=dev1&c=AB2CD');
    expect(chegar).not.toHaveBeenCalled();
    expect(container.textContent).toContain('A chegada abre 1 hora antes');
  });

  it('sem reserva hoje, a tela diz isso em vez de pedir código', async () => {
    await render();
    expect(container.textContent).toContain('Você não tem horário aqui hoje');
    expect(container.querySelector('#codigo-totem')).toBeNull();
  });

  it('quem já chegou vê a confirmação, não o formulário', async () => {
    estado.reservas = [reserva({ checked_in_at: { toMillis: () => Date.now() } })];
    await render();
    expect(container.textContent).toContain('Chegada confirmada');
  });
});

/* ======================================================= compartilhada === */

describe('quem só PARTICIPA da reserva', () => {
  it('⭐ também chega — a consulta do titular sozinha o deixaria de fora', async () => {
    // `useMyBookings` filtra por `athlete_id`. Quem dividiu a quadra com um
    // amigo ouviria "você não tem horário aqui hoje" na porta da arena.
    estado.participo = [reserva({ id: 'compartilhada', athlete_id: 'outro', participant_ids: ['eu'] })];
    await render('/arenas/a1/chegada?d=dev1&c=AB2CD');
    expect(chegar).toHaveBeenCalledTimes(1);
    expect(chegar.mock.calls[0][0].booking.id).toBe('compartilhada');
  });

  it('a mesma reserva nas duas listas não vira duas', async () => {
    const b = reserva();
    estado.reservas = [b];
    estado.participo = [b];
    await render();
    const cartoes = [...container.querySelectorAll('button')]
      .filter((x) => x.textContent.includes('–'));
    expect(cartoes).toHaveLength(1);
  });
});
