/**
 * O aviso chega com `?ancora=secao` e a URL passa a ter `#secao` — sem entrada
 * nova no histórico e sem perder os outros parâmetros.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, it, expect, afterEach } from 'vitest';
import { useAncoraDoAviso } from './useAncoraDoAviso';

function Onde() {
  useAncoraDoAviso();
  const l = useLocation();
  return <output>{`${l.pathname}${l.search}${l.hash}`}</output>;
}

let container, root;
afterEach(() => { act(() => root.unmount()); container.remove(); });

async function abrir(url) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter initialEntries={[url]}><Onde /></MemoryRouter>); });
  return container.textContent;
}

describe('useAncoraDoAviso', () => {
  it('?ancora=secao vira #secao', async () => {
    expect(await abrir('/arenas/a1?ancora=arena-planos')).toBe('/arenas/a1#arena-planos');
  });
  it('mantém os outros parâmetros', async () => {
    expect(await abrir('/arenas/a1?aba=planos&ancora=arena-planos')).toBe('/arenas/a1?aba=planos#arena-planos');
  });
  it('sem o parâmetro, não mexe na URL', async () => {
    expect(await abrir('/coaches/u1?marcar=1')).toBe('/coaches/u1?marcar=1');
  });
});
