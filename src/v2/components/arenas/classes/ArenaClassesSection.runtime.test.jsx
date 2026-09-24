/**
 * "Aulas e professores" na página da arena.
 *
 * O que protege:
 *  1. ⭐ as próximas aulas com vaga aparecem, com a matrícula ali mesmo;
 *  2. ⭐ a matrícula manda SÓ a aula (a divisão é do serviço);
 *  3. ⭐ quem dá aula aqui tem o caminho curto para a própria agenda;
 *  4. sem aula e sem professor, a seção não aparece;
 *  5. sem login, as aulas não são consultadas (a regra exige conta) — os
 *     parceiros aparecem, e o convite para entrar;
 *  6. parceria pendente não é divulgada.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const FUTURO = '2099-10-01';
const estado = {
  logado: true, parceiros: [], professores: [], aulas: [], minhas: [], perfis: [],
};
const consultas = { aulas: [] };
const matricular = vi.fn(() => Promise.resolve());

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ isAuthenticated: estado.logado, user: estado.logado ? { uid: 'eu' } : null }),
}));
vi.mock('@/modules/coaches/hooks/useCoaches', () => ({
  useArenaCoaches: () => ({ data: estado.parceiros }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaCoaches: (arenaId) => ({ data: arenaId ? estado.professores : [] }),
  useArenaClasses: (arenaId) => { consultas.aulas.push(arenaId); return { data: arenaId ? estado.aulas : [] }; },
  useBookClass: () => ({ mutateAsync: matricular, isPending: false }),
  useMyClassBookings: (arenaId) => ({ data: arenaId ? estado.minhas : [] }),
  useMyCoachProfiles: () => ({ data: estado.perfis }),
}));

const { default: ArenaClassesSection } = await import('./ArenaClassesSection.jsx');

const aula = (over = {}) => ({
  id: 'k1', arena_id: 'a1', date: FUTURO, start: '19:00', end: '20:00', status: 'scheduled',
  max_students: 4, enrolled: 1, price: 80, coach_name: 'Rafa', format: 'group', level: 'beginner', ...over,
});

let container, root;
beforeEach(() => {
  Object.assign(estado, { logado: true, parceiros: [], professores: [], aulas: [], minhas: [], perfis: [] });
  consultas.aulas = [];
  matricular.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render() {
  await act(async () => {
    root.render(<MemoryRouter><ArenaClassesSection arena={{ id: 'a1', name: 'Arena' }} /></MemoryRouter>);
  });
}

describe('Aulas e professores na página da arena', () => {
  it('sem aula e sem professor, a seção não aparece', async () => {
    await render();
    expect(container.innerHTML).toBe('');
  });

  it('⭐ mostra as próximas aulas com vaga e matricula ali mesmo — mandando só a aula', async () => {
    estado.aulas = [aula()];
    await render();
    expect(container.textContent).toContain('Aulas e professores');
    expect(container.textContent).toContain('3 vaga(s)');
    const b = [...container.querySelectorAll('button')].find((x) => x.textContent === 'Matricular-me');
    await act(async () => { b.click(); });
    expect(matricular).toHaveBeenCalledWith({ arenaId: 'a1', classId: 'k1' });
  });

  it('quem já está matriculado vê isso, no lugar do botão', async () => {
    estado.aulas = [aula()];
    estado.minhas = [{ id: 'k1_eu', class_id: 'k1' }];
    await render();
    expect(container.textContent).toContain('Você está nesta aula');
    expect(container.textContent).not.toContain('Matricular-me');
  });

  it('aula lotada não oferece matrícula', async () => {
    estado.aulas = [aula({ enrolled: 4 })];
    await render();
    const b = [...container.querySelectorAll('button')].find((x) => x.textContent === 'Lotada');
    expect(b.disabled).toBe(true);
  });

  it('⭐ quem dá aula aqui tem o caminho curto para a própria agenda', async () => {
    estado.perfis = [{ id: 'c1', arena_id: 'a1', active: true }];
    await render();
    expect(container.textContent).toContain('Você dá aula aqui');
    const link = [...container.querySelectorAll('a')].find((a) => a.textContent.includes('Você dá aula aqui'));
    expect(link.getAttribute('href')).toBe('/arenas/a1/aulas');
  });

  it('professores: parceiro com link para o perfil, professor das aulas sem link', async () => {
    estado.parceiros = [{ id: 'u1', display_name: 'Parceiro Ativo', residency: { status: 'active' } }];
    estado.professores = [{ id: 'c2', name: 'Da Casa', active: true, partner: false }];
    await render();
    expect(container.textContent).toContain('Parceiro Ativo');
    expect(container.textContent).toContain('Da Casa');
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/coaches/u1');
  });

  it('parceria PENDENTE não é divulgada', async () => {
    estado.parceiros = [{ id: 'u1', display_name: 'Convidado', residency: { status: 'pending' } }];
    await render();
    expect(container.textContent).not.toContain('Convidado');
  });

  it('sem login, as aulas nem são consultadas — e a pessoa é convidada a entrar', async () => {
    estado.logado = false;
    estado.parceiros = [{ id: 'u1', display_name: 'Parceiro Ativo', residency: { status: 'active' } }];
    await render();
    expect(consultas.aulas.every((id) => id === null)).toBe(true);
    expect(container.textContent).toContain('Parceiro Ativo');
    expect(container.textContent).toMatch(/Entre.*para ver os horários/);
  });
});
