/**
 * O aparelho que FILMA (docs/53 §5): o motor solta num mesmo quadro o pé de
 * quem saca e o quique do saque. O aviso — toque, vibração e a tela que
 * pisca — é o do lance mais grave do lote, nunca o primeiro da lista: o
 * "Saque: fora" não pode sumir atrás de um "Saque sem falta de pé" calado.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CAMERA_POSITIONS } from '@/modules/linecall/domain/cameraLayouts';
import { tonesFor } from '@/modules/linecall/domain/alertTones';

const sound = { playTones: vi.fn(), unlockAlertSound: vi.fn() };
const session = { current: null };
vi.mock('@/modules/linecall/services/alertSound', () => sound);
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/modules/linecall/hooks/useLineCallSession', () => ({ useLineCallSession: () => session.current }));

const { default: CameraStation } = await import('./CameraStation.jsx');

const base = (events) => ({
  position: CAMERA_POSITIONS.fundo_a, targets: [], checkPoint: { id: 'KTA', x: 0, y: 0 },
  videoRef: { current: null }, cameras: [], start: vi.fn(), stream: null, settings: null, cameraError: null, cameraChecks: [],
  calib: { corners: [], hue: 60 }, addCorner: vi.fn(), moveCorner: vi.fn(), resetCorners: vi.fn(), snapCorners: vi.fn(), undoSnap: vi.fn(),
  setCheckTap: vi.fn(), check: null, learnBallColor: vi.fn(), H: null, Hinv: null, cmPerPixel: null,
  running: true, setRunning: vi.fn(), poseState: 'ready', events, clearEvents: vi.fn(), fps: 30, ball: null,
  shareError: false, battery: { level: null, charging: null }, health: { moved: false, px: null, known: false, dark: false },
});
const ev = (id, o) => ({ id, type: 'bounce', call: 'in', t: 1, at: 1, image: 'data:,', vw: 640, vh: 360, marginM: 0.3, uncertaintyM: 0.03, ...o });
/** O lote como o motor solta: o pé de quem saca primeiro, o quique do saque depois. */
const pe = (call) => ev('1-1', { type: 'serve_foot', call, reason: 'baseline', t: 0, depthM: -0.05, marginM: 0.05 });
const foraLongo = ev('1-2', { call: 'out', reason: 'long', serve: true, t: 1.0, marginM: -0.39 });

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

/** Cada lote é uma renderização inteira, com o aviso (efeitos) já rodado; `wait` deixa o relógio do aviso andar. */
const show = (events, wait = 0, extra = {}) => act(async () => {
  session.current = { ...base(events), ...extra };
  root.render(<CameraStation gameDayId="game_days/G1/line_courts/court-1" position="fundo_a" layout="solo_fundo" layoutPositions={['fundo_a']} />);
  if (wait) await new Promise((resolve) => { setTimeout(resolve, wait); });
});
const flash = () => container.querySelector('[role="alert"]')?.textContent || '';

describe('CameraStation: o aviso do lote', () => {
  it('⭐ o saque fora toca e pisca, mesmo com o pé limpo antes dele no lote', async () => {
    await show([]);
    await show([pe('clean'), foraLongo]);
    expect(sound.playTones).toHaveBeenCalledTimes(1);
    expect(sound.playTones).toHaveBeenCalledWith(tonesFor('out'));
    expect(vibrate).toHaveBeenCalledWith([120, 60, 120]);
    expect(flash()).toMatch(/Saque: fora: longa/);
  });

  it('o "revisar" do pé fica calado, mas não cala o fora que veio no mesmo lote', async () => {
    await show([]);
    await show([pe('review'), foraLongo]);
    expect(sound.playTones).toHaveBeenCalledWith(tonesFor('out'));
    expect(sound.playTones).not.toHaveBeenCalledWith(tonesFor('review'));
    expect(flash()).toMatch(/Saque: fora: longa/);
  });

  it('o replay que chega depois (o mesmo lance, agora com os quadros) não toca de novo nem prende o aviso na tela', async () => {
    const dentro = ev('2-1', { call: 'in' });
    await show([]);
    await show([dentro]);
    expect(flash()).toMatch(/Dentro/);
    await show([{ ...dentro, clip: { eventT: 1, scale: 1, vw: 640, vh: 360, frames: [{ t: 1, url: 'blob:x' }] } }], 900);
    expect(sound.playTones).toHaveBeenCalledTimes(1);
    expect(flash()).toBe('');
  });

  it('pausar a análise no meio do aviso não prende a tela piscando', async () => {
    const dentro = ev('4-1', { call: 'in' });
    await show([]);
    await show([dentro]);
    expect(flash()).toMatch(/Dentro/);
    await show([dentro], 900, { running: false });
    expect(flash()).toBe('');
  });

  it('lance sem nenhum quadro guardado não oferece "Ver replay"', async () => {
    await show([ev('3-1', { call: 'out', reason: 'long', marginM: -0.2, clip: false }), ev('3-2', { clip: { frames: [] } })]);
    expect(container.textContent).not.toMatch(/Ver replay/);
    expect(container.textContent).toMatch(/Ver foto/);
  });
});

describe('CameraStation: a marcação sobre a imagem', () => {
  const comCamera = (extra = {}) => ({ stream: { getVideoTracks: () => [] }, running: false, zone: 'full', setZone: vi.fn(), ...extra });
  const botao = (nome) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === nome || b.getAttribute('aria-label') === nome);

  it('escolher só uma parte da quadra troca a área da câmera', async () => {
    const setZone = vi.fn();
    await show([], 0, comCamera({ setZone }));
    expect(botao('Quadra inteira').getAttribute('aria-pressed')).toBe('true');
    await act(async () => { botao('As duas cozinhas').click(); });
    expect(setZone).toHaveBeenCalledWith('kitchens');
  });

  it('os botões da marcação e o zoom ficam dentro da imagem', async () => {
    await show([], 0, comCamera());
    const sobre = container.querySelector('[data-sobre-imagem]').closest('.overflow-hidden');
    expect(sobre.contains(botao('Começar a marcar'))).toBe(true);
    expect(sobre.contains(botao('Aproximar'))).toBe(true);
    expect(sobre.contains(botao('Tela cheia'))).toBe(true);
  });
});
