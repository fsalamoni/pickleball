/**
 * A aba de quadras da arena.
 *
 * O que protege:
 *  1. ⭐ 🐞 lista de quadras FALHANDO: nada de "Nenhuma quadra cadastrada" nem
 *     "Nova quadra" — criar ali duplicaria uma quadra que já existe, e o
 *     calendário passaria a contar duas;
 *  2. a falha deixa tentar de novo;
 *  3. ⭐ janelas de horário que não carregaram não viram "quadra sem horário"
 *     (o alarme mandaria o dono configurar o que já está configurado);
 *  4. lista vazia confirmada: oferece adicionar.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { quadras: null, janelas: null };
const recarregar = vi.fn();
const mut = () => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false });

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArenaCourts: () => estado.quadras,
  useArenaCourtSchedules: () => estado.janelas,
  useCreateCourt: mut, useUpdateCourt: mut, useDeleteCourt: mut,
  useReorderCourts: mut, useNormalizeCourtOrder: mut,
}));
vi.mock('@/v2/components/arenas/V2CourtSchedulesModal', () => ({ default: () => null }));

const { default: V2CourtsTab } = await import('./V2CourtsTab.jsx');

const ok = (data) => ({ data, isLoading: false, isError: false, isSuccess: true, refetch: recarregar });
const falha = () => ({ data: undefined, isLoading: false, isError: true, isSuccess: false, refetch: recarregar });

let container, root;
beforeEach(() => {
  estado.quadras = ok([]);
  estado.janelas = ok([]);
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
  await act(async () => { root.render(<V2CourtsTab arena={{ id: 'a1' }} />); });
}
const botoes = () => [...container.querySelectorAll('button')].map((b) => b.textContent);

describe('aba de quadras', () => {
  it('⭐ 🐞 lista falhando: não afirma vazio nem oferece criar outra quadra', async () => {
    estado.quadras = falha();
    await render();
    expect(container.textContent).toContain('Não foi possível carregar as quadras');
    expect(container.textContent).not.toContain('Nenhuma quadra cadastrada');
    expect(botoes().some((t) => /Nova quadra|Adicionar quadra/.test(t))).toBe(false);
  });

  it('a falha deixa tentar de novo', async () => {
    estado.quadras = falha();
    await render();
    const tentar = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Tentar de novo'));
    await act(async () => { tentar.click(); });
    expect(recarregar).toHaveBeenCalled();
  });

  it('⭐ janelas que não carregaram não viram "quadra sem horário"', async () => {
    estado.quadras = ok([{ id: 'q1', name: 'Quadra 1', active: true }]);
    estado.janelas = falha();
    await render();
    expect(container.textContent).not.toMatch(/sem horário de funcionamento/);
  });

  it('com as janelas carregadas, a quadra sem horário É avisada', async () => {
    estado.quadras = ok([{ id: 'q1', name: 'Quadra 1', active: true }]);
    await render();
    expect(container.textContent).toMatch(/1 quadra sem horário de funcionamento/);
  });

  it('lista vazia confirmada: oferece adicionar', async () => {
    await render();
    expect(container.textContent).toContain('Nenhuma quadra cadastrada');
    expect(botoes().some((t) => t.includes('Nova quadra'))).toBe(true);
  });
});
