import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import TierBadge from './TierBadge.jsx';
import { TIERS, tierFromXp } from '../domain/tiers.js';

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
});

function render(props) {
  return new Promise((resolve) => {
    root.render(<TierBadge {...props} />);
    setTimeout(resolve, 30);
  });
}

describe('TierBadge', () => {
  it('renderiza com nome e ícone do tier baseado no XP', async () => {
    await render({ xp: 0 });
    const badge = container.querySelector('[data-testid="tier-badge"]');
    expect(badge).toBeTruthy();
    expect(badge.getAttribute('data-tier')).toBe('Calouro');
    expect(badge.textContent).toContain('🌱');
    expect(badge.textContent).toContain('Calouro');
  });

  it('XP 3020 (Flavio) = Aprendiz', async () => {
    await render({ xp: 3020 });
    expect(container.querySelector('[data-testid="tier-badge"]').getAttribute('data-tier')).toBe('Aprendiz');
  });

  it('XP 100000 = Imortal (com Crown)', async () => {
    await render({ xp: 100000 });
    const badge = container.querySelector('[data-testid="tier-badge"]');
    expect(badge.getAttribute('data-tier')).toBe('Imortal');
    expect(badge.textContent).toContain('🔥');
    // Crown presente
    expect(badge.querySelector('svg')).toBeTruthy();
  });

  it('aceita tier prop diretamente (sem XP)', async () => {
    const expert = TIERS.find((t) => t.name === 'Expert');
    await render({ tier: expert });
    expect(container.querySelector('[data-testid="tier-badge"]').getAttribute('data-tier')).toBe('Expert');
  });

  it('showName=false esconde nome', async () => {
    await render({ xp: 0, showName: false });
    expect(container.textContent).not.toContain('Calouro');
    expect(container.textContent).toContain('🌱');
  });

  it('showIcon=false esconde ícone', async () => {
    await render({ xp: 0, showIcon: false });
    expect(container.textContent).toContain('Calouro');
    expect(container.textContent).not.toContain('🌱');
  });

  it('size="lg" muda o padding', async () => {
    await render({ xp: 0, size: 'lg' });
    const badge = container.querySelector('[data-testid="tier-badge"]');
    expect(badge.className).toMatch(/text-sm/);
  });

  it('cada tier é distinto (renderiza diferente)', async () => {
    for (const t of TIERS) {
      // cria novo container/root pra cada tier (evita "Cannot update unmounted root")
      const localContainer = document.createElement('div');
      document.body.appendChild(localContainer);
      const localRoot = createRoot(localContainer);
      await new Promise((resolve) => {
        localRoot.render(<TierBadge tier={t} />);
        setTimeout(resolve, 30);
      });
      const badge = localContainer.querySelector('[data-testid="tier-badge"]');
      expect(badge).toBeTruthy();
      expect(badge.getAttribute('data-tier')).toBe(t.name);
      expect(badge.getAttribute('data-tier-rank')).toBe(String(t.tier));
      localRoot.unmount();
      localContainer.remove();
    }
  });
});
