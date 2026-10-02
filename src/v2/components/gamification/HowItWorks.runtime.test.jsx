import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
const mods = { off: new Set() };
vi.mock('@/modules/progression/hooks/useGamificationConfig', async () => {
  const { normalizeGamificationConfig } = await import('@/modules/progression/domain/gamificationConfig');
  return { useGamificationConfig: () => ({ config: normalizeGamificationConfig(null), isModuleOn: (id) => !mods.off.has(id) }) };
});

import HowItWorks from './HowItWorks.jsx';

let container; let root;
beforeEach(() => { window.localStorage.clear(); mods.off = new Set(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (tab) => act(async () => { root.render(<MemoryRouter><HowItWorks tab={tab} /></MemoryRouter>); });

describe('HowItWorks', () => {
  it('abre na primeira visita, com as frases da aba e os termos como links', async () => {
    await render('jornada');
    const lista = container.querySelector('[data-testid="como-funciona-jornada"]');
    expect(lista.querySelectorAll('li').length).toBeGreaterThanOrEqual(3);
    const termos = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(termos).toContain('/gamification/como-funciona?termo=xp');
    expect(termos).toContain('/gamification/como-funciona');
  });

  it('lembra, por pessoa, que foi recolhido — e recolhido ainda diz o que é', async () => {
    await render('missoes');
    const botao = container.querySelector('button[aria-expanded]');
    await act(async () => { botao.click(); });
    expect(container.querySelector('[data-testid="como-funciona-missoes"]')).toBeNull();
    expect(container.textContent).toContain('Entenda em um minuto');
    await act(async () => { root.unmount(); });
    root = createRoot(container);
    await render('missoes');
    expect(container.querySelector('[data-testid="como-funciona-missoes"]')).toBeNull(); // continua recolhido
  });

  it('não lista termo de um módulo que o admin desligou', async () => {
    mods.off = new Set(['duels']);
    await render('competir');
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).not.toContain('/gamification/como-funciona?termo=duelo');
    expect(hrefs).toContain('/gamification/como-funciona?termo=temporada');
  });

  it('aba desconhecida não desenha nada', async () => {
    await render('nao-existe');
    expect(container.innerHTML).toBe('');
  });
});
