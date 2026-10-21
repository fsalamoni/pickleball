/**
 * Comentários na página do documento ou do evento: sem conta, lê e é
 * convidado a entrar; com conta, publica; a resposta oficial aparece em
 * destaque abaixo do comentário; a equipe vê denúncias, oculta com motivo e
 * fecha os comentários; desligado sem nada escrito, a seção some.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const commentAction = vi.fn(async () => ({ ok: true }));
const toast = { success: vi.fn(), error: vi.fn() };
const estado = { q: null };
vi.mock('sonner', () => ({ toast }));
vi.mock('@/modules/federations/services/federationService', () => ({ commentAction: (...a) => commentAction(...a) }));
vi.mock('@/modules/federations/hooks/useFederations', async () => {
  const { useMutation } = await import('@tanstack/react-query');
  return { useFederationMutation: (fn) => useMutation({ mutationFn: fn }), useFederationComments: () => estado.q };
});

const { default: CommentsSection } = await import('./CommentsSection');

const fed = { id: 'fpp', slug: 'fpp', acronym: 'FPP', modules: { discipline: true } };
const ABERTO = { open: true, mode: 'open', until_date: null, why: null };
const lista = (extra = {}) => ({
  isLoading: false, isError: false, refetch: vi.fn(),
  data: {
    state: ABERTO, can_moderate: false, signed_in: false, count: 1,
    comments: [
      { id: 'c1', text: 'Quando sai o calendário?', user_name: 'Ana', created_at_ms: 1, status: 'visible', mine: false },
      { id: 'r1', parent_id: 'c1', text: 'Na próxima semana.', user_name: 'Sec', org_name: 'FPP', official: true, created_at_ms: 2, status: 'visible', mine: false },
    ],
    ...extra,
  },
});

let container, root;
beforeEach(() => {
  commentAction.mockClear(); toast.error.mockClear(); toast.success.mockClear();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async () => {
  await act(async () => {
    root.render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/f/fpp/acervo/reg']}><CommentsSection federation={fed} kind="doc" targetId="reg" /></MemoryRouter></QueryClientProvider>);
  });
};
const valor = async (el, v) => {
  const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  await act(async () => { el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
};
const botao = (texto, raiz = container) => [...raiz.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
const clicar = async (b) => { await act(async () => { b.click(); }); };

describe('CommentsSection', () => {
  it('sem conta: lê os comentários, a resposta oficial em destaque, e é convidado a entrar', async () => {
    estado.q = lista();
    await montar();
    expect(container.textContent).toContain('Comentários (1)');
    expect(container.textContent).toContain('Quando sai o calendário?');
    expect(container.textContent).toContain('Resposta oficial');
    expect(container.textContent).toContain('ouvidoria');
    const entrar = [...container.querySelectorAll('a')].find((a) => a.textContent.includes('Entrar para comentar'));
    expect(entrar.getAttribute('href')).toBe('/login?next=%2Ff%2Ffpp%2Facervo%2Freg');
    expect(botao('Denunciar')).toBeUndefined();
  });

  it('com conta: publica o comentário pelo servidor', async () => {
    estado.q = lista({ signed_in: true });
    await montar();
    await valor(container.querySelector('textarea'), 'Gostei da mudança no art. 4');
    await act(async () => { container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(commentAction).toHaveBeenCalledWith({ federationId: 'fpp', action: 'post', kind: 'doc', targetId: 'reg', text: 'Gostei da mudança no art. 4' });
    expect(botao('Denunciar')).toBeTruthy();
  });

  it('equipe: vê denúncias, oculta com motivo e fecha os comentários', async () => {
    estado.q = lista({ signed_in: true, can_moderate: true, comments: [{ id: 'c1', text: 'Polêmico', user_name: 'Ana', created_at_ms: 1, status: 'visible', reports_count: 2 }] });
    await montar();
    expect(container.textContent).toContain('2 denúncias');
    await clicar(botao('Ocultar'));
    const dialogo = document.querySelector('[role="dialog"]');
    await valor(dialogo.querySelector('textarea'), 'curto');
    await act(async () => { dialogo.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(commentAction).not.toHaveBeenCalled();
    await valor(dialogo.querySelector('textarea'), 'Expõe o telefone de um atleta');
    await act(async () => { dialogo.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(commentAction).toHaveBeenCalledWith({ federationId: 'fpp', action: 'hide', commentId: 'c1', reason: 'Expõe o telefone de um atleta' });
    commentAction.mockClear();
    await valor(container.querySelector('#cm-modo-reg'), 'closed');
    await clicar(botao('Salvar'));
    expect(commentAction).toHaveBeenCalledWith({ federationId: 'fpp', action: 'settings', kind: 'doc', targetId: 'reg', settings: { mode: 'closed', until_date: '' } });
  });

  it('consulta encerrada: diz que terminou e não oferece escrever', async () => {
    estado.q = lista({ signed_in: true, state: { open: false, mode: 'consultation', until_date: '2026-10-20', why: 'ended' } });
    await montar();
    expect(container.textContent).toContain('A consulta pública terminou.');
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('federação desligou e ninguém comentou: a seção some; falha mostra o erro, não o vazio', async () => {
    estado.q = lista({ count: 0, comments: [], state: { open: false, mode: 'open', why: 'disabled' } });
    await montar();
    expect(container.textContent).toBe('');
    estado.q = { isLoading: false, isError: true, refetch: vi.fn(), data: undefined };
    await montar();
    expect(container.textContent).toContain('Os comentários não carregaram agora');
    expect(container.textContent).not.toContain('Ninguém comentou');
  });
});
