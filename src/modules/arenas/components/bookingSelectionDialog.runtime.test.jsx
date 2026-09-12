/**
 * O passo de CONFIRMAÇÃO da reserva (o diálogo com `selection`).
 *
 * O fluxo antigo re-perguntava tudo o que o calendário já tinha perguntado:
 * data, horário, "qualquer/específicas/todas", "avulso/recorrente". Era o ponto
 * em que reservar ficava confuso.
 *
 * O que estes testes protegem:
 *  1. ⭐ com uma seleção, o diálogo **não re-pergunta** data, quadra nem tipo;
 *  2. ⭐ ele MOSTRA o que foi escolhido, agrupado por quadra;
 *  3. ⭐ várias quadras e horários viram um pedido só, com os grupos certos;
 *  4. "toda semana" repete a escolha e diz quantas reservas vão sair;
 *  5. sem seleção, o formulário completo continua igual — é o caminho do botão
 *     "Solicitar reserva" da página da arena, e ele não pode ter mudado.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const auth = { user: { uid: 'u1' }, userProfile: { platform_name: 'Ana' } };
const criarSelecao = vi.fn(() => Promise.resolve(['b1']));
const criarAntigo = vi.fn(() => Promise.resolve('b1'));

const courts = [
  { id: 'c1', name: 'Quadra 1' },
  { id: 'c2', name: 'Quadra 2' },
];
const schedules = [{
  id: 's1', court_id: null, weekdays: [0, 1, 2, 3, 4, 5, 6],
  start_time: '08:00', end_time: '23:00', is_active: true,
}];

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
vi.mock('../hooks/useBookings.js', () => ({
  useArenaBookings: () => ({ data: [] }),
  useCreateBooking: () => ({ mutateAsync: criarAntigo, isPending: false }),
  useCreateBookingsForSelection: () => ({ mutateAsync: criarSelecao, isPending: false }),
}));
vi.mock('../hooks/useArenas.js', () => ({
  useArenaCourts: () => ({ data: courts }),
  useArenaCourtSchedules: () => ({ data: schedules }),
}));
vi.mock('@/modules/athletes/components/AthleteMultiPicker', () => ({ default: () => <div>CONVIDADOS</div> }));

const { default: BookingRequestDialog } = await import('./BookingRequestDialog.jsx');

const arena = { id: 'a1', name: 'Arena Teste' };
const cel = (court_id, start, date = '2026-10-02') => ({
  court_id, date, start, end: `${String(Number(start.slice(0, 2)) + 1).padStart(2, '0')}:00`,
});

let container, root;

beforeEach(() => {
  criarSelecao.mockClear();
  criarAntigo.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

async function render(props = {}) {
  await act(async () => {
    root.render(
      <BookingRequestDialog arena={arena} open onOpenChange={() => {}} {...props} />,
    );
  });
}

// O diálogo usa portal: procura no documento inteiro.
const texto = () => document.body.textContent;
const botao = (t) => [...document.querySelectorAll('button')]
  .find((b) => b.textContent.trim() === t);
const botaoQueContem = (t) => [...document.querySelectorAll('button')]
  .find((b) => b.textContent.includes(t));

/* ================================================ modo CONFIRMAÇÃO === */

