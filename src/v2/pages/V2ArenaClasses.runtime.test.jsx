/**
 * Aulas da arena — uma tela, três pessoas.
 *
 * O que estes testes protegem:
 *  1. ⭐ sem o módulo, a rota não existe;
 *  2. ⭐ o ATLETA vê "Matricular-me"; a ARENA vê a gestão; o PROFESSOR vê a
 *     agenda dele — e o professor é reconhecido pelo VÍNCULO `user_id`, que
 *     era exatamente o que faltava;
 *  3. ⭐ a matrícula manda `classId` e a comissão CONFIGURADA (era 50% no código);
 *  4. ⭐ aula com quadra avisa que tira o horário da venda;
 *  5. aula lotada não oferece matrícula, e quem já está matriculado vê isso;
 *  6. a divisão arena/professor não aparece para o aluno.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const LIGADOS = new Set();
const estado = {
  gere: false, coaches: [], aulas: [], minhas: [], meusPerfis: [], config: {},
};
const matricular = vi.fn(() => Promise.resolve());

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'eu' }, isPlatformAdmin: false, isAuthenticated: true }),
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArena: () => ({ data: { id: 'a1', name: 'Arena Teste', owner_id: estado.gere ? 'eu' : 'outro' }, isLoading: false }),
  useMyManagedArenas: () => ({ data: [] }),
  useArenaCourts: () => ({ data: [{ id: 'q1', name: 'Quadra 1' }] }),
}));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({ useAthletes: () => ({ data: [] }) }));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id), isLoading: false }),
  useArenaModuleConfig: () => estado.config,
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaCoaches: () => ({ data: estado.coaches }),
  useArenaClasses: () => ({ data: estado.aulas, isLoading: false }),
  useCreateCoach: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateArenaCoach: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateClass: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateArenaClass: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelArenaClass: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCompleteArenaClass: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBookClass: () => ({ mutateAsync: matricular, isPending: false }),
  useClassBookings: () => ({ data: [], isLoading: false }),
  useMyClassBookings: () => ({ data: estado.minhas }),
  useCancelClassBooking: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetClassBookingPaid: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMyCoachProfiles: () => ({ data: estado.meusPerfis }),
}));

const { default: V2ArenaClasses } = await import('./V2ArenaClasses.jsx');

/** Uma data bem no futuro, para a aula nunca cair em "passada". */
const FUTURO = '2099-10-01';

const aula = (over = {}) => ({
  id: 'c1', arena_id: 'a1', date: FUTURO, start: '19:00', end: '20:00',
  status: 'scheduled', format: 'group', level: 'beginner',
  max_students: 4, enrolled: 0, price: 100, coach_id: 'p1', coach_name: 'Rafa',
  court_id: 'q1', ...over,
});

let container, root;

