import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (...a) => toastError(...a) } }));

const state = { prefs: null, loaded: true, error: null, update: vi.fn() };
vi.mock('@/modules/progression/hooks/useGamificationPrefs', () => ({
  useGamificationPrefs: () => ({ prefs: state.prefs, loaded: state.loaded, error: state.error, saving: false, update: (...a) => state.update(...a) }),
}));
vi.mock('@/modules/achievements/hooks/useUserAchievementsV2', () => ({
  useUserAchievementsV2: () => ({ unlocked: [{ achievementId: 'career_first_win' }, { achievementId: 'inexistente' }] }),
}));

import GamificationPreferences from './GamificationPreferences.jsx';
import { normalizeGamificationPrefs } from '@/modules/progression/domain/gamificationPrefs';

let container; let root;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  state.prefs = normalizeGamificationPrefs(null, 'eu'); state.loaded = true; state.error = null;
  state.update = vi.fn(() => Promise.resolve({})); toastError.mockClear();
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (props) => act(async () => { root.render(<GamificationPreferences uid="eu" {...props} />); });

describe('GamificationPreferences', () => {
  it('tem as quatro seções, com a privacidade ancorada (o Hall linka para ela)', async () => {
    await render();
    expect(container.querySelector('#privacidade')).toBeTruthy();
    ['Privacidade', 'Interação com outros atletas', 'Avisos', 'Como aparece para mim'].forEach((t) => expect(container.textContent).toContain(t));
  });

  it('o padrão é o que a pessoa que nunca abriu a tela espera', async () => {
    await render();
    const chave = (id) => container.querySelector(`#${id}`).getAttribute('aria-checked');
    expect(chave('pref-hall')).toBe('true');
    expect(chave('pref-profile')).toBe('true');
    expect(chave('pref-duels')).toBe('true');
    expect(chave('pref-cele')).toBe('true');
  });

  it('desligar "aparecer no placar" grava POR SEÇÃO, só o campo que mudou', async () => {
    await render();
    await act(async () => { container.querySelector('#pref-hall').click(); });
    expect(state.update).toHaveBeenCalledWith({ privacy: { showInHallOfFame: false } });
  });

  it('cada interruptor grava o seu campo', async () => {
    await render();
    const casos = [['pref-profile', { privacy: { showOnPublicProfile: false } }], ['pref-duels', { social: { acceptDuels: false } }],
      ['pref-reviews', { social: { acceptReviews: false } }], ['pref-letters', { social: { acceptLetters: false } }],
      ['pref-weekly', { notifications: { weeklyReview: false } }], ['pref-nduels', { notifications: { duels: false } }],
      ['pref-nchal', { notifications: { challengeResults: false } }], ['pref-cele', { display: { celebrations: false } }]];
    for (const [id, patch] of casos) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => { container.querySelector(`#${id}`).click(); });
      expect(state.update).toHaveBeenLastCalledWith(patch);
    }
  });

  it('módulo desligado pelo admin não oferece a opção que não existe', async () => {
    await render({ isModuleOn: (id) => !['hall_of_fame', 'duels', 'partner_letters'].includes(id) });
    expect(container.querySelector('#pref-hall')).toBeNull();
    expect(container.querySelector('#pref-duels')).toBeNull();
    expect(container.querySelector('#pref-letters')).toBeNull();
    expect(container.querySelector('#pref-reviews')).toBeTruthy();
  });

  it('falha ao salvar avisa (a tela não fica ligada com o banco desligado)', async () => {
    state.update = vi.fn(() => Promise.resolve(null));
    await render();
    await act(async () => { container.querySelector('#pref-hall').click(); });
    expect(toastError).toHaveBeenCalled();
  });

  it('o título vem das conquistas que a pessoa TEM (ids desconhecidos ficam de fora)', async () => {
    await render();
    const opcoes = Array.from(container.querySelectorAll('#pref-title option')).map((o) => o.textContent);
    expect(opcoes[0]).toContain('O meu tier');
    expect(opcoes.length).toBe(2);
    await act(async () => {
      const sel = container.querySelector('#pref-title');
      Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, 'career_first_win');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(state.update).toHaveBeenCalledWith({ display: { title: 'career_first_win' } });
  });

  it('quem dispensou os primeiros passos pode trazê-los de volta', async () => {
    state.prefs = normalizeGamificationPrefs({ onboarding: { dismissed: true } }, 'eu');
    await render();
    await act(async () => { Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Mostrar os primeiros passos')).click(); });
    expect(state.update).toHaveBeenCalledWith({ onboarding: { dismissed: false } });
  });

  it('carregando: esqueleto, nunca preferências "de fábrica" que a pessoa poderia salvar por cima', async () => {
    state.loaded = false;
    await render();
    expect(container.querySelector('#pref-hall')).toBeNull();
  });
});
