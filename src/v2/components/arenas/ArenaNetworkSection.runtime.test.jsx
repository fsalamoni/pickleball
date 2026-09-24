/**
 * "Outras unidades da rede" na página da arena.
 *
 * O que protege:
 *  1. ⭐ o atleta vê as OUTRAS unidades (a própria não se repete), com link;
 *  2. unidade que não carregou ou foi arquivada não vira link para o nada;
 *  3. rede só com esta unidade, módulo desligado ou ninguém logado: nada — e
 *     sem consulta;
 *  4. ⭐ não promete que o plano vale nas outras unidades.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const LIGADOS = new Set();
const estado = { uid: 'u1', rede: null, arenas: {} };
const consultas = [];

vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: estado.uid ? { uid: estado.uid } : null }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id), isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaNetwork: (arenaId) => {
    consultas.push(arenaId);
    return { data: arenaId ? estado.rede : undefined };
  },
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArena: (id) => (estado.arenas[id] === 'erro'
    ? { data: undefined, isError: true }
    : { data: estado.arenas[id], isError: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaPrefetch', () => ({ useArenaPrefetch: () => () => {} }));

const { default: ArenaNetworkSection } = await import('./ArenaNetworkSection.jsx');
const { ARENA_MODULE_ID } = await import('@/modules/arenas/domain/modules');

let container, root;
beforeEach(() => {
  LIGADOS.clear();
  LIGADOS.add(ARENA_MODULE_ID.MULTI_UNIT);
  LIGADOS.add(ARENA_MODULE_ID.MULTI_UNIT_NETWORK);
  estado.uid = 'u1';
  estado.rede = { id: 'r1', name: 'Pickle SP', arenas: ['a1', 'a2', 'a3'] };
  estado.arenas = {
    a2: { id: 'a2', name: 'Unidade Centro', city: 'São Paulo', neighborhood: 'Centro' },
    a3: { id: 'a3', name: 'Unidade Sul', city: 'São Paulo' },
  };
  consultas.length = 0;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render() {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ArenaNetworkSection arena={{ id: 'a1', name: 'Unidade Norte' }} />
      </MemoryRouter>,
    );
  });
}

describe('Outras unidades da rede', () => {
  it('⭐ mostra as OUTRAS unidades, com link para cada uma', async () => {
    await render();
    expect(container.textContent).toContain('Outras unidades da rede');
    expect(container.textContent).toContain('Pickle SP');
    expect(container.textContent).toContain('Unidade Centro');
    expect(container.textContent).toContain('Centro · São Paulo');
    expect(container.textContent).toContain('Unidade Sul');
    expect(container.textContent).not.toContain('Unidade Norte');
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/arenas/a2', '/arenas/a3']);
  });

  it('unidade que não carregou ou foi arquivada some da lista', async () => {
    estado.arenas.a2 = 'erro';
    estado.arenas.a3 = { id: 'a3', name: 'Fechada', archived: true };
    estado.rede.arenas = ['a1', 'a2', 'a3', 'a4'];
    estado.arenas.a4 = { id: 'a4', name: 'Unidade Leste' };
    await render();
    expect(container.textContent).not.toContain('Fechada');
    expect([...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['/arenas/a4']);
  });

  it('⭐ não promete que o plano vale nas outras unidades', async () => {
    await render();
    expect(container.textContent).not.toMatch(/plano vale|vale em todas/i);
  });

  it('rede só com esta unidade: nada', async () => {
    estado.rede.arenas = ['a1'];
    await render();
    expect(container.innerHTML).toBe('');
  });

  it('sem rede: nada', async () => {
    estado.rede = null;
    await render();
    expect(container.innerHTML).toBe('');
  });

  it('módulo de rede desligado: nada, e a consulta não sai', async () => {
    LIGADOS.delete(ARENA_MODULE_ID.MULTI_UNIT_NETWORK);
    await render();
    expect(container.innerHTML).toBe('');
    expect(consultas.every((id) => id === null)).toBe(true);
  });

  it('ninguém logado: nada, e a consulta não sai (a regra só deixa conta logada ler)', async () => {
    estado.uid = null;
    await render();
    expect(container.innerHTML).toBe('');
    expect(consultas.every((id) => id === null)).toBe(true);
  });
});