beforeEach(() => {
  LIGADOS.clear();
  LIGADOS.add(ARENA_MODULE_ID.CLASSES);
  matricular.mockClear();
  Object.assign(estado, {
    gere: false, coaches: [], aulas: [], minhas: [], meusPerfis: [], config: {},
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

async function render(rota = '/arenas/a1/aulas') {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/arenas/:arenaId/aulas" element={<V2ArenaClasses />} />
          <Route path="/arenas/:arenaId/gerir/aulas" element={<V2ArenaClasses />} />
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

/* ================================================================ guarda === */

describe('quem entra aqui', () => {
  it('⭐ sem o módulo de aulas, volta para a arena', async () => {
    LIGADOS.clear();
    await render();
    expect(container.textContent).toContain('PÁGINA DA ARENA');
  });

  it('com o módulo, o atleta vê as aulas', async () => {
    await render();
    expect(container.textContent).toContain('Aulas nesta arena');
  });
});

/* =============================================================== atleta === */

describe('o atleta', () => {
  it('⭐ vê "Matricular-me" numa aula com vaga', async () => {
    estado.aulas = [aula()];
    await render();
    expect(container.textContent).toContain('Matricular-me');
  });

  it('⭐ a matrícula manda a aula E a comissão configurada', async () => {
    // O serviço gravava 50% fixo, ignorando a configuração do módulo.
    estado.aulas = [aula()];
    estado.config = { commission_pct: 30 };
    await render();
    await clicar('Matricular-me');
    expect(matricular).toHaveBeenCalledTimes(1);
    expect(matricular.mock.calls[0][0]).toMatchObject({
      arenaId: 'a1', classId: 'c1', commissionPct: 30,
    });
  });

  it('sem configuração, usa o padrão de 20% — não os 50% do código antigo', async () => {
    estado.aulas = [aula()];
    await render();
    await clicar('Matricular-me');
    expect(matricular.mock.calls[0][0].commissionPct).toBe(20);
  });

  it('aula lotada não oferece matrícula', async () => {
    estado.aulas = [aula({ enrolled: 4, max_students: 4 })];
    await render();
    expect(container.textContent).toContain('Lotada');
    expect(container.textContent).not.toContain('Matricular-me');
  });

  it('⭐ quem já está matriculado vê isso, e pode desmarcar', async () => {
    estado.aulas = [aula()];
    estado.minhas = [{ id: 'c1_eu', class_id: 'c1', arena_id: 'a1', user_id: 'eu' }];
    await render();
    expect(container.textContent).toContain('Você está nesta aula');
    expect(container.textContent).toContain('Desmarcar');
  });

  it('⭐ a divisão arena/professor NÃO aparece para o aluno', async () => {
    estado.aulas = [aula()];
    await render();
    expect(container.textContent).not.toMatch(/Divisão por aluno/i);
  });

  it('não vê os botões de gestão', async () => {
    estado.aulas = [aula()];
    await render();
    expect(container.textContent).not.toContain('Nova aula');
    expect(container.textContent).not.toContain('Marcar como dada');
  });

  it('aula cancelada é dita, com o motivo', async () => {
    estado.aulas = [aula({ status: 'cancelled', cancel_reason: 'Professor doente' })];
    await render();
    expect(container.textContent).toContain('Cancelada');
    expect(container.textContent).toContain('Professor doente');
  });
});

/* ============================================================= professor === */

describe('⭐ o professor, reconhecido pelo VÍNCULO', () => {
  it('sem vínculo, é tratado como atleta', async () => {
    estado.aulas = [aula()];
    estado.meusPerfis = [];
    await render();
    expect(container.textContent).toContain('Aulas nesta arena');
  });

  it('⭐ com vínculo nesta arena, vê a AGENDA DELE', async () => {
    estado.meusPerfis = [{ id: 'p1', arena_id: 'a1', name: 'Rafa', user_id: 'eu' }];
    estado.aulas = [aula()];
    await render();
    expect(container.textContent).toContain('Sua agenda nesta arena');
  });

  it('⭐ vê só as aulas DELE, não as dos outros professores', async () => {
    estado.meusPerfis = [{ id: 'p1', arena_id: 'a1', name: 'Rafa', user_id: 'eu' }];
    estado.aulas = [
      aula({ id: 'c1', coach_id: 'p1', coach_name: 'Rafa' }),
      aula({ id: 'c2', coach_id: 'p2', coach_name: 'Outra pessoa' }),
    ];
    await render();
    expect(container.textContent).toContain('Rafa');
    expect(container.textContent).not.toContain('Outra pessoa');
  });

  it('vê os alunos e a própria divisão do dinheiro', async () => {
    estado.meusPerfis = [{ id: 'p1', arena_id: 'a1', name: 'Rafa', user_id: 'eu' }];
    estado.aulas = [aula()];
    await render();
    expect(container.textContent).toMatch(/Alunos/);
    expect(container.textContent).toMatch(/Divisão por aluno/i);
  });

  it('vínculo em OUTRA arena não o torna professor desta', async () => {
    estado.meusPerfis = [{ id: 'p9', arena_id: 'a2', name: 'Rafa', user_id: 'eu' }];
    estado.aulas = [aula()];
    await render();
    expect(container.textContent).toContain('Aulas nesta arena');
  });
});

/* ================================================================ arena === */

describe('a arena', () => {
  beforeEach(() => { estado.gere = true; });

  it('vê a gestão', async () => {
    await render('/arenas/a1/gerir/aulas');
    expect(container.textContent).toContain('Aulas da arena');
    expect(container.textContent).toContain('Nova aula');
    expect(container.textContent).toContain('Novo professor');
  });

  it('⭐ é avisada de que a aula com quadra tira o horário da venda', async () => {
    await render('/arenas/a1/gerir/aulas');
    expect(container.textContent).toMatch(/tira aquele horário da\s+venda/i);
  });

  it('sem professor cadastrado, explica o vínculo', async () => {
    await render('/arenas/a1/gerir/aulas');
    expect(container.textContent).toMatch(/Nenhum professor cadastrado/i);
    expect(container.textContent).toMatch(/ver a própria agenda/i);
  });

  it('professor INATIVO continua na lista, para poder ser reativado', async () => {
    estado.coaches = [{ id: 'p1', name: 'Antigo', level: 'pro', active: false }];
    await render('/arenas/a1/gerir/aulas');
    expect(container.textContent).toContain('Antigo');
    expect(container.textContent).toContain('Inativo');
  });

  it('pode concluir e cancelar a aula', async () => {
    estado.aulas = [aula()];
    await render('/arenas/a1/gerir/aulas');
    expect(container.textContent).toContain('Marcar como dada');
    expect(container.textContent).toContain('Cancelar');
  });
});
