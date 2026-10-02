import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Radix mede o balão com ResizeObserver, que o jsdom não tem.
globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

import TermHint, { TermNote } from './TermHint.jsx';

let container; let root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ''; });
const render = (ui) => act(async () => { root.render(<MemoryRouter>{ui}</MemoryRouter>); });

describe('TermHint', () => {
  it('é um botão com nome acessível ("O que é Tier?") e o balão começa fechado', async () => {
    await render(<TermHint term="tier" />);
    const b = container.querySelector('button[data-term="tier"]');
    expect(b.getAttribute('aria-label')).toBe('O que é Tier?');
    expect(document.querySelector('[data-testid="term-hint"]')).toBeNull();
  });

  it('tocar abre o balão com a explicação curta e o link para o glossário', async () => {
    await render(<TermHint term="tier" />);
    await act(async () => { container.querySelector('button[data-term="tier"]').click(); });
    const balao = document.querySelector('[data-testid="term-hint"]');
    expect(balao).toBeTruthy();
    expect(balao.textContent).toContain('A faixa da sua jornada');
    const link = balao.querySelector('a');
    expect(link.getAttribute('href')).toBe('/gamification/como-funciona?termo=tier');
    expect(link.textContent).toContain('Entender melhor');
  });

  it('funciona fora de um roteador (um "?" nunca derruba a tela que o hospeda)', async () => {
    await act(async () => { root.render(<TermHint term="temporada" />); });
    await act(async () => { container.querySelector('button[data-term="temporada"]').click(); });
    const link = document.querySelector('[data-testid="term-hint"] a');
    expect(link.getAttribute('href')).toBe('/gamification/como-funciona?termo=temporada');
  });

  it('termo que não existe não desenha nada (nunca um "?" que não explica)', async () => {
    await render(<TermHint term="nao-existe" />);
    expect(container.querySelector('button')).toBeNull();
  });

  it('fecha com Esc', async () => {
    await render(<TermHint term="xp" />);
    await act(async () => { container.querySelector('button[data-term="xp"]').click(); });
    expect(document.querySelector('[data-testid="term-hint"]')).toBeTruthy();
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(document.querySelector('[data-testid="term-hint"]')).toBeNull();
  });
});

describe('TermNote', () => {
  it('mostra a explicação à vista, com o caminho para o texto completo', async () => {
    await render(<TermNote term="conquistas" />);
    const nota = container.querySelector('[data-testid="term-note"]');
    expect(nota.textContent).toContain('Marcos reais da sua trajetória');
    expect(nota.querySelector('a').getAttribute('href')).toBe('/gamification/como-funciona?termo=conquistas');
  });

  it('termo desconhecido não desenha nada', async () => {
    await render(<TermNote term="nao-existe" />);
    expect(container.querySelector('[data-testid="term-note"]')).toBeNull();
  });
});
