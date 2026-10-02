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
  it('sem código persistido, mostra placeholder e não inventa um código', async () => {
    await render({ origin: 'https://picklerush.web.app' });
    // nada de código aleatório: um código gerado no render não pertence a
    // ninguém e nenhuma indicação feita com ele seria creditada
    expect(container.querySelector('[data-testid="referral-code"]')).toBeNull();
    expect(container.querySelector('[data-testid="referral-code-loading"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="referral-url"]')).toBeNull();
  });

  it('sem código, copiar e compartilhar ficam desabilitados', async () => {
    await render({ origin: 'https://picklerush.web.app' });
    const botoes = [...container.querySelectorAll('button:not([data-term])')]; // o "?" da explicação não depende de código
    expect(botoes.length).toBeGreaterThan(0);
    expect(botoes.every((b) => b.disabled)).toBe(true);
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

  it('mostra quantos se cadastraram pelo código', async () => {
    await render({ code: 'ABC23456', origin: 'https://x.com', referralsCount: 3 });
    expect(container.textContent).toContain('3 cadastrados');
  });

  it('mostra singular para 1 referral', async () => {
    await render({ code: 'ABC23456', origin: 'https://x.com', referralsCount: 1 });
    expect(container.textContent).toContain('1 cadastrado');
    expect(container.textContent).not.toContain('1 cadastrados');
  });

  it('🐞 diz o que o convite rende DE VERDADE (o passo do roteiro e a conquista) — não promete XP que nada credita', async () => {
    await render({ code: 'ABC23456', origin: 'https://x.com' });
    const texto = container.querySelector('[data-testid="referral-benefits"]').textContent;
    expect(texto).toContain('Convide um amigo');
    expect(texto).toContain('50 XP');
    expect(texto).toContain('Embaixador');
    expect(texto).toContain('500 XP de bônus');
    // a grade antiga prometia +50/+200/+500 de XP por cadastro, 5+ jogos e torneio; nada disso era creditado
    expect(container.textContent).not.toMatch(/5\+ jogos|1 torneio|\+200|rende XP para vocês dois/);
  });
});
