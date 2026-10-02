import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flag = { value: true };
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => flag.value }));
const auth = { user: { uid: 'u1' } };
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));

const engineSpy = vi.fn(() => ({ ready: false }));
vi.mock('@/modules/progression/hooks/useGamificationEngine', () => ({ useGamificationEngine: (...a) => engineSpy(...a) }));
const prefs = { prefs: { onboarding: { done: {} } }, loaded: true, update: vi.fn(() => Promise.resolve({})) };
vi.mock('@/modules/progression/hooks/useGamificationPrefs', () => ({ useGamificationPrefs: () => prefs }));
const mods = { off: new Set() };
vi.mock('@/modules/progression/hooks/useGamificationConfig', () => ({ useGamificationConfig: () => ({ isModuleOn: (id) => !mods.off.has(id) }) }));

import GamificationBackground from './GamificationBackground.jsx';
import { viewPreferenceKey } from '@/core/lib/viewPreference';

let container; let root;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  flag.value = true; auth.user = { uid: 'u1' }; engineSpy.mockClear(); engineSpy.mockReturnValue({ ready: false });
  prefs.prefs = { onboarding: { done: {} } }; prefs.loaded = true; prefs.update = vi.fn(() => Promise.resolve({}));
  mods.off = new Set(); window.localStorage.clear();
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (url = '/') => act(async () => { root.render(<MemoryRouter initialEntries={[url]}><GamificationBackground /></MemoryRouter>); });

describe('GamificationBackground', () => {
  it('não desenha nada', async () => {
    await render();
    expect(container.innerHTML).toBe('');
  });

  it('visitar o ranking cumpre o passo "Veja o ranking" — uma vez só', async () => {
    await render('/ranking');
    expect(prefs.update).toHaveBeenCalledTimes(1);
    expect(prefs.update.mock.calls[0][0]).toEqual({ onboarding: { done: { ranking: expect.any(Number) } } });
  });

  it('abrir a página de um torneio cumpre "Acompanhe um torneio"', async () => {
    await render('/torneios/t1');
    expect(prefs.update.mock.calls[0][0].onboarding.done).toHaveProperty('watch');
  });

  it('passo já gravado não é regravado; rota sem passo não faz nada', async () => {
    prefs.prefs = { onboarding: { done: { ranking: 1 } } };
    await render('/ranking');
    await render('/atletas');
    expect(prefs.update).not.toHaveBeenCalled();
  });

  it('roteiro desligado pelo admin: nenhuma visita é registrada', async () => {
    mods.off = new Set(['onboarding']);
    await render('/ranking');
    expect(prefs.update).not.toHaveBeenCalled();
  });

  it('preferências ainda carregando: espera (não decide sobre o que não viu)', async () => {
    prefs.loaded = false;
    await render('/ranking');
    expect(prefs.update).not.toHaveBeenCalled();
  });

  it('sincronização de fundo: roda se nunca rodou ou passou de 12 h, com sync ligado', async () => {
    await render();
    expect(engineSpy).toHaveBeenCalledWith('u1', { enabled: true, sync: true });
  });

  it('rodou há pouco: não carrega o motor (não custa consulta a cada abertura do app)', async () => {
    window.localStorage.setItem(viewPreferenceKey('u1', 'gamificacao:sync'), String(Date.now() - 3_600_000));
    await render();
    expect(engineSpy).not.toHaveBeenCalled();
  });

  it('flag desligada ou sem conta: nada acontece', async () => {
    flag.value = false;
    await render('/ranking');
    expect(engineSpy).not.toHaveBeenCalled();
    expect(prefs.update).not.toHaveBeenCalled();
    flag.value = true; auth.user = null;
    await render('/ranking');
    expect(engineSpy).not.toHaveBeenCalled();
  });

  it('quando o motor termina, marca a hora (para não rodar de novo por 12 h)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    engineSpy.mockReturnValue({ ready: true });
    await render();
    await act(async () => { vi.advanceTimersByTime(4500); });
    vi.useRealTimers();
    const gravado = window.localStorage.getItem(viewPreferenceKey('u1', 'gamificacao:sync'));
    expect(Number(gravado)).toBeGreaterThan(Date.now() - 60_000);
  });
});
