import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import MissionCompleteToast from './MissionCompleteToast';

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  container = null;
  root = null;
});

function render(node) {
  return new Promise((resolve) => {
    act(() => { root.render(node); });
    setTimeout(resolve, 20);
  });
}

describe('MissionCompleteToast', () => {
  it('não renderiza quando mission=null', async () => {
    await render(<MissionCompleteToast mission={null} onClose={() => {}} />);
    expect(container.querySelector('[data-testid="mission-complete-toast"]')).toBeNull();
  });

  it('renderiza com título + XP + bônus', async () => {
    const mission = { id: 'm1', title: 'Jogue 1 partida', xp: 30, bonus: 15 };
    await render(<MissionCompleteToast mission={mission} onClose={() => {}} />);
    const toast = container.querySelector('[data-testid="mission-complete-toast"]');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toContain('Jogue 1 partida');
    expect(toast.textContent).toContain('+30 XP');
    expect(toast.textContent).toContain('bônus 15');
  });

  it('sem bônus se for 0', async () => {
    const mission = { id: 'm1', title: 'Jogue', xp: 30, bonus: 0 };
    await render(<MissionCompleteToast mission={mission} onClose={() => {}} />);
    expect(container.textContent).not.toContain('bônus');
  });

  it('botão X chama onClose', async () => {
    const onClose = vi.fn();
    const mission = { id: 'm1', title: 't', xp: 10, bonus: 5 };
    await render(<MissionCompleteToast mission={mission} onClose={onClose} />);
    const btn = container.querySelector('button[aria-label="Fechar"]');
    expect(btn).toBeTruthy();
    act(() => btn.click());
    expect(onClose).toHaveBeenCalled();
  });

  it('auto-dismiss após autoCloseMs', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const mission = { id: 'm1', title: 't', xp: 10, bonus: 0 };
    await act(async () => {
      root.render(<MissionCompleteToast mission={mission} onClose={onClose} autoCloseMs={100} />);
    });
    expect(onClose).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(150); });
    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('renderiza com diferentes missões (transição AnimatePresence)', async () => {
    const m1 = { id: 'm1', title: 'A', xp: 10, bonus: 0 };
    const m2 = { id: 'm2', title: 'B', xp: 20, bonus: 0 };
    await render(<MissionCompleteToast mission={m1} onClose={() => {}} />);
    expect(container.textContent).toContain('A');
    await render(<MissionCompleteToast mission={m2} onClose={() => {}} />);
    expect(container.textContent).toContain('B');
  });
});
