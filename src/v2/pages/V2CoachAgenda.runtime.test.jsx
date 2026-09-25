/**
 * A disponibilidade semanal do professor.
 *
 * O que protege:
 *  1. ⭐ 🐞 leitura FALHANDO não abre o editor em branco — antes abria, e
 *     "Salvar" gravava a agenda vazia por cima da verdadeira;
 *  2. a falha diz o que aconteceu e deixa tentar de novo;
 *  3. só começa do zero quando a leitura CONFIRMOU que não há disponibilidade;
 *  4. com a agenda salva, o editor abre com as janelas dela.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { consulta: null };
const salvar = vi.fn(() => Promise.resolve());
const recarregar = vi.fn();

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'c1' } }) }));
vi.mock('@/modules/coaches/hooks/useCoaches', () => ({ useCoach: () => ({ data: null }) }));
vi.mock('@/modules/coaches/hooks/useLessons', () => ({
  useCoachAvailability: () => estado.consulta,
  useSaveAvailability: () => ({ mutateAsync: salvar, isPending: false }),
  useCoachLessons: () => ({ data: [] }),
  useRespondLesson: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
// As seções vizinhas não entram neste teste.
const Nada = () => null;
vi.mock('@/v2/components/arenas/classes/MyArenaClasses', () => ({ MyTaughtArenaClasses: Nada }));
vi.mock('@/modules/coaches/components/CoachStudentsSection', () => ({ default: Nada }));
vi.mock('@/modules/coaches/components/CoachClinicsSection', () => ({ default: Nada }));
vi.mock('@/modules/coaches/components/CoachPackagesSection', () => ({ default: Nada }));
vi.mock('@/modules/coaches/components/CoachContentSection', () => ({ default: Nada }));
vi.mock('@/modules/coaches/components/CoachStoreSection', () => ({ default: Nada }));
vi.mock('@/modules/coaches/components/CoachPartnersSection', () => ({ default: Nada }));
vi.mock('@/modules/coaches/components/CoachCourtBookingsSection', () => ({ default: Nada }));
vi.mock('@/modules/clubs/components/LinkedClubsSection', () => ({ default: Nada }));
vi.mock('@/modules/coaches/components/CoachProfileSections', () => ({ CoachInfoSection: Nada, CoachPhotosSection: Nada }));

const { AvailabilityEditor } = await import('./V2CoachAgenda.jsx');

const ok = (data) => ({ data, isLoading: false, isError: false, refetch: recarregar });

let container, root;
beforeEach(() => {
  estado.consulta = ok(null);
  salvar.mockClear();
  recarregar.mockClear();
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
    root.render(<MemoryRouter><AvailabilityEditor coachId="c1" /></MemoryRouter>);
  });
}

const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));

describe('disponibilidade semanal do professor', () => {
  it('⭐ 🐞 leitura falhando: NÃO abre o editor em branco nem oferece salvar', async () => {
    estado.consulta = { data: undefined, isLoading: false, isError: true, refetch: recarregar };
    await render();
    expect(container.textContent).toContain('Não foi possível carregar a sua disponibilidade');
    expect(container.textContent).toMatch(/gravaria a agenda em branco/);
    expect(container.textContent).not.toContain('Sem janelas de horário');
    expect(botao('Salvar')).toBeUndefined();
    expect(botao('Janela')).toBeUndefined();
  });

  it('a falha deixa tentar de novo', async () => {
    estado.consulta = { data: undefined, isLoading: false, isError: true, refetch: recarregar };
    await render();
    await act(async () => { botao('Tentar de novo').click(); });
    expect(recarregar).toHaveBeenCalled();
  });

  it('leitura CONFIRMOU que não há: começa do zero', async () => {
    await render();
    expect(container.textContent).toContain('Sem janelas de horário');
    expect(botao('Janela')).toBeTruthy();
  });

  it('com agenda salva, abre com as janelas dela', async () => {
    estado.consulta = ok({
      windows: [{ weekdays: [1, 3], start: '18:00', end: '21:00', location: 'Arena X' }],
      slot_minutes: 60,
    });
    await render();
    expect(container.textContent).not.toContain('Sem janelas de horário');
    expect(container.querySelector('input[value="Arena X"]')).toBeTruthy();
  });
});
