/**
 * A central de UMA quadra (docs/53 §3 e §5): o aviso — toque, vibração, voz e
 * a tela que pisca — sai UMA vez por lance que chega, e o lance grande é o
 * mais grave da janela. O pé do saque é marcado na hora da BATIDA e chega
 * junto com (ou depois de) o quique do saque: pela hora ele nunca é o
 * "último", e a falta ou o "revisar" dele sumia atrás de um "Saque: dentro".
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fuseLineCalls } from '@/modules/linecall/domain/fusion';
import { tonesFor } from '@/modules/linecall/domain/alertTones';

const sound = { playTones: vi.fn(), unlockAlertSound: vi.fn() };
vi.mock('@/modules/linecall/services/alertSound', () => sound);
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/modules/linecall/hooks/useLineControlLive', () => ({ useNow: () => 5_000 }));
vi.mock('@/modules/linecall/services/lineCallSync', () => ({ clearLineCalls: vi.fn(), decideLance: vi.fn() }));
vi.mock('./CameraInvite', () => ({ default: () => null }));

const { default: LineCentral } = await import('./LineCentral.jsx');

const GD = { id: 'game_days/G1/line_courts/court-1', line_control_layout: 'dois_fundos' };
const call = (id, o) => ({ id, position: 'fundo_a', kind: 'bounce', call: 'in', t_ms: 1000, uncertainty_m: 0.02, x: 2, y: 10, ...o });
/** dois_fundos, saque de B com o pé na linha: o fundo B marca o pé na batida; o fundo A, o quique 900 ms depois. */
const peFalta = call('pe', { position: 'fundo_b', kind: 'serve_foot', call: 'fault', reason: 'baseline', serve: true, t_ms: 1000, x: 4.6, y: 13.5, depth_m: 0.03 });
const quiqueDentro = call('q', { serve: true, t_ms: 1900, x: 1.5, y: 2.5, margin_m: 0.4 });

let container;
let root;
const vibrate = vi.fn();
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  sound.playTones.mockClear();
  vibrate.mockClear();
  Object.defineProperty(window.navigator, 'vibrate', { value: vibrate, configurable: true });
  window.localStorage.clear();
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

/** Cada chegada da escuta é uma renderização inteira, com os efeitos (o aviso) já rodados. */
const show = (calls, { isLoading = false, podeLimpar = true } = {}) => act(async () => {
  const live = { isError: false, isLoading, cams: [], lances: fuseLineCalls(calls), retry: () => {} };
  root.render(<LineCentral gameDay={GD} live={live} podeLimpar={podeLimpar} />);
});
const flash = () => container.querySelector('[role="alert"]')?.textContent || '';
const grande = () => container.querySelector('[data-dica="linhas-central-lance"]')?.textContent || '';

describe('LineCentral: o aviso do lance', () => {
  it('⭐ a falta do pé no saque é o que toca e pisca, não o "Saque: dentro" que chegou junto', async () => {
    await show([]);
    await show([peFalta, quiqueDentro]);
    expect(sound.playTones).toHaveBeenCalledTimes(1);
    expect(sound.playTones).toHaveBeenCalledWith(tonesFor('fault'));
    expect(vibrate).toHaveBeenCalledWith([120, 60, 120]);
    expect(flash()).toMatch(/Falta no saque: pé na linha de fundo/);
    expect(grande()).toMatch(/Falta no saque: pé na linha de fundo/);
  });

  it('o "Saque: dentro" que chega DEPOIS da falta do pé não apaga a tela que pisca', async () => {
    // A ordem real em dois_fundos: o fundo B solta o pé na batida; o fundo A, o quique 250 ms depois.
    await show([]);
    await show([peFalta]);
    expect(flash()).toMatch(/Falta no saque/);
    await show([peFalta, quiqueDentro]);
    expect(flash()).toMatch(/Falta no saque/);
    expect(grande()).toMatch(/Falta no saque/);
    // O "dentro" é calado (sequência vazia): só a falta tocou.
    expect(sound.playTones.mock.calls.filter(([notes]) => notes.length)).toEqual([[tonesFor('fault')]]);
  });

  it('o "revisar" do pé no saque toca, e a palavra final fica no lance grande', async () => {
    const peRevisar = { ...peFalta, position: 'fundo_a', call: 'review' };
    await show([]);
    await show([peRevisar, { ...quiqueDentro, id: 'q2', position: 'fundo_a' }]);
    expect(sound.playTones).toHaveBeenCalledWith(tonesFor('review'));
    const lanceGrande = container.querySelector('[data-dica="linhas-central-lance"]');
    expect(lanceGrande.querySelector('[role="group"]')).toBeTruthy();
    expect(lanceGrande.textContent).toMatch(/Falta: pé no saque/);
  });

  it('decidida a falta do pé no saque, o lance grande segue sendo ela, não o "Saque: dentro" que veio depois', async () => {
    const peDecidido = { ...peFalta, call: 'review', decision: 'fault', decided_ms: 3000, decided_by: 'u1' };
    await show([peDecidido, quiqueDentro]);
    expect(grande()).toMatch(/Falta no saque: pé na linha de fundo/);
    expect(grande()).toMatch(/Decidido por quem organiza/);
  });

  it('o mesmo lance não toca de novo quando outra câmera, atrasada, entra antes dele na junção', async () => {
    const fundoA = call('c2', { call: 'out', reason: 'long', t_ms: 1000, y: 13.6, margin_m: -0.2 });
    const fundoB = call('c1', { position: 'fundo_b', call: 'out', reason: 'long', t_ms: 990, y: 13.6, margin_m: -0.21 });
    await show([]);
    await show([fundoA]);
    await show([fundoA, fundoB]);
    expect(sound.playTones).toHaveBeenCalledTimes(1);
  });

  it('ao abrir a central, o que já estava na lista não toca', async () => {
    await show([], { isLoading: true });
    await show([call('velho', { call: 'out', reason: 'long', y: 13.7, margin_m: -0.3 })]);
    expect(sound.playTones).not.toHaveBeenCalled();
    expect(flash()).toBe('');
  });

  it('com a voz ligada, cada lance que chega é dito uma vez — o mais grave primeiro', async () => {
    const spoken = [];
    const synth = { cancel: vi.fn(), speak: vi.fn((u) => spoken.push(u.text)) };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    globalThis.SpeechSynthesisUtterance = function Utterance(text) { this.text = text; };
    await show([]);
    await act(async () => {
      container.querySelectorAll('button').forEach((b) => { if (/Falar o lance/.test(b.textContent)) b.click(); });
    });
    spoken.length = 0;
    const doisQuiques = call('dq', { kind: 'two_bounce', call: 'fault', reason: 'return', t_ms: 3000, x: 2, y: 3 });
    const fora = call('fo', { position: 'fundo_b', call: 'out', reason: 'long', t_ms: 3500, y: 13.8, margin_m: -0.3 });
    await show([doisQuiques, fora]);
    expect(spoken).toEqual(['Fora. Dois quiques']);
    await show([doisQuiques, fora]);
    expect(spoken).toHaveLength(1);
    delete window.speechSynthesis;
  });
});
