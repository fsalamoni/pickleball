/**
 * `/r/:code` é o destino do link de convite. Antes a rota não existia e todo
 * convite compartilhado caía no 404 do app.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const flag = { value: true };
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => flag.value }));

const auth = { isAuthenticated: false, isLoading: false };
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));

const rota = { code: 'AB2CD3EF' };
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ code: rota.code }) };
});

import V2ReferralLanding from './V2ReferralLanding.jsx';

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  window.localStorage.clear();
  flag.value = true;
  auth.isAuthenticated = false;
  auth.isLoading = false;
  rota.code = 'AB2CD3EF';
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

async function render() {
  await act(async () => {
    root.render(<MemoryRouter><V2ReferralLanding /></MemoryRouter>);
  });
}

const guardado = () => window.localStorage.getItem('picklerush.referral.pending');

describe('V2ReferralLanding · visitante', () => {
  it('guarda o código do convite para sobreviver ao login social', async () => {
    await render();
    expect(guardado()).toContain('AB2CD3EF');
  });

  it('mostra o código e o caminho para criar conta', async () => {
    await render();
    expect(container.textContent).toContain('AB2CD3EF');
    expect(container.querySelector('a[href="/login"]')).toBeTruthy();
  });

  it('código inválido não é guardado, mas a página não vira beco sem saída', async () => {
    rota.code = 'xx';
    await render();
    expect(guardado()).toBeNull();
    expect(container.textContent).toContain('não é válido');
    expect(container.querySelector('a[href="/login"]')).toBeTruthy();
  });
});

describe('V2ReferralLanding · flag desligada', () => {
  it('não guarda nada quando a gamificação está OFF', async () => {
    flag.value = false;
    await render();
    expect(guardado()).toBeNull();
  });
});

describe('V2ReferralLanding · já autenticado', () => {
  it('não fica preso: redireciona quem já tem conta', async () => {
    auth.isAuthenticated = true;
    await render();
    // Navigate não renderiza conteúdo próprio
    expect(container.textContent).not.toContain('Criar minha conta');
  });
});
