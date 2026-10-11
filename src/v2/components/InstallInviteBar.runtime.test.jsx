import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const pwa = { available: true };
vi.mock('@/core/pwa/usePwaInstall', () => ({ usePwaInstall: () => pwa }));
vi.mock('@/components/InstallAppButton', () => ({ default: ({ label }) => <button type="button">{label}</button> }));
const { default: InstallInviteBar } = await import('./InstallInviteBar.jsx');

let host; let root;
beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); pwa.available = true; host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { React.act(() => root.unmount()); host.remove(); });
const render = () => React.act(() => root.render(<InstallInviteBar />));

describe('InstallInviteBar', () => {
  it('⭐ nada na 1ª visita; convida na 2ª; "Agora não" silencia', () => {
    render();
    expect(host.textContent).toBe('');

    window.sessionStorage.clear(); // outra aba/visita
    React.act(() => root.unmount()); root = createRoot(host);
    render();
    expect(host.textContent).toContain('Instale o PickleRush');
    expect(host.textContent).toContain('Instalar');

    React.act(() => { host.querySelector('button[aria-label="Agora não"]').click(); });
    expect(host.textContent).toBe('');
    expect(window.localStorage.getItem('picklerush:convite-instalar-dispensado')).toBeTruthy();
  });
  it('com o app instalado ou o PWA desligado, nada', () => {
    window.localStorage.setItem('picklerush:visitas', '5');
    pwa.available = false;
    render();
    expect(host.textContent).toBe('');
  });
});
