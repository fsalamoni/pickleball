/**
 * A grade QUADRA × HORÁRIO do atleta.
 *
 * O que estes testes protegem:
 *  1. ⭐ só o que está LIVRE é clicável — e o que está ocupado continua
 *     visível, porque ver a forma do dia é meio caminho para escolher outro;
 *  2. ⭐ clicar ESCOLHE a quadra (era a pergunta sem resposta: "2/3 quadras
 *     livres" não diz quais);
 *  3. ⭐ uma reserva, uma quadra: escolher noutra recomeça a seleção;
 *  4. a grade respeita janela por quadra, janela geral da arena e o dia da
 *     semana — é o que decide quais células existem;
 *  5. ⭐ não mostra nome de ninguém: para reservar basta saber que está
 *     ocupado.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { default: CourtTimePicker } = await import('./CourtTimePicker.jsx');

let container, root;
const onPick = vi.fn();

// 2026-10-02 é uma SEXTA (weekday 5).
const DATA = '2026-10-02';
const SEXTA = 5;

const quadras = [
  { id: 'c1', name: 'Quadra 1' },
  { id: 'c2', name: 'Quadra 2' },
];
const janela = (over = {}) => ({
  id: 's', court_id: null, weekdays: [SEXTA],
  start_time: '18:00', end_time: '21:00', is_active: true, ...over,
});

beforeEach(() => {
  onPick.mockClear();
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
      <CourtTimePicker
        date={DATA}
        courts={quadras}
        schedules={[janela()]}
        bookings={[]}
        unavailabilities={[]}
        selectedSlots={[]}
        onPick={onPick}
        {...props}
      />,
    );
  });
}

const celulas = () => [...container.querySelectorAll('tbody button')];
const celula = (time, courtIdx) => {
  const linha = [...container.querySelectorAll('tbody tr')]
    .find((tr) => tr.querySelector('th')?.textContent.trim() === time);
  return linha ? [...linha.querySelectorAll('button')][courtIdx] : null;
};

/* ============================================================== a grade === */

describe('a grade', () => {
  it('tem uma linha por horário e uma coluna por quadra', async () => {
    await render();
    expect([...container.querySelectorAll('tbody tr')]).toHaveLength(3); // 18, 19, 20
    expect(celulas()).toHaveLength(6);
    expect(container.textContent).toContain('Quadra 1');
    expect(container.textContent).toContain('Quadra 2');
  });

  it('⭐ respeita o dia da semana da janela', async () => {
    await render({ schedules: [janela({ weekdays: [1] })] }); // só segunda
    expect(container.innerHTML).toBe('');
  });

  it('janela por quadra abre só aquela quadra', async () => {
    await render({ schedules: [janela({ court_id: 'c1' })] });
    expect(celula('18:00', 0).textContent).toContain('livre');
    // A quadra 2 não tem janela: fechada, e não clicável.
    expect(celula('18:00', 1).disabled).toBe(true);
  });

  it('quadra inativa não vira coluna', async () => {
    await render({ courts: [...quadras, { id: 'c3', name: 'Reforma', is_active: false }] });
    expect(container.textContent).not.toContain('Reforma');
  });

  it('sem quadra ou sem horário, não renderiza nada', async () => {
    await render({ courts: [] });
    expect(container.innerHTML).toBe('');
    await render({ schedules: [] });
    expect(container.innerHTML).toBe('');
  });
});

/* ============================================================ ocupação === */

describe('o que está ocupado', () => {
  const reserva = {
    id: 'b1', status: 'confirmed', court_id: 'c1', athlete_name: 'Fulano de Tal',
    slots: [{ date: DATA, start: '19:00', end: '20:00' }],
  };

  it('⭐ célula ocupada aparece, mas não é clicável', async () => {
    await render({ bookings: [reserva] });
    const ocupada = celula('19:00', 0);
    expect(ocupada.disabled).toBe(true);
    expect(ocupada.textContent).toContain('ocupado');
    // ...e a mesma hora na outra quadra segue livre.
    expect(celula('19:00', 1).disabled).toBe(false);
  });

  it('⭐ NÃO mostra o nome de quem reservou', async () => {
    await render({ bookings: [reserva] });
    expect(container.textContent).not.toContain('Fulano');
    expect(container.innerHTML).not.toContain('Fulano');
  });

  it('bloqueio da arena aparece como indisponível', async () => {
    await render({
      unavailabilities: [{ id: 'u1', court_id: 'c2', date: DATA, start_time: '20:00', end_time: '21:00' }],
    });
    const bloqueada = celula('20:00', 1);
    expect(bloqueada.disabled).toBe(true);
    expect(bloqueada.textContent).toContain('indisp');
  });

  it('bloqueio sem quadra vale para todas', async () => {
    await render({
      unavailabilities: [{ id: 'u1', court_id: null, date: DATA, start_time: '18:00', end_time: '19:00' }],
    });
    expect(celula('18:00', 0).disabled).toBe(true);
    expect(celula('18:00', 1).disabled).toBe(true);
  });
});

/* ============================================================= escolha === */

describe('escolher quadra e horário', () => {
  it('⭐ clicar avisa a QUADRA, o horário e o fim', async () => {
    await render();
    await act(async () => {
      celula('19:00', 1).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0]).toEqual(['c2', '19:00', '20:00']);
  });

  it('⭐ o fim respeita o fechamento da janela', async () => {
    // Janela até 20:30: o slot das 20:00 acaba às 20:30, não às 21:00.
    await render({ schedules: [janela({ end_time: '20:30' })] });
    await act(async () => {
      celula('20:00', 0).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onPick.mock.calls[0][2]).toBe('20:30');
  });

  it('a célula escolhida se marca', async () => {
    await render({ selectedSlots: [{ date: DATA, start: '18:00', end: '19:00', courtId: 'c1' }] });
    const marcada = celula('18:00', 0);
    expect(marcada.getAttribute('aria-pressed')).toBe('true');
    expect(marcada.textContent).toContain('escolhido');
  });

  it('⭐ com uma quadra já escolhida, a outra fica apagada — mas clicável', async () => {
    await render({ selectedSlots: [{ date: DATA, start: '18:00', end: '19:00', courtId: 'c1' }] });
    const outra = celula('18:00', 1);
    expect(outra.disabled).toBe(false);
    expect(outra.className).toContain('opacity-45');
    // A da quadra escolhida não fica apagada.
    expect(celula('19:00', 0).className).not.toContain('opacity-45');
  });

  it('explica a regra de uma quadra por reserva', async () => {
    await render();
    expect(container.textContent).toContain('uma quadra só');
  });
});
