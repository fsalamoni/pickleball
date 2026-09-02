import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import KudosButton from './KudosButton.jsx';
import { KUDOS_TARGET_TYPE } from '../domain/kudos.js';

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
    root.render(<KudosButton {...props} />);
    setTimeout(resolve, 30);
  });
}

describe('KudosButton', () => {
  it('renderiza com targetType + targetId', async () => {
    await render({
      targetType: KUDOS_TARGET_TYPE.PROFILE,
      targetId: 'u1',
    });
    const btn = container.querySelector('[data-testid="kudos-button"]');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('data-target-type')).toBe('profile');
    expect(btn.getAttribute('data-target-id')).toBe('u1');
    expect(btn.getAttribute('data-given')).toBe('false');
  });

  it('given=true: estilo "ativo" (amber)', async () => {
    await render({ targetType: 'profile', targetId: 'u1', given: true });
    const btn = container.querySelector('[data-testid="kudos-button"]');
    expect(btn.getAttribute('data-given')).toBe('true');
    expect(btn.className).toMatch(/bg-amber/);
  });

  it('count visível quando > 0', async () => {
    await render({ targetType: 'profile', targetId: 'u1', count: 42 });
    expect(container.textContent).toContain('42');
  });

  it('count vazio quando = 0', async () => {
    await render({ targetType: 'profile', targetId: 'u1', count: 0 });
    // não deve mostrar "0" como número (mostra vazio)
    const btn = container.querySelector('[data-testid="kudos-button"]');
    expect(btn.textContent.replace(/\s/g, '')).toBe('');
  });

  it('click alterna estado (controlled)', async () => {
    const onToggle = vi.fn();
    await render({ targetType: 'profile', targetId: 'u1', onToggle });
    const btn = container.querySelector('[data-testid="kudos-button"]');
    btn.click();
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('click em estado dado: onToggle(false)', async () => {
    const onToggle = vi.fn();
    await render({ targetType: 'profile', targetId: 'u1', given: true, onToggle });
    const btn = container.querySelector('[data-testid="kudos-button"]');
    btn.click();
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('disabled: click não dispara callback', async () => {
    const onToggle = vi.fn();
    await render({ targetType: 'profile', targetId: 'u1', disabled: true, onToggle });
    const btn = container.querySelector('[data-testid="kudos-button"]');
    btn.click();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('size="lg" mostra label "kudos"', async () => {
    await render({ targetType: 'profile', targetId: 'u1', count: 5, size: 'lg' });
    expect(container.textContent).toContain('kudos');
  });
});
