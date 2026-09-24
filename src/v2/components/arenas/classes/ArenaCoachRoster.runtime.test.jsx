/**
 * A lista ÚNICA de professores da arena (Central → Aulas → Professores).
 *
 * O que protege:
 *  1. ⭐ o mesmo professor nos dois cadastros aparece UMA vez, com o que ele é
 *     na parceria E nas aulas;
 *  2. ⭐ "Colocar nas aulas" cria o cadastro das aulas A PARTIR do parceiro —
 *     com a conta vinculada e pagando comissão (é professor de fora);
 *  3. convite PENDENTE não é colocado nas aulas (o professor nem aceitou);
 *  4. professor só das aulas aparece, e sem conta vinculada é avisado de que
 *     não vê a própria agenda;
 *  5. falha na consulta não vira "nenhum professor".
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { parceiros: [], aulas: [], erro: false };
const criar = vi.fn(() => Promise.resolve('novo'));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/coaches/hooks/useCoaches', () => ({
  useArenaCoaches: () => ({ data: estado.parceiros, isLoading: false, isError: estado.erro, refetch: vi.fn() }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaCoaches: () => ({ data: estado.aulas, isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateCoach: () => ({ mutateAsync: criar, isPending: false }),
  useUpdateArenaCoach: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({ useAthletes: () => ({ data: [] }) }));
vi.mock('@/v2/pages/V2ArenaCoaches', () => ({
  AddPartner: () => <div>BUSCA DE PARCEIRO</div>,
  PartnerCard: ({ coach, extraBadges, children }) => (
    <div data-testid="parceiro">
      <span>{coach.display_name}</span>
      <span>{coach.residency?.status || 'active'}</span>
      {extraBadges}
      {children}
    </div>
  ),
}));

const { default: ArenaCoachRoster } = await import('./ArenaCoachRoster.jsx');

let container, root;
beforeEach(() => {
  Object.assign(estado, { parceiros: [], aulas: [], erro: false });
  criar.mockClear();
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
    root.render(<MemoryRouter><ArenaCoachRoster arena={{ id: 'a1', name: 'Arena' }} /></MemoryRouter>);
  });
}
const clicar = async (texto) => {
  const b = [...container.querySelectorAll('button')].find((x) => x.textContent.includes(texto));
  expect(b, `botão "${texto}"`).toBeTruthy();
  await act(async () => { b.click(); });
};

describe('a lista única', () => {
  it('⭐ o mesmo professor nos dois cadastros aparece UMA vez', async () => {
    estado.parceiros = [{ id: 'u1', display_name: 'Rafa', residency: { status: 'active' } }];
    estado.aulas = [{ id: 'c1', arena_id: 'a1', name: 'Rafa', user_id: 'u1', partner: true, active: true }];
    await render();
    expect(container.querySelectorAll('[data-testid="parceiro"]')).toHaveLength(1);
    expect(container.textContent).toContain('Dá aula aqui');
    expect(container.textContent).toContain('Paga comissão');
    expect(container.textContent).toContain('Editar nas aulas');
  });

  it('⭐ "Colocar nas aulas" cria o cadastro a partir do parceiro, vinculado e pagando comissão', async () => {
    estado.parceiros = [{ id: 'u1', display_name: 'Rafa', hourly_rate: 150, residency: { status: 'active' } }];
    await render();
    await clicar('Colocar nas aulas');
    expect(criar).toHaveBeenCalledTimes(1);
    expect(criar.mock.calls[0][0]).toMatchObject({
      arenaId: 'a1',
      input: { name: 'Rafa', user_id: 'u1', partner: true, price_per_hour: 150, active: true },
    });
  });

  it('convite PENDENTE não vai para as aulas — o professor nem aceitou', async () => {
    estado.parceiros = [{ id: 'u1', display_name: 'Rafa', residency: { status: 'pending' } }];
    await render();
    expect(container.textContent).not.toContain('Colocar nas aulas');
    expect(container.textContent).toMatch(/Quando o professor aceitar a parceria/);
  });

  it('professor da casa sem conta aparece, e é avisado de que não vê a agenda', async () => {
    estado.aulas = [{ id: 'c2', arena_id: 'a1', name: 'Bia', active: true, partner: false }];
    await render();
    expect(container.textContent).toContain('Bia');
    expect(container.textContent).toContain('Da casa');
    expect(container.textContent).toMatch(/sem conta vinculada/);
  });

  it('o formulário de novo professor oferece os parceiros que ainda não dão aula', async () => {
    estado.parceiros = [
      { id: 'u1', display_name: 'Rafa', residency: { status: 'active' } },
      { id: 'u2', display_name: 'Pendente', residency: { status: 'pending' } },
    ];
    await render();
    await clicar('Professor das aulas');
    expect(container.textContent).toContain('Parceiros da plataforma');
    const chips = [...container.querySelectorAll('form button')].map((b) => b.textContent);
    expect(chips.some((t) => t.includes('Rafa'))).toBe(true);
    expect(chips.some((t) => t.includes('Pendente'))).toBe(false);
  });

  it('falha na consulta NÃO vira "nenhum professor"', async () => {
    estado.erro = true;
    await render();
    expect(container.textContent).toContain('Não foi possível carregar os professores');
    expect(container.textContent).not.toContain('Nenhum professor ainda');
  });

  it('sem ninguém, explica os dois caminhos', async () => {
    await render();
    expect(container.textContent).toContain('Nenhum professor ainda');
    expect(container.textContent).toContain('Parceiro da plataforma');
    expect(container.textContent).toContain('Professor das aulas');
  });
});
