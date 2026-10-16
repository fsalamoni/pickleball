/**
 * "Me avise quando abrir horário" (lista de espera do professor).
 *
 *  1. ⭐ quem não está entra com as preferências escolhidas e o formato;
 *  2. ⭐ quem já está vê desde quando e pode sair (nada de "entrar" de novo);
 *  3. leitura das minhas listas falhando: não oferece entrar (não sabe se já está).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const entrar = vi.fn(() => Promise.resolve('P_eu'));
const sair = vi.fn(() => Promise.resolve());
const estado = { minhas: [], erro: false };

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../hooks/useCoachWaitlist', () => ({
  useMyCoachWaitlists: () => ({ data: estado.minhas, isLoading: false, isError: estado.erro, refetch: vi.fn() }),
  useJoinCoachWaitlist: () => ({ mutateAsync: entrar, isPending: false }),
  useLeaveCoachWaitlist: () => ({ mutateAsync: sair, isPending: false }),
}));

const { default: CoachWaitlistJoin } = await import('./CoachWaitlistJoin.jsx');

let host; let root;
beforeEach(() => {
  entrar.mockClear(); sair.mockClear();
  estado.minhas = []; estado.erro = false;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

const botao = (texto) => [...host.querySelectorAll('button')].find((b) => b.textContent === texto);
const montar = () => act(async () => { root.render(<CoachWaitlistJoin coach={{ id: 'P', display_name: 'Prof. Bia' }} format="duo" />); });

describe('CoachWaitlistJoin', () => {
  it('⭐ entra na lista com períodos, dias e o formato escolhido', async () => {
    await montar();
    await act(async () => { botao('Noite').click(); botao('Seg').click(); });
    await act(async () => { botao('Entrar na lista de espera').click(); });
    expect(entrar).toHaveBeenCalledWith({
      coachId: 'P', existing: null,
      input: { periods: ['noite'], weekdays: [1], note: '', format: 'duo', coach_name: 'Prof. Bia' },
    });
  });

  it('⭐ quem já está vê o status e pode sair', async () => {
    estado.minhas = [{ id: 'P_eu', coach_id: 'P', user_id: 'eu', created_at_ms: Date.parse('2026-10-10T12:00:00Z'), periods: ['manha'] }];
    await montar();
    expect(host.textContent).toContain('Você está na lista de espera desde');
    expect(botao('Entrar na lista de espera')).toBeUndefined();
    await act(async () => { botao('Sair da lista').click(); });
    expect(sair).toHaveBeenCalledWith({ coachId: 'P' });
  });

  it('falha ao ler as minhas listas: não oferece entrar', async () => {
    estado.erro = true;
    await montar();
    expect(host.textContent).toContain('Não foi possível conferir a lista de espera');
    expect(botao('Entrar na lista de espera')).toBeUndefined();
  });
});
