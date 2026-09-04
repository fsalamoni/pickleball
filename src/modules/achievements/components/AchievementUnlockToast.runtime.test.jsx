/**
 * Teste de RUNTIME do AchievementUnlockToast.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AchievementUnlockToast from './AchievementUnlockToast.jsx';

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
  container = null;
  root = null;
  vi.useRealTimers();
});

function render(props) {
  return new Promise((resolve) => {
    root.render(<AchievementUnlockToast {...props} />);
    setTimeout(resolve, 50);
  });
}

const ach = {
  id: 'a1',
  name: 'Primeira vitória',
  description: 'Venceu o primeiro jogo.',
  family: 'career',
  rarity: 'uncommon',
  icon: '🎉',
  shareable: true,
  xpBonus: 50,
};

describe('AchievementUnlockToast', () => {
  it('renderiza nome, descrição, badge de raridade, XP bônus', async () => {
    await render({ achievement: ach, onClose: vi.fn() });
    const toast = container.querySelector('[data-testid="achievement-unlock-toast"]');
    expect(toast).toBeTruthy();
    expect(toast.getAttribute('data-rarity')).toBe('uncommon');
    expect(toast.textContent).toContain('Primeira vitória');
    expect(toast.textContent).toContain('Venceu o primeiro jogo');
    expect(toast.textContent).toContain('+50 XP');
  });

  it('não renderiza nada se achievement=null', async () => {
    await render({ achievement: null, onClose: vi.fn() });
    expect(container.querySelector('[data-testid="achievement-unlock-toast"]')).toBeNull();
  });

  it('lendário: tem ring amber (visual especial)', async () => {
    await render({
      achievement: { ...ach, rarity: 'legendary' },
      onClose: vi.fn(),
    });
    const toast = container.querySelector('[data-testid="achievement-unlock-toast"]');
    // o ring amber fica no inner div, não no wrapper
    const inner = toast.firstElementChild;
    expect(inner.className).toMatch(/ring-amber/);
  });

  it('botão de fechar dispara onClose', async () => {
    const onClose = vi.fn();
    await render({ achievement: ach, onClose });
    const closeBtn = container.querySelector('button[aria-label*="Fechar"]');
    closeBtn.click();
    // onClose é chamado após animação de saída (220ms)
    await new Promise((r) => setTimeout(r, 300));
    expect(onClose).toHaveBeenCalled();
  });

  it('botão de share aparece só se shareable + onShare', async () => {
    await render({ achievement: ach, onClose: vi.fn() });
    // shareable=true + onShare undefined → botão não renderiza
    expect(container.querySelector('button:has(svg) [class*="bg-acid"]')).toBeNull();
  });

  it('botão de share dispara onShare', async () => {
    const onShare = vi.fn();
    await render({ achievement: ach, onClose: vi.fn(), onShare });
    // Encontra o botão que contém "Compartilhar"
    const buttons = container.querySelectorAll('button');
    let shareBtn = null;
    buttons.forEach((b) => { if (b.textContent.includes('Compartilhar')) shareBtn = b; });
    expect(shareBtn).toBeTruthy();
    shareBtn.click();
    expect(onShare).toHaveBeenCalledWith(ach);
  });

  it('auto-dismiss após autoCloseMs', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    root.render(<AchievementUnlockToast achievement={ach} onClose={onClose} autoCloseMs={1000} />);
    // avança o tempo
    await vi.advanceTimersByTimeAsync(1300);
    // onClose foi chamado após o setTimeout interno (220ms depois)
    expect(onClose).toHaveBeenCalled();
  });

  it('autoCloseMs=0 desabilita auto-dismiss', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    root.render(<AchievementUnlockToast achievement={ach} onClose={onClose} autoCloseMs={0} />);
    await vi.advanceTimersByTimeAsync(60000);
    expect(onClose).not.toHaveBeenCalled();
  });
});
