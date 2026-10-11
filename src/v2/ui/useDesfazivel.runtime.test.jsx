import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const toastMock = vi.fn();
vi.mock('sonner', () => ({ toast: (...a) => toastMock(...a) }));
const { useDesfazivel } = await import('./useDesfazivel.js');

let host; let root; let api;
function Sonda() { api = useDesfazivel(); return <span>{[...api.ocultos].join(',')}</span>; }
beforeEach(() => { vi.useFakeTimers(); toastMock.mockClear(); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); React.act(() => root.render(<Sonda />)); });
afterEach(() => { React.act(() => root.unmount()); host.remove(); vi.useRealTimers(); });

describe('useDesfazivel', () => {
  it('⭐ esconde na hora, grava só depois da janela; "Desfazer" cancela e o item volta', async () => {
    const executar = vi.fn(async () => {});
    React.act(() => { api.agendar('p1', 'Removido.', executar); });
    expect(host.textContent).toBe('p1');
    expect(executar).not.toHaveBeenCalled();
    const opts = toastMock.mock.calls[0][1];
    expect(opts.action.label).toBe('Desfazer');
    React.act(() => { opts.action.onClick(); });
    expect(host.textContent).toBe('');
    await React.act(async () => { vi.advanceTimersByTime(10_000); });
    expect(executar).not.toHaveBeenCalled();
  });
  it('sem desfazer, grava ao fim da janela; ao sair da página, grava na hora', async () => {
    const a = vi.fn(async () => {});
    const b = vi.fn(async () => {});
    React.act(() => { api.agendar('a', 'x', a); });
    await React.act(async () => { vi.advanceTimersByTime(6000); });
    expect(a).toHaveBeenCalledTimes(1);
    React.act(() => { api.agendar('b', 'y', b); });
    React.act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(b).toHaveBeenCalledTimes(1);
  });
});
