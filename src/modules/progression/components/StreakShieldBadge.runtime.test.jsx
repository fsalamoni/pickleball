import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import StreakShieldBadge from './StreakShieldBadge';

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
    act(() => {
      root.render(node);
    });
    setTimeout(resolve, 20);
  });
}

describe('StreakShieldBadge', () => {
  it('loading state quando meta é null', async () => {
    await render(<StreakShieldBadge meta={null} />);
    expect(container.textContent).toContain('Carregando proteção');
  });

  it('mostra grace days', async () => {
    const meta = { graceDaysRemaining: 2, freezesAvailable: 0, vacationMode: false, comebackBonus: 0 };
    await render(<StreakShieldBadge meta={meta} />);
    expect(container.textContent).toContain('2 grace');
  });

  it('mostra freezes (singular e plural)', async () => {
    const meta = { graceDaysRemaining: 0, freezesAvailable: 1, vacationMode: false, comebackBonus: 0 };
    await render(<StreakShieldBadge meta={meta} />);
    expect(container.textContent).toContain('1 freeze');
  });

  it('mostra freezes (plural)', async () => {
    const meta = { graceDaysRemaining: 0, freezesAvailable: 3, vacationMode: false, comebackBonus: 0 };
    await render(<StreakShieldBadge meta={meta} />);
    expect(container.textContent).toContain('3 freezes');
  });

  it('mostra vacation mode', async () => {
    const meta = { graceDaysRemaining: 0, freezesAvailable: 0, vacationMode: true, comebackBonus: 0 };
    await render(<StreakShieldBadge meta={meta} />);
    expect(container.textContent).toContain('Férias ativas');
  });

  it('mostra comeback bonus', async () => {
    const meta = { graceDaysRemaining: 0, freezesAvailable: 0, vacationMode: false, comebackBonus: 200 };
    await render(<StreakShieldBadge meta={meta} />);
    expect(container.textContent).toContain('+200 comeback');
  });

  it('mostra estado vazio se nada ativo', async () => {
    const meta = { graceDaysRemaining: 0, freezesAvailable: 0, vacationMode: false, comebackBonus: 0 };
    await render(<StreakShieldBadge meta={meta} />);
    expect(container.textContent).toContain('Sem proteções ativas');
  });

  it('botão "usar freeze" chama onUseFreeze', async () => {
    const fn = vi.fn();
    const meta = { graceDaysRemaining: 0, freezesAvailable: 2, vacationMode: false, comebackBonus: 0 };
    await render(<StreakShieldBadge meta={meta} onUseFreeze={fn} />);
    const btn = container.querySelector('[data-testid="use-freeze-btn"]');
    expect(btn).toBeTruthy();
    act(() => btn.click());
    expect(fn).toHaveBeenCalled();
  });

  it('botão "usar freeze" NÃO aparece sem freezes', async () => {
    const fn = vi.fn();
    const meta = { graceDaysRemaining: 0, freezesAvailable: 0, vacationMode: false, comebackBonus: 0 };
    await render(<StreakShieldBadge meta={meta} onUseFreeze={fn} />);
    expect(container.querySelector('[data-testid="use-freeze-btn"]')).toBeNull();
  });

  it('botão "toggle vacation" alterna label', async () => {
    const fn = vi.fn();
    const meta1 = { graceDaysRemaining: 0, freezesAvailable: 0, vacationMode: false, comebackBonus: 0 };
    await render(<StreakShieldBadge meta={meta1} onToggleVacation={fn} />);
    expect(container.textContent).toContain('Entrar de férias');
    const meta2 = { ...meta1, vacationMode: true };
    await render(<StreakShieldBadge meta={meta2} onToggleVacation={fn} />);
    expect(container.textContent).toContain('Sair de férias');
  });
});