describe('com seleção: confirmar, não re-perguntar', () => {
  const selecao = [cel('c1', '19:00'), cel('c1', '20:00')];

  it('⭐ NÃO pergunta de novo data, quadra nem tipo de reserva', async () => {
    await render({ selection: selecao });
    expect(texto()).not.toContain('Qualquer disponível');
    expect(texto()).not.toContain('Específicas');
    expect(texto()).not.toContain('Dia da semana');
    expect(botao('Avulso')).toBeFalsy();
    expect(botao('Recorrente (semanal)')).toBeFalsy();
    expect(document.querySelector('input[type="date"]')).toBeFalsy();
  });

  it('⭐ MOSTRA o que foi escolhido, agrupado por quadra', async () => {
    await render({ selection: selecao });
    expect(texto()).toContain('Sua escolha');
    expect(texto()).toContain('Quadra 1');
    expect(texto()).toContain('19:00–20:00');
    expect(texto()).toContain('20:00–21:00');
    expect(texto()).toContain('2026-10-02');
  });

  it('o título muda: é confirmação, não formulário', async () => {
    await render({ selection: selecao });
    expect(texto()).toContain('Confirmar reserva');
  });

  it('⭐ envia os grupos certos', async () => {
    await render({ selection: selecao });
    await act(async () => { botao('Solicitar reserva').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(criarSelecao).toHaveBeenCalledTimes(1);
    const { input } = criarSelecao.mock.calls[0][0];
    expect(input.groups).toHaveLength(1);
    expect(input.groups[0].courtIds).toEqual(['c1']);
    expect(input.groups[0].slots.map((s) => s.start)).toEqual(['19:00', '20:00']);
    expect(input.kind).toBe('single');
    // Nunca cai no caminho antigo.
    expect(criarAntigo).not.toHaveBeenCalled();
  });
});

/* ================================================ várias quadras === */

describe('⭐ várias quadras e horários num pedido só', () => {
  it('duas quadras em horários diferentes: dois grupos, duas reservas', async () => {
    await render({ selection: [cel('c1', '19:00'), cel('c2', '20:00')] });
    expect(texto()).toContain('Quadra 1');
    expect(texto()).toContain('Quadra 2');
    expect(texto()).toContain('2 reservas');

    const enviar = botaoQueContem('Solicitar 2 reservas');
    expect(enviar).toBeTruthy();
    await act(async () => { enviar.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const { input } = criarSelecao.mock.calls[0][0];
    expect(input.groups).toHaveLength(2);
  });

  it('duas quadras no MESMO horário: um grupo com as duas', async () => {
    await render({ selection: [cel('c1', '19:00'), cel('c2', '19:00')] });
    await act(async () => {
      botaoQueContem('Solicitar 2 reservas').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const { input } = criarSelecao.mock.calls[0][0];
    expect(input.groups).toHaveLength(1);
    expect(input.groups[0].courtIds.sort()).toEqual(['c1', 'c2']);
  });

  it('com mais de uma reserva, não oferece convidar nem reserva instantânea', async () => {
    await render({ selection: [cel('c1', '19:00'), cel('c2', '20:00')] });
    expect(texto()).not.toContain('CONVIDADOS');
  });

  it('com UMA reserva, oferece convidar', async () => {
    await render({ selection: [cel('c1', '19:00')] });
    expect(texto()).toContain('CONVIDADOS');
  });
});

/* ================================================== recorrência === */

describe('repetir toda semana', () => {
  it('começa em "só neste dia"', async () => {
    await render({ selection: [cel('c1', '19:00')] });
    expect(botao('Só neste dia')).toBeTruthy();
    expect(document.querySelector('input[type="number"]')).toBeFalsy();
  });

  it('⭐ "toda semana" repete a escolha e mostra as datas', async () => {
    await render({ selection: [cel('c1', '19:00')] });
    await act(async () => { botao('Toda semana').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(texto()).toContain('4 datas');
    expect(texto()).toContain('2026-10-23');

    await act(async () => { botao('Solicitar reserva').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const { input } = criarSelecao.mock.calls[0][0];
    expect(input.kind).toBe('recurring');
    expect(input.groups[0].slots).toHaveLength(4);
    // Um horário só: a recorrência é descritível e vai gravada.
    expect(input.recurrence).toMatchObject({ weeks: 4, start: '19:00' });
  });

  it('⭐ com vários horários, não inventa metadado de recorrência', async () => {
    await render({ selection: [cel('c1', '19:00'), cel('c1', '20:00')] });
    await act(async () => { botao('Toda semana').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await act(async () => { botao('Solicitar reserva').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const { input } = criarSelecao.mock.calls[0][0];
    expect(input.kind).toBe('recurring');
    expect(input.recurrence).toBeNull();
    expect(input.groups[0].slots).toHaveLength(8);
  });
});

/* ============================================= o caminho antigo === */

describe('⭐ sem seleção, o formulário completo não mudou', () => {
  it('segue perguntando tipo, quadra e data', async () => {
    await render();
    expect(botao('Avulso')).toBeTruthy();
    expect(botao('Recorrente (semanal)')).toBeTruthy();
    expect(texto()).toContain('Qualquer disponível');
    expect(document.querySelector('input[type="date"]')).toBeTruthy();
    expect(texto()).not.toContain('Sua escolha');
  });
});
