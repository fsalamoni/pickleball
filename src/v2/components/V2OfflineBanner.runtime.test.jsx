import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import V2OfflineBanner from './V2OfflineBanner.jsx';

let host; let root;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { React.act(() => root.unmount()); host.remove(); vi.useRealTimers(); });

function setOnline(v) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => v });
  React.act(() => { window.dispatchEvent(new Event(v ? 'online' : 'offline')); });
}

describe('V2OfflineBanner', () => {
  it('⭐ nada com conexão; avisa sem conexão; ao voltar diz "tentando de novo" e some', () => {
    vi.useFakeTimers();
    setOnline(true);
    React.act(() => root.render(<V2OfflineBanner />));
    expect(host.textContent).toBe('');

    setOnline(false);
    expect(host.textContent).toContain('sem conexão');
    expect(host.querySelector('[role="status"]')).toBeTruthy();

    setOnline(true);
    expect(host.textContent).toContain('Tentando de novo');
    React.act(() => { vi.advanceTimersByTime(5000); });
    expect(host.textContent).toBe('');
  });
});
