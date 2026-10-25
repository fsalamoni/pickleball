/**
 * Agenda oficial do clube para quem lê: a consulta que FALHA diz que não carregou (nunca
 * "sem eventos"); a vitrine some quando não há nada marcado daqui para a frente; o link do
 * evento leva à aba do app (ou à vitrine sem login); evento que a regra não deixa ver diz
 * "indisponível"; o clube não oferece "Seguir" nem comentários nem reunião (são da federação).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { q: null, ultimo: null };
vi.mock('@/modules/clubs/hooks/useClubAgenda', () => ({
  useClubEventsAll: () => estado.q,
  useReadableClubEvents: (id, opts) => { estado.ultimo = opts; return estado.q; },
}));
vi.mock('@/modules/clubs/hooks/useClubDocs', () => ({ useClubDocsAll: () => ({ isSuccess: true, data: [], refetch: vi.fn() }) }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock('@/modules/federations/hooks/useFederations', () => ({
  useVisibleAgenda: () => ({ ligado: false, items: null, isLoading: false }),
  useVisibleAcervo: () => ({ ligado: true, docs: [], isLoading: false }),
  useAcervoFollow: () => ({ data: null, isLoading: false }),
  useSetAcervoFollow: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useFederationMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

const { default: ClubAgendaPublic } = await import('./ClubAgendaPublic');

const club = { id: 'c1', name: 'Clube Pickle Sul' };
const amanha = new Date(Date.now() + 2 * 86400000);
const iso = `${amanha.getFullYear()}-${String(amanha.getMonth() + 1).padStart(2, '0')}-${String(amanha.getDate()).padStart(2, '0')}`;
const evento = (id, over = {}) => ({
  id, club_id: 'c1', kind: 'competition', title: `Evento ${id}`, date: iso, start_time: '19:00', end_time: '21:00',
  starts_at_ms: amanha.getTime(), ends_at_ms: amanha.getTime() + 7200000, created_at_ms: Date.now(),
  status: 'scheduled', visibility: 'public', pub: true, history: [], related_docs: [], ...over,
});
const ok = (data) => ({ isLoading: false, isError: false, isSuccess: true, data, refetch: vi.fn() });

let container, root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async (el) => { await act(async () => { root.render(<MemoryRouter>{el}</MemoryRouter>); }); };
const links = () => [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));

describe('ClubAgendaPublic', () => {
  it('falha na consulta: diz que não carregou, não que está vazio', async () => {
    estado.q = { isLoading: false, isError: true, isSuccess: false, data: undefined, refetch: vi.fn() };
    await montar(<ClubAgendaPublic club={club} />);
    expect(container.textContent).toContain('A agenda não carregou');
  });

  it('vitrine compacta sem nada marcado não mostra a seção', async () => {
    estado.q = ok([]);
    await montar(<ClubAgendaPublic club={club} publica compacto />);
    expect(container.textContent).toBe('');
  });

  it('o visitante consulta o público e o membro consulta o dele', async () => {
    estado.q = ok([evento('a')]);
    await montar(<ClubAgendaPublic club={club} compacto />);
    expect(estado.ultimo).toMatchObject({ member: false });
    act(() => root.unmount());
    root = createRoot(container);
    await montar(<ClubAgendaPublic club={club} member compacto />);
    expect(estado.ultimo).toMatchObject({ member: true });
  });

  it('a vitrine mostra o evento e o link volta para /c/:id', async () => {
    estado.q = ok([evento('a', { title: 'Torneio de abertura' })]);
    await montar(<ClubAgendaPublic club={club} publica compacto />);
    expect(container.textContent).toContain('Torneio de abertura');
    expect(links()).toContain('/c/c1?evento=a');
  });

  it('no app o link do evento leva à aba Agenda do clube', async () => {
    estado.q = ok([evento('b', { title: 'Assembleia' })]);
    await montar(<ClubAgendaPublic club={club} member compacto />);
    expect(links()).toContain('/clubes/c1?tab=agenda&evento=b');
  });

  it('evento que a pessoa não pode ler: "indisponível", sem distinguir de inexistente', async () => {
    estado.q = ok([evento('a')]);
    await montar(<ClubAgendaPublic club={club} eventId="fantasma" />);
    expect(container.textContent).toContain('Evento indisponível');
  });

  it('a página do evento não oferece seguir nem comentar nem reunião (são da federação)', async () => {
    estado.q = ok([evento('a', { title: 'Treino aberto' })]);
    await montar(<ClubAgendaPublic club={club} eventId="a" />);
    expect(container.textContent).toContain('Treino aberto');
    expect(container.textContent).not.toContain('Seguir publicações');
    expect(container.textContent).not.toContain('Entrar para seguir');
    expect(container.textContent).not.toContain('Comentários');
  });
});
