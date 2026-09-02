import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ReferralCard from './ReferralCard.jsx';

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
    root.render(<ReferralCard {...props} />);
    setTimeout(resolve, 30);
  });
}

describe('ReferralCard', () => {
  it('renderiza com código gerado quando não passado', async () => {
    await render({ origin: 'https://picklerush.web.app' });
    const code = container.querySelector('[data-testid="referral-code"]');
    expect(code).toBeTruthy();
    expect(code.textContent.replace(/\s/g, '')).toHaveLength(8);
  });

  it('renderiza com código passado', async () => {
    await render({ code: 'ABC23456', origin: 'https://x.com' });
    const code = container.querySelector('[data-testid="referral-code"]');
    expect(code.textContent).toContain('ABC2');
    expect(code.textContent).toContain('3456');
  });

  it('URL contém o código', async () => {
    await render({ code: 'ABC23456', origin: 'https://x.com' });
    const url = container.querySelector('[data-testid="referral-url"]');
    expect(url.textContent).toContain('/r/ABC23456');
  });

  it('botão de copiar dispara onCopy', async () => {
    const onCopy = vi.fn();
    await render({ code: 'ABC23456', origin: 'https://x.com', onCopy });
    const copyBtn = container.querySelector('button[aria-label*="Copiar"]');
    copyBtn.click();
    expect(onCopy).toHaveBeenCalledWith('ABC23456');
  });

  it('mostra contagem de referrals ativos', async () => {
    await render({ code: 'ABC23456', origin: 'https://x.com', referralsCount: 3 });
    expect(container.textContent).toContain('3 ativos');
  });

  it('mostra singular para 1 referral', async () => {
    await render({ code: 'ABC23456', origin: 'https://x.com', referralsCount: 1 });
    expect(container.textContent).toContain('1 ativo');
  });

  it('mostra 3 recompensas (signup, 5+ jogos, 1 torneio)', async () => {
    await render({ code: 'ABC23456', origin: 'https://x.com' });
    expect(container.textContent).toContain('Signup');
    expect(container.textContent).toContain('5+ jogos');
    expect(container.textContent).toContain('1 torneio');
    // +50, +200, +500
    expect(container.textContent).toContain('+50');
    expect(container.textContent).toContain('+200');
    expect(container.textContent).toContain('+500');
  });
});
