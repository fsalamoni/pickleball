import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const state = { flag: true, admin: false, help: true, off: new Set() };
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: (f) => (f === 'help_center' ? state.help : state.flag) }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ isPlatformAdmin: state.admin, user: { uid: 'u1' } }) }));
vi.mock('@/modules/progression/hooks/useGamificationGuide', async () => {
  const { buildGamificationGuide } = await import('@/modules/progression/domain/gamificationGuide');
  return { useGamificationGuide: () => ({ guide: buildGamificationGuide(null), isModuleOn: (id) => !state.off.has(id) }) };
});
vi.mock('@/v2/ui/rolarAte', () => ({ rolarAte: vi.fn() }));

import V2GamificationGuide from './V2GamificationGuide.jsx';
import { rolarAte } from '@/v2/ui/rolarAte';

let container; let root;
beforeEach(() => { Object.assign(state, { flag: true, admin: false, help: true, off: new Set() }); vi.clearAllMocks(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (url = '/gamification/como-funciona') => act(async () => { root.render(<MemoryRouter initialEntries={[url]}><V2GamificationGuide /></MemoryRouter>); });
const ids = () => Array.from(container.querySelectorAll('article[data-term]')).map((a) => a.getAttribute('data-term'));

describe('V2GamificationGuide', () => {
  it('flag desligada: empty state (nada de guia sobre o que não existe)', async () => {
    state.flag = false;
    await render();
    expect(container.textContent).toContain('Disponível em breve');
    expect(container.querySelector('article')).toBeNull();
  });

  it('abre no atleta, com o ciclo em um minuto, os grupos e as perguntas frequentes', async () => {
    await render();
    expect(container.textContent).toContain('Em um minuto');
    expect(container.querySelectorAll('ol li')).toHaveLength(6);
    expect(ids()).toContain('xp');
    expect(ids()).toContain('sequencia');
    expect(ids()).not.toContain('saude');
    expect(container.textContent).toContain('Perguntas frequentes');
    expect(container.textContent).toContain('Por que a minha sequência zerou?');
  });

  it('mostra o texto de verdade, com o número da regra (a sequência explica a folga)', async () => {
    await render();
    const seq = container.querySelector('article[data-term="sequencia"]');
    expect(seq.textContent).toContain('Folga automática');
    expect(seq.querySelector('a').getAttribute('href')).toBe('/gamification');
  });

  it('troca o público pela barra e guarda na URL; o termo dos outros públicos aparece', async () => {
    await render();
    const botao = Array.from(container.querySelectorAll('nav[aria-label="Para quem é o guia"] button')).find((b) => b.textContent === 'Arena');
    await act(async () => { botao.click(); });
    expect(ids()).toContain('saude');
    expect(ids()).not.toContain('xp');
  });

  it('a Administração só existe para o administrador da plataforma', async () => {
    await render();
    expect(container.textContent).not.toContain('Administração');
    act(() => root.unmount());
    state.admin = true;
    root = createRoot(container);
    await render();
    expect(Array.from(container.querySelectorAll('nav[aria-label="Para quem é o guia"] button')).map((b) => b.textContent)).toContain('Administração');
  });

  it('?termo= leva ao termo, destaca e rola até ele', async () => {
    vi.useFakeTimers();
    await render('/gamification/como-funciona?termo=duelo');
    await act(async () => { vi.advanceTimersByTime(100); });
    vi.useRealTimers();
    const card = container.querySelector('article[data-term="duelo"]');
    expect(card.className).toContain('ring-2');
    expect(rolarAte).toHaveBeenCalledWith(card);
  });

  it('?termo= de um termo só do professor abre o público certo', async () => {
    await render('/gamification/como-funciona?termo=saude');
    expect(ids()).toContain('saude');
    expect(container.querySelector('nav[aria-label="Para quem é o guia"] [aria-current="page"]').textContent).toMatch(/Professor|Arena/);
  });

  it('a busca acha pelo que a pessoa diria, sem acento, e some com as perguntas', async () => {
    await render('/gamification/como-funciona?q=placar%20publico');
    expect(ids()).toContain('privacidade');
    expect(ids()).not.toContain('xp');
    expect(container.textContent).not.toContain('Perguntas frequentes');
  });

  it('sem resultado: diz que não achou e como seguir (nunca uma página em branco)', async () => {
    await render('/gamification/como-funciona?q=zzzzzzzz');
    expect(container.textContent).toContain('Nada encontrado');
    expect(container.textContent).toContain('troque o público');
  });

  it('módulo desligado pelo admin: o termo dele não aparece', async () => {
    state.off = new Set(['duels']);
    await render();
    expect(ids()).not.toContain('duelo');
    expect(ids()).toContain('temporada');
  });

  it('rodapé: preferências sempre; Central de ajuda só com a flag dela', async () => {
    await render();
    expect(container.querySelector('a[href="/gamification/configuracoes"]')).toBeTruthy();
    expect(Array.from(container.querySelectorAll('a')).some((a) => a.getAttribute('href').startsWith('/ajuda'))).toBe(true);
    act(() => root.unmount());
    state.help = false;
    root = createRoot(container);
    await render();
    expect(Array.from(container.querySelectorAll('a')).some((a) => a.getAttribute('href').startsWith('/ajuda'))).toBe(false);
  });
});
