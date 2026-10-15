/**
 * O seletor de idioma com bandeiras do cabeçalho: some com a flag desligada,
 * mostra a bandeira do idioma atual e troca pelo menu.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { disponivel: true, codigo: 'pt-BR', escolher: vi.fn() };
vi.mock('@/core/i18n/useLanguage', () => ({ useLanguage: () => estado }));

import { LanguageMenu } from './LanguageSwitcher';

let container; let root;
beforeEach(() => {
  Object.assign(estado, { disponivel: true, codigo: 'pt-BR', escolher: vi.fn() });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const render = (el) => act(() => { root.render(el); });

describe('LanguageMenu', () => {
  it('flag desligada: nada aparece', () => {
    estado.disponivel = false;
    render(<LanguageMenu />);
    expect(container.innerHTML).toBe('');
  });

  it('o botão diz o idioma atual e mostra a bandeira', () => {
    estado.codigo = 'es';
    render(<LanguageMenu />);
    const botao = container.querySelector('[data-dica="botao-idioma"]');
    expect(botao.getAttribute('aria-label')).toContain('Español');
    expect(botao.querySelector('svg')).not.toBeNull();
  });

  it('abre com o teclado, lista os três idiomas e troca', () => {
    render(<LanguageMenu />);
    const botao = container.querySelector('[data-dica="botao-idioma"]');
    act(() => {
      botao.focus();
      botao.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    const itens = [...document.querySelectorAll('[role="menuitem"]')];
    expect(itens.map((i) => i.textContent)).toEqual(['Português', 'English', 'Español']);
    expect(itens[0].getAttribute('aria-current')).toBe('true');
    act(() => itens[1].click());
    expect(estado.escolher).toHaveBeenCalledWith('en');
  });
});
