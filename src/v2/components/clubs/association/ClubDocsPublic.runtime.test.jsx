/**
 * Documentos oficiais do clube para quem lê: a consulta que FALHA diz que não carregou
 * (nunca "sem documentos"); a vitrine some quando não há nada publicado; o link do
 * documento leva à aba do app (ou à vitrine sem login); documento que a regra não
 * deixa ver diz "indisponível" sem distinguir de "não existe"; o clube não oferece
 * "Seguir" nem comentários (são da federação).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { q: null };
vi.mock('@/modules/clubs/hooks/useClubDocs', () => ({ useReadableClubDocs: () => estado.q }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock('@/modules/federations/hooks/useFederations', () => ({
  useVisibleAcervo: () => ({ ligado: true, docs: [], isLoading: false }),
  useAcervoFollow: () => ({ data: null, isLoading: false }),
  useSetAcervoFollow: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useFederationMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

const { default: ClubDocsPublic } = await import('./ClubDocsPublic');

const club = { id: 'c1', name: 'Clube Pickle Sul' };
const pub = (id, over = {}) => ({
  id, club_id: 'c1', type: 'bylaws', category: 'governance', status: 'published', visibility: 'public',
  title: `Documento ${id}`, code: '', published_at_ms: Date.now(), version_at_ms: Date.now(), files: [], ...over,
});
const ok = (data) => ({ isLoading: false, isError: false, isSuccess: true, data, refetch: vi.fn() });

let container, root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async (el) => { await act(async () => { root.render(<MemoryRouter>{el}</MemoryRouter>); }); };

describe('ClubDocsPublic', () => {
  it('falha na consulta: diz que não carregou, não que está vazio', async () => {
    estado.q = { isLoading: false, isError: true, isSuccess: false, data: undefined, refetch: vi.fn() };
    await montar(<ClubDocsPublic club={club} />);
    expect(container.textContent).toContain('não carregaram');
    expect(container.textContent).not.toContain('ainda não publicou');
  });

  it('vitrine compacta sem nada publicado não mostra a seção', async () => {
    estado.q = ok([]);
    await montar(<ClubDocsPublic club={club} compacto />);
    expect(container.textContent).toBe('');
  });

  it('a listagem do associado mostra os documentos e o link leva à aba do app', async () => {
    estado.q = ok([pub('a'), pub('b', { title: 'Regimento interno' })]);
    await montar(<ClubDocsPublic club={club} member />);
    expect(container.textContent).toContain('Regimento interno');
    const links = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toContain('/clubes/c1?tab=documentos&doc=b');
  });

  it('na vitrine sem login o link volta para /c/:id', async () => {
    estado.q = ok([pub('a')]);
    await montar(<ClubDocsPublic club={club} publica compacto />);
    const links = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toContain('/c/c1?doc=a');
  });

  it('documento que não está na lista que a pessoa pode ler: "indisponível"', async () => {
    estado.q = ok([pub('a')]);
    await montar(<ClubDocsPublic club={club} docId="fantasma" />);
    expect(container.textContent).toContain('Documento indisponível');
  });

  it('a página do documento não oferece seguir nem comentar (são da federação)', async () => {
    estado.q = ok([pub('a', { summary: 'O regimento do clube.' })]);
    await montar(<ClubDocsPublic club={club} docId="a" />);
    expect(container.textContent).toContain('Documento a');
    expect(container.textContent).toContain('O regimento do clube.');
    expect(container.textContent).not.toContain('Seguir publicações');
    expect(container.textContent).not.toContain('Entrar para seguir');
    expect(container.textContent).toContain('Ver todos os documentos');
  });
});
