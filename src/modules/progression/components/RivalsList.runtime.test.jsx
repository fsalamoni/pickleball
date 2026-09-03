import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import RivalsList from './RivalsList.jsx';

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

async function render(props = {}) {
  await act(async () => { root.render(<RivalsList {...props} />); });
}

const rivais = [
  { opponent: 'Ana Prado', played: 5, wins: 3, losses: 2 },
  { opponent: 'Bruno Lima', played: 4, wins: 1, losses: 3 },
  { opponent: 'Caio Souza', played: 2, wins: 1, losses: 1 },
];

describe('RivalsList', () => {
  it('lista um item por rival', async () => {
    await render({ rivals: rivais });
    expect(container.querySelectorAll('[data-testid="rival-item"]')).toHaveLength(3);
  });

  it('mostra o nome e o retrospecto', async () => {
    await render({ rivals: rivais });
    expect(container.textContent).toContain('Ana Prado');
    expect(container.textContent).toContain('5 confrontos');
    expect(container.textContent).toContain('3V 2D');
  });

  it('usa singular com um confronto só', async () => {
    await render({ rivals: [{ opponent: 'X', played: 1, wins: 1, losses: 0 }] });
    expect(container.textContent).toContain('1 confronto');
    expect(container.textContent).not.toContain('1 confrontos');
  });

  it('mostra saldo positivo com sinal', async () => {
    await render({ rivals: [rivais[0]] });
    expect(container.textContent).toContain('+1');
  });

  it('mostra saldo negativo', async () => {
    await render({ rivals: [rivais[1]] });
    expect(container.textContent).toContain('-2');
  });

  it('estado vazio explica o que é um rival', async () => {
    await render({ rivals: [] });
    expect(container.textContent).toContain('Ainda sem rivais');
    expect(container.textContent).toContain('duas vezes');
  });

  it('mostra esqueleto enquanto carrega', async () => {
    await render({ isLoading: true });
    expect(container.querySelector('[data-testid="rivals-list"]')).toBeNull();
  });

  it('é somente leitura — rivalidade não se declara', async () => {
    await render({ rivals: rivais });
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});
