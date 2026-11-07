/**
 * Calibrar uma câmera PELA CENTRAL (docs/53 §5d): quem organiza abre
 * "Calibrar daqui" na linha da câmera, marca os pontos sobre a foto que ela
 * mandou e manda de volta — nos pixels do VÍDEO da câmera, não da foto — já
 * podendo começar a análise; o começar/pausar também sai da linha da câmera.
 * Quem não organiza não vê nada disso.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/modules/linecall/services/alertSound', () => ({ playTones: vi.fn(), unlockAlertSound: vi.fn() }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'org' } }) }));
vi.mock('@/modules/linecall/hooks/useLineControlLive', () => ({ useNow: () => 5_000 }));
vi.mock('./CameraInvite', () => ({ default: () => null }));
const calibSvc = {
  doc: null,
  watchCameraCalib: vi.fn((host, camId, cb) => { cb(calibSvc.doc); return () => {}; }),
  requestCameraSnap: vi.fn(() => Promise.resolve()),
  sendCameraCalib: vi.fn(() => Promise.resolve(9)),
  setCameraRun: vi.fn(() => Promise.resolve()),
};
vi.mock('@/modules/linecall/services/lineCalibService', () => calibSvc);

const { default: LineCentral } = await import('./LineCentral.jsx');

const GD = { id: 'game_days/G1/line_courts/court-1', line_control_layout: 'solo_fundo' };
const CANTOS = [{ x: 100, y: 900 }, { x: 1800, y: 900 }, { x: 1300, y: 300 }, { x: 600, y: 300 }];
const cam = (o = {}) => ({ uid: 'cam1', position: 'fundo_a', name: 'Convidado', calibrated: false, analyzing: false, fps: 60, seen_ms: 5_000, ...o });

let container;
let root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.values(calibSvc).forEach((f) => f?.mockClear?.());
  calibSvc.doc = { uid: 'cam1', position: 'fundo_a', snap: 'data:image/jpeg;base64,/9j/', snap_ms: Date.now(), vw: 1920, vh: 1080, cur: { corners: CANTOS, hue: 60 } };
  window.localStorage.clear();
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const show = (cams, podeLimpar = true) => act(async () => {
  root.render(<LineCentral gameDay={GD} live={{ isError: false, isLoading: false, cams, lances: [], retry: () => {} }} podeLimpar={podeLimpar} />);
});
const botao = (txt) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(txt));
const clicar = (b) => act(async () => { b.click(); });

describe('RemoteCalibration: calibrar pela central', () => {
  it('⭐ marca sobre a foto e manda nos pixels do vídeo, já começando a análise', async () => {
    await show([cam()]);
    await clicar(botao('Calibrar daqui'));
    expect(container.textContent).toMatch(/Calibrar pela central/);
    // Foto recente: não pede outra ao abrir.
    expect(calibSvc.requestCameraSnap).not.toHaveBeenCalled();
    await clicar(botao('Mandar e começar a analisar'));
    expect(calibSvc.sendCameraCalib).toHaveBeenCalledTimes(1);
    const [host, camId, uid, calib, run] = calibSvc.sendCameraCalib.mock.calls[0];
    expect([host, camId, uid, run]).toEqual([GD.id, 'cam1_fundo_a', 'org', true]);
    calib.corners.forEach((p, i) => {
      expect(p.x).toBeCloseTo(CANTOS[i].x, 6);
      expect(p.y).toBeCloseTo(CANTOS[i].y, 6);
    });
  });

  it('foto velha ou ausente: pede uma nova ao abrir e espera, sem deixar mandar', async () => {
    calibSvc.doc = { uid: 'cam1', position: 'fundo_a', vw: 1920, vh: 1080 };
    await show([cam()]);
    await clicar(botao('Calibrar daqui'));
    expect(calibSvc.requestCameraSnap).toHaveBeenCalledWith(GD.id, 'cam1_fundo_a', 'org');
    expect(container.textContent).toMatch(/Esperando a imagem da câmera/);
    expect(botao('Mandar e começar a analisar').disabled).toBe(true);
  });

  it('começar e pausar pela linha da câmera', async () => {
    await show([cam({ calibrated: true })]);
    await clicar(botao('Começar a analisar'));
    expect(calibSvc.setCameraRun).toHaveBeenCalledWith(GD.id, 'cam1_fundo_a', 'org', true);
    await show([cam({ calibrated: true, analyzing: true })]);
    await clicar(botao('Pausar'));
    expect(calibSvc.setCameraRun).toHaveBeenLastCalledWith(GD.id, 'cam1_fundo_a', 'org', false);
  });

  it('🔴 quem não organiza não calibra nem começa pela central', async () => {
    await show([cam({ calibrated: true })], false);
    expect(botao('Calibrar daqui')).toBeUndefined();
    expect(botao('Começar a analisar')).toBeUndefined();
  });
});
