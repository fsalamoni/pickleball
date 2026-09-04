import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import GamificationErrorBoundary from './GamificationErrorBoundary';

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  // silencia console.error do React
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  container = null;
  root = null;
  console.error.mockRestore?.();
});

function Boom() { throw new Error('mock crash'); }
function Ok() { return <div data-testid="ok">ok</div>; }

function render(node) {
  return new Promise((resolve) => {
    act(() => { root.render(node); });
    setTimeout(resolve, 30);
  });
}

describe('GamificationErrorBoundary', () => {
  it('renderiza children quando não há erro', async () => {
    await render(
      <GamificationErrorBoundary>
        <Ok />
      </GamificationErrorBoundary>,
    );
    expect(container.querySelector('[data-testid="ok"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="gamification-error-boundary"]')).toBeNull();
  });

  it('mostra fallback quando filho joga', async () => {
    await render(
      <GamificationErrorBoundary>
        <Boom />
      </GamificationErrorBoundary>,
    );
    expect(container.querySelector('[data-testid="gamification-error-boundary"]')).toBeTruthy();
    expect(container.textContent).toContain('Ops, algo deu errado');
  });

  it('botão retry reseta o erro', async () => {
    let shouldThrow = true;
    function Conditional() {
      if (shouldThrow) throw new Error('boom');
      return <div data-testid="ok2">recovered</div>;
    }
    await render(
      <GamificationErrorBoundary>
        <Conditional />
      </GamificationErrorBoundary>,
    );
    expect(container.textContent).toContain('Ops, algo deu errado');
    const btn = container.querySelector('[data-testid="gamification-retry-btn"]');
    expect(btn).toBeTruthy();
    shouldThrow = false;
    act(() => btn.click());
    await new Promise((r) => setTimeout(r, 30));
    expect(container.querySelector('[data-testid="ok2"]')).toBeTruthy();
  });

  it('fallback tem role=alert e aria-live=assertive', async () => {
    await render(
      <GamificationErrorBoundary>
        <Boom />
      </GamificationErrorBoundary>,
    );
    const fb = container.querySelector('[data-testid="gamification-error-boundary"]');
    expect(fb.getAttribute('role')).toBe('alert');
    expect(fb.getAttribute('aria-live')).toBe('assertive');
  });
});
