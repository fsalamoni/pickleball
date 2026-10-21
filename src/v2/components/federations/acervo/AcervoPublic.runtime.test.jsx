/**
 * Acervo público: com as consultas restritas falhando a lista mostra os
 * públicos e DIZ que faltou (nunca finge completa); a busca filtra; o
 * revogado não some; e a conferência de integridade compara o SHA-256 do
 * arquivo escolhido com o publicado, sem enviar nada.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const HASH = 'a'.repeat(64);
const estado = { acervo: null };
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock('@/modules/federations/hooks/useFederations', () => ({
  useVisibleAcervo: () => estado.acervo,
  useAcervoFollow: () => ({ data: null, isLoading: false }),
  useSetAcervoFollow: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useFederationComments: () => ({ data: { state: { open: true, mode: 'open', why: null }, comments: [], count: 0, can_moderate: false, signed_in: false }, isLoading: false }),
  useFederationMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('./acervoFiles', () => ({
  sha256DoArquivo: vi.fn(async () => 'a'.repeat(64)),
  fetchAcervoBlob: vi.fn(),
  baixarBlob: vi.fn(),
  abrirArquivoDoAcervo: vi.fn(),
}));

const { AcervoBrowser } = await import('./AcervoPublic');
const { default: AcervoDocView } = await import('./AcervoDocView');

const fed = { id: 'fpp', slug: 'fpp', name: 'Federação Paulista', acronym: 'FPP', modules: { official_docs: true } };
const pub = (id, over = {}) => ({
  id, federation_id: 'fpp', type: 'resolution', category: 'acts', status: 'published', visibility: 'public',
  title: `Ato ${id}`, code: `Resolução nº ${id}/2026`, published_at_ms: Date.now(), version_at_ms: Date.now(), files: [], ...over,
});

let container, root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async (el) => { await act(async () => { root.render(<MemoryRouter>{el}</MemoryRouter>); }); };

describe('AcervoBrowser', () => {
  it('restritas falharam: mostra os públicos e avisa que faltou', async () => {
    estado.acervo = { ligado: true, docs: [pub('1'), pub('2', { title: 'Calendário oficial' })], isLoading: false, isError: false, incompleto: true, refetch: vi.fn() };
    await montar(<AcervoBrowser federation={fed} />);
    expect(container.textContent).toContain('Ato 1');
    expect(container.textContent).toContain('não carregaram agora');
  });

  it('a busca filtra na aba Documentos', async () => {
    estado.acervo = { ligado: true, docs: [pub('1'), pub('2', { title: 'Calendário oficial' })], isLoading: false, isError: false, incompleto: false, refetch: vi.fn() };
    await montar(<AcervoBrowser federation={fed} />);
    const aba = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Documentos');
    await act(async () => { aba.click(); });
    const busca = container.querySelector('input[type="search"], input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await act(async () => { setter.call(busca, 'calendario'); busca.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(container.textContent).toContain('Calendário oficial');
    expect(container.textContent).not.toContain('Ato 1');
  });
});

describe('AcervoDocView', () => {
  it('revogado continua visível, com o aviso', async () => {
    await montar(<AcervoDocView federation={fed} doc={pub('3', { revoked_by: { id: '9', code: 'Resolução nº 9/2026', title: 'Nova' } })} relacionados={[]} />);
    expect(container.textContent).toContain('Ato 3');
    expect(container.textContent).toMatch(/Revogad/);
  });

  it('confere o arquivo escolhido contra o SHA-256 publicado', async () => {
    const doc = pub('4', { files: [{ name: 'ato.pdf', path: 'p/ato.pdf', size: 10, content_type: 'application/pdf', sha256: HASH, url: 'https://firebasestorage.googleapis.com/x' }] });
    await montar(<AcervoDocView federation={fed} doc={doc} relacionados={[]} />);
    const input = container.querySelector('input[type="file"]');
    const arquivo = new File(['x'], 'baixado.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [arquivo] });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).toContain('é idêntico ao arquivo publicado');
  });
});
