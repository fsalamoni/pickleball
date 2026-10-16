import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { usePushNoAparelho, MENSAGEM_ABRIR_AVISO } from './usePushNoAparelho';

/** Monta o hook num componente de verdade; devolve como desmontar. */
function renderHook(usar) {
  function Sonda() { usar(); return null; }
  const div = document.createElement('div');
  const root = createRoot(div);
  act(() => { root.render(<Sonda />); });
  return { unmount: () => act(() => { root.unmount(); }) };
}

function swFalso() {
  const ouvintes = new Set();
  return {
    addEventListener: (_tipo, fn) => ouvintes.add(fn),
    removeEventListener: (_tipo, fn) => ouvintes.delete(fn),
    startMessages: vi.fn(),
    getRegistration: vi.fn(async () => undefined),
    enviar: (data) => ouvintes.forEach((fn) => fn({ data })),
    ouvintes,
  };
}

const original = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
afterEach(() => {
  if (original) Object.defineProperty(navigator, 'serviceWorker', original);
  else delete navigator.serviceWorker;
});

describe('usePushNoAparelho', () => {
  it('⭐ a notificação tocada com o app aberto navega, só para caminho de dentro do site', () => {
    const sw = swFalso();
    Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true });
    const navigate = vi.fn();
    const { unmount } = renderHook(() => usePushNoAparelho(null, navigate));
    expect(sw.startMessages).toHaveBeenCalled();
    sw.enviar({ tipo: MENSAGEM_ABRIR_AVISO, link: '/minhas-reservas#topo' });
    sw.enviar({ tipo: MENSAGEM_ABRIR_AVISO, link: '//golpe.example' });
    sw.enviar({ tipo: MENSAGEM_ABRIR_AVISO, link: '/\\golpe.example' });
    sw.enviar({ tipo: 'outra-coisa', link: '/x' });
    expect(navigate.mock.calls).toEqual([['/minhas-reservas#topo']]);
    unmount();
    expect(sw.ouvintes.size).toBe(0);
  });

  it('sem permissão de notificação, não baixa nem renova o push', () => {
    const sw = swFalso();
    Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true });
    renderHook(() => usePushNoAparelho({ uid: 'u1' }, vi.fn()));
    expect(sw.getRegistration).not.toHaveBeenCalled();
  });
});
