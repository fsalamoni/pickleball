/**
 * Comportamento do card colapsável: alterna, LEMBRA por usuário e nunca deixa
 * um clique numa ação recolher a seção.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const auth = { user: { uid: 'ana' } };
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));

const { default: V2CollapsibleCard } = await import('./V2CollapsibleCard.jsx');

let container, root;

beforeEach(() => {
  window.localStorage.clear();
  auth.user = { uid: 'ana' };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(props = {}) {
  act(() => {
    root.render(
      <V2CollapsibleCard sectionId="teste:secao" title="Jogos" {...props}>
        <p data-testid="corpo">conteúdo</p>
      </V2CollapsibleCard>,
    );
  });
}

const toggleBtn = () => container.querySelector('button[aria-expanded]');
const body = () => container.querySelector('[data-testid="corpo"]');
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

describe('V2CollapsibleCard', () => {
  it('abre por padrão e recolhe ao clicar no cabeçalho', () => {
    render();
    expect(body()).not.toBeNull();
    expect(toggleBtn().getAttribute('aria-expanded')).toBe('true');

    click(toggleBtn());
    expect(body()).toBeNull();
    expect(toggleBtn().getAttribute('aria-expanded')).toBe('false');
  });

  it('respeita defaultCollapsed na primeira visita', () => {
    render({ defaultCollapsed: true });
    expect(body()).toBeNull();
  });

  it('LEMBRA o que a pessoa deixou: reabrir a tela mantém recolhido', () => {
    render();
    click(toggleBtn());
    expect(body()).toBeNull();

    // Remonta como se fosse uma nova visita.
    act(() => root.unmount());
    root = createRoot(container);
    render();
    expect(body()).toBeNull();
  });

  it('a preferência salva vence o defaultCollapsed', () => {
    render({ defaultCollapsed: true });
    click(toggleBtn());          // a pessoa ABRIU
    act(() => root.unmount());
    root = createRoot(container);
    render({ defaultCollapsed: true });
    expect(body()).not.toBeNull(); // continua aberta, apesar do padrão
  });

  it('outro usuário no mesmo navegador não herda a preferência', () => {
    render();
    click(toggleBtn());
    expect(body()).toBeNull();

    act(() => root.unmount());
    auth.user = { uid: 'bruno' };
    root = createRoot(container);
    render();
    expect(body()).not.toBeNull();
  });

  it('seções diferentes são independentes', () => {
    render({ sectionId: 'teste:a' });
    click(toggleBtn());
    act(() => root.unmount());
    root = createRoot(container);
    render({ sectionId: 'teste:b' });
    expect(body()).not.toBeNull();
  });

  it('clicar numa AÇÃO do cabeçalho não recolhe a seção', () => {
    const onAction = vi.fn();
    render({
      actions: <button type="button" data-testid="acao" onClick={onAction}>Sortear</button>,
    });
    click(container.querySelector('[data-testid="acao"]'));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(body()).not.toBeNull();
  });

  it('mostra o resumo só quando recolhido', () => {
    render({ summary: '12 jogos a jogar' });
    expect(container.textContent).not.toContain('12 jogos a jogar');
    click(toggleBtn());
    expect(container.textContent).toContain('12 jogos a jogar');
  });

  it('o botão aponta para o corpo via aria-controls', () => {
    render();
    const alvo = toggleBtn().getAttribute('aria-controls');
    expect(alvo).toBeTruthy();
    // `useId` gera ids com ':' — o jsdom não expõe CSS.escape, então buscamos
    // pelo atributo em vez de por seletor de id.
    expect(container.querySelector(`[id="${alvo}"]`)).not.toBeNull();
  });

  it('sem usuário autenticado ainda funciona (escopo anônimo)', () => {
    auth.user = null;
    render();
    click(toggleBtn());
    expect(body()).toBeNull();
  });
});
