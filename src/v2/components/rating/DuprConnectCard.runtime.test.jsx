// @vitest-environment jsdom
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { config: null, linked: null };
const link = { mutate: vi.fn(), isPending: false };
const unlink = { mutate: vi.fn(), isPending: false };

vi.mock('@/modules/rating/hooks/useDuprLink', () => ({
  useDuprLink: () => ({ config: estado.config, linked: estado.linked, link, unlink }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import DuprConnectCard from './DuprConnectCard';

let host; let root;
const ok = (data) => ({ isPending: false, isError: false, data, refetch: vi.fn() });
const pintar = () => act(() => { root.render(<DuprConnectCard />); });
const botao = (texto) => [...host.querySelectorAll('button')].find((b) => b.textContent.includes(texto));

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  link.mutate.mockClear();
  unlink.mutate.mockClear();
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('DuprConnectCard', () => {
  it('não aparece com a conexão desligada', () => {
    estado.config = ok({ enabled: false });
    pintar();
    expect(host.textContent).toBe('');
  });

  it('sem credenciais no servidor, avisa que ainda não está disponível', () => {
    estado.config = ok({ enabled: true, configured: false });
    pintar();
    expect(host.textContent).toContain('ainda não está disponível');
  });

  it('sem vínculo, o login do DUPR só abre no iframe do site do DUPR', () => {
    estado.config = ok({ enabled: true, configured: true, ssoUrl: 'https://uat.dupr.gg/login-external-app/abc' });
    estado.linked = null;
    pintar();
    expect(host.querySelector('iframe')).toBeNull();
    act(() => botao('Conectar com o DUPR').click());
    expect(host.querySelector('iframe').getAttribute('src')).toBe('https://uat.dupr.gg/login-external-app/abc');
  });

  it('mensagem de outra origem não vincula nada', () => {
    estado.config = ok({ enabled: true, configured: true, ssoUrl: 'https://uat.dupr.gg/login-external-app/abc' });
    estado.linked = null;
    pintar();
    act(() => botao('Conectar com o DUPR').click());
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { origin: 'https://evil.example', data: { userToken: 'a', refreshToken: 'r' } }));
    });
    expect(link.mutate).not.toHaveBeenCalled();
  });

  it('com vínculo, mostra o selo, o ID e os ratings e permite desconectar', () => {
    estado.config = ok({ enabled: true, configured: true, ssoUrl: 'https://uat.dupr.gg/x' });
    estado.linked = { duprId: 'ABC123', ratings: { doubles: 3.875, singles: null }, entitlements: ['BASIC_L1'] };
    pintar();
    expect(host.textContent).toContain('Verificada pelo DUPR');
    expect(host.textContent).toContain('ABC123');
    expect(host.textContent).toContain('3.875');
    expect(host.textContent).toContain('NR');
    act(() => botao('Desconectar').click());
    expect(unlink.mutate).toHaveBeenCalled();
  });
});
