/**
 * As aulas das arenas no lado da pessoa.
 *
 * O que protege:
 *  1. ⭐ "Minhas aulas" mostra as matrículas de TODAS as arenas, a próxima
 *     primeiro, com o nome da arena e o link para a agenda dela;
 *  2. ⭐ o painel do professor mostra as aulas que ele dá nas arenas;
 *  3. sem nada, nenhum dos dois aparece (sem caixa vazia a mais).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { matriculas: null, dadas: null };

vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useMyClassEnrollments: () => ({ data: estado.matriculas, isLoading: false }),
  useMyTaughtClasses: () => ({ data: estado.dadas, isLoading: false }),
}));

const { MyArenaEnrollments, MyTaughtArenaClasses } = await import('./MyArenaClasses.jsx');

const aula = (id, date, over = {}) => ({
  id, arena_id: 'a1', date, start: '19:00', end: '20:00', status: 'scheduled',
  coach_name: 'Rafa', enrolled: 2, max_students: 4, ...over,
});

let container, root;
beforeEach(() => {
  estado.matriculas = null;
  estado.dadas = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render(el) {
  await act(async () => { root.render(<MemoryRouter>{el}</MemoryRouter>); });
}

describe('Minhas aulas — matrículas nas arenas', () => {
  it('sem matrícula, não aparece', async () => {
    estado.matriculas = { bookings: [], aulas: [], arenas: [] };
    await render(<MyArenaEnrollments />);
    expect(container.innerHTML).toBe('');
  });

  it('⭐ junta as arenas, a próxima primeiro, com link para a agenda de cada uma', async () => {
    estado.matriculas = {
      bookings: [
        { id: 'b1', class_id: 'k1', arena_id: 'a1', paid: true },
        { id: 'b2', class_id: 'k2', arena_id: 'a2', paid: false },
      ],
      aulas: [aula('k1', '2099-10-05'), aula('k2', '2099-10-02', { arena_id: 'a2' })],
      arenas: [{ id: 'a1', name: 'Arena Um' }, { id: 'a2', name: 'Arena Dois' }],
    };
    await render(<MyArenaEnrollments />);
    const texto = container.textContent;
    expect(texto).toContain('Aulas nas arenas');
    expect(texto.indexOf('Arena Dois')).toBeLessThan(texto.indexOf('Arena Um'));
    expect(texto).toContain('Pagar na arena');
    expect(texto).toContain('Pago');
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/arenas/a2/aulas', '/arenas/a1/aulas']);
  });

  it('aula cancelada é dita', async () => {
    estado.matriculas = {
      bookings: [{ id: 'b1', class_id: 'k1', arena_id: 'a1' }],
      aulas: [aula('k1', '2099-10-05', { status: 'cancelled' })],
      arenas: [{ id: 'a1', name: 'Arena Um' }],
    };
    await render(<MyArenaEnrollments />);
    expect(container.textContent).toContain('Cancelada');
  });
});

describe('Painel do professor — aulas que ele dá nas arenas', () => {
  it('sem cadastro de professor em arena, não aparece', async () => {
    estado.dadas = { perfis: [], aulasPorPerfil: {}, arenas: [] };
    await render(<MyTaughtArenaClasses />);
    expect(container.innerHTML).toBe('');
  });

  it('⭐ lista as próximas, com os alunos, e o caminho para a agenda de cada arena', async () => {
    estado.dadas = {
      perfis: [{ id: 'c1', arena_id: 'a1' }],
      aulasPorPerfil: { c1: [aula('k1', '2099-10-05'), aula('k0', '2020-01-01', { status: 'completed' })] },
      arenas: [{ id: 'a1', name: 'Arena Um' }],
    };
    await render(<MyTaughtArenaClasses />);
    expect(container.textContent).toContain('Aulas que você dá nas arenas');
    expect(container.textContent).toContain('2/4');
    expect(container.textContent).toContain('1 aula(s) dada(s)');
    expect(container.textContent).toContain('Agenda em Arena Um');
  });
});
