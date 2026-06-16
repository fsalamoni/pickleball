import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Verifica de ponta a ponta a renderização do botão conforme a flag,
// reavaliando os módulos (PWA_ENABLED é lido no load) a cada cenário.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function renderButton() {
  vi.resetModules();
  const { default: InstallAppButton } = await import('./InstallAppButton.jsx');
  return renderToStaticMarkup(React.createElement(InstallAppButton));
}

describe('InstallAppButton', () => {
  it('renderiza o botão "Baixar o app" quando VITE_PWA_ENABLED=true', async () => {
    vi.stubEnv('VITE_PWA_ENABLED', 'true');
    const html = await renderButton();
    expect(html).toContain('Baixar o app');
    expect(html).toMatch(/<button/);
  });

  it('não renderiza nada quando a flag está desligada', async () => {
    vi.stubEnv('VITE_PWA_ENABLED', 'false');
    const html = await renderButton();
    expect(html).toBe('');
  });
});
