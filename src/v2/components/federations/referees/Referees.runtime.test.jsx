/**
 * Arbitragem na tela: o quadro público mostra nome, nível e cidade (nunca
 * valor); a falha não vira "ninguém no quadro"; a equipe do torneio só
 * aparece no chancelado e público; e o árbitro confirma ou recusa a
 * convocação — recusar com conflito exige dizer qual.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { publico: null, chamadas: [] };
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/federations/hooks/useReferees', () => ({ useRefereesPublic: () => estado.publico }));
vi.mock('@/modules/federations/services/refereesService', () => ({
  refereesAction: (p) => { estado.chamadas.push(p); return Promise.resolve({ ok: true, people: [] }); },
}));
vi.mock('@/modules/federations/hooks/useFederations', () => ({
  useFederationMutation: (fn) => ({ mutate: (v, o) => Promise.resolve(fn(v)).then(o?.onSuccess, o?.onError), isPending: false }),
}));

const { FedRefereesBoard, TournamentRefereeCrew } = await import('./RefereesPublic');
const { default: MyRefereeAssignments } = await import('./MyRefereeAssignments');
const { toast } = await import('sonner');

const fed = { id: 'fpp', slug: 'fpp', name: 'Federação Paulista', acronym: 'FPP', modules: { referees: true } };
const q = (data, over = {}) => ({ data, isLoading: false, isError: false, refetch: vi.fn(), ...over });
const daqui = (dias) => new Date(Date.now() + dias * 86400000 - 3 * 3600000).toISOString().slice(0, 10);

let container, root;
beforeEach(() => { estado.chamadas = []; container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.clearAllMocks(); });
const montar = async (el) => { await act(async () => { root.render(<MemoryRouter>{el}</MemoryRouter>); }); };
const clicar = async (el) => { await act(async () => { el.click(); }); };
const botao = (txt, onde = document.body) => [...onde.querySelectorAll('button')].find((b) => b.textContent.trim() === txt);

describe('FedRefereesBoard', () => {
  it('mostra o quadro e quem apita, sem valores', async () => {
    estado.publico = q({ available: true, board: [{ name: 'Ana Árbitra', level_label: 'Nacional', city: 'Santos', state: 'SP' }], crews: [{ event: { kind: 'tournament', id: 't1', name: 'Open SP', date: daqui(3) }, people: [{ name: 'Ana Árbitra', function: 'head_referee' }] }] });
    await montar(<FedRefereesBoard federation={fed} />);
    expect(container.textContent).toContain('Ana Árbitra');
    expect(container.textContent).toContain('Nacional · Santos/SP');
    expect(container.textContent).toContain('Open SP');
    expect(container.textContent).not.toContain('R$');
  });

  it('falha não vira quadro vazio', async () => {
    estado.publico = q(undefined, { isError: true });
    await montar(<FedRefereesBoard federation={fed} />);
    expect(container.textContent).toContain('Não carregou a arbitragem');
    expect(container.textContent).not.toContain('Nenhum árbitro');
  });

  it('módulo desligado: nada', async () => {
    estado.publico = q({ available: true, board: [], crews: [] });
    await montar(<FedRefereesBoard federation={{ ...fed, modules: {} }} />);
    expect(container.textContent).toBe('');
  });
});

describe('TournamentRefereeCrew', () => {
  const torneio = { id: 't1', federation_id: 'fpp', visibility: 'public', federation_sanction: { status: 'approved' } };
  it('chancelado e público: mostra a equipe', async () => {
    estado.publico = q({ available: true, crew: [{ name: 'Bruno', function: 'line_judge' }] });
    await montar(<TournamentRefereeCrew tournament={torneio} />);
    expect(container.textContent).toContain('Bruno');
  });
  it('sem chancela aprovada: some', async () => {
    estado.publico = q({ available: true, crew: [{ name: 'Bruno', function: 'line_judge' }] });
    await montar(<TournamentRefereeCrew tournament={{ ...torneio, federation_sanction: { status: 'pending' } }} />);
    expect(container.textContent).toBe('');
  });
});

describe('MyRefereeAssignments', () => {
  const convite = { id: 'as1', federation_id: 'fpp', federation_acronym: 'FPP', status: 'invited', function: 'head_referee', respond_by: daqui(2), event: { kind: 'tournament', id: 't1', name: 'Open SP', date: daqui(10) } };

  it('convocação vai para "Para responder" e confirmar manda accept', async () => {
    await montar(<MyRefereeAssignments assignments={[convite]} />);
    expect(container.textContent).toContain('Para responder');
    await clicar(botao('Confirmar', container));
    await clicar(botao('Confirmar', document.querySelector('[role="dialog"]')));
    expect(estado.chamadas).toEqual([expect.objectContaining({ action: 'respond', assignmentId: 'as1', accept: true })]);
  });

  it('recusar com conflito exige dizer qual', async () => {
    await montar(<MyRefereeAssignments assignments={[convite]} />);
    await clicar(botao('Recusar', container));
    await clicar(document.body.querySelector('#mr-conflito'));
    await clicar(botao('Recusar', document.querySelector('[role="dialog"]')));
    expect(estado.chamadas).toHaveLength(0);
    expect(toast.error).toHaveBeenCalledWith('Diga qual é o conflito de interesse.');
  });

  it('sem nada: diz que não há convocação', async () => {
    await montar(<MyRefereeAssignments assignments={[]} />);
    expect(container.textContent).toContain('Nenhuma convocação em aberto');
  });
});
