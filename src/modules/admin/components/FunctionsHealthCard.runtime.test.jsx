/**
 * Teste de RUNTIME do cartão "Funções no ar" (Painel admin → Diagnóstico).
 * O que só a tela prova: a falha do deploy aparece com a linha de erro, a
 * função faltando aparece pelo nome, e uma leitura que FALHA não vira "tudo
 * publicado".
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { data: null, isLoading: false, isError: false, refetch: () => {} };

vi.mock('@/modules/admin/hooks/usePlatformUsers', () => ({
  useFunctionsHealth: () => estado,
}));

const { default: FunctionsHealthCard } = await import('./FunctionsHealthCard.jsx');

const ts = (ms) => ({ toMillis: () => ms });
let container;
let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.assign(estado, { data: null, isLoading: false, isError: false });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = () => act(() => { root.render(<FunctionsHealthCard />); });

describe('FunctionsHealthCard', () => {
  it('sem registro diz que ainda não há', () => {
    render();
    expect(container.textContent).toContain('Ainda não há registro');
    expect(container.textContent).not.toContain('Tudo publicado');
  });

  it('deploy que falhou e função faltando aparecem', () => {
    estado.data = {
      check: { at: ts(Date.now()), expected: 91, published: 90, missing: ['federationNational'] },
      deploy: { at: ts(Date.now()), ok: false, error: 'Error: Changing from an HTTPS function', last_ok_at: ts(Date.now() - 86400e3) },
    };
    render();
    expect(container.textContent).toContain('Precisa de atenção');
    expect(container.textContent).toContain('federationNational');
    expect(container.textContent).toContain('Error: Changing from an HTTPS function');
    expect(container.textContent).toContain('90 de 91');
  });

  it('tudo certo diz que está tudo publicado', () => {
    estado.data = { check: { at: ts(Date.now()), expected: 91, published: 91 }, deploy: { at: ts(Date.now()), ok: true } };
    render();
    expect(container.textContent).toContain('Tudo publicado');
  });

  it('leitura que falha não afirma nada', () => {
    estado.isError = true;
    render();
    expect(container.textContent).toContain('Não deu para ler o registro das funções');
    expect(container.textContent).not.toContain('Tudo publicado');
  });
});
