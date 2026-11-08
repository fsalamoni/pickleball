import { describe, it, expect } from 'vitest';
import {
  scaleCalib, sanitizeCalib, calibForDb, remoteCalibFor, cameraTodo, snapIsStale, remoteState, SNAP_STALE_MS,
} from './remoteCalib.js';

const quatro = [{ x: 10, y: 20 }, { x: 30, y: 40 }, { x: 50, y: 60 }, { x: 70, y: 80 }];

describe('remoteCalib', () => {
  it('escala os pontos e o 5º ponto entre a foto e o vídeo', () => {
    const c = scaleCalib({ corners: quatro, checkTap: { x: 5, y: 5 }, zone: 'full' }, 2);
    expect(c.corners[3]).toEqual({ x: 140, y: 160 });
    expect(c.checkTap).toEqual({ x: 10, y: 10 });
    expect(c.zone).toBe('full');
    expect(scaleCalib({ corners: [] }, 2).checkTap).toBeNull();
  });

  it('limpa o que veio do banco: ponto sem número, área desconhecida, cor inválida', () => {
    expect(sanitizeCalib(null)).toBeNull();
    expect(sanitizeCalib({ corners: [{ x: 'a', y: 1 }] })).toBeNull();
    expect(sanitizeCalib({ corners: [...quatro, quatro[0]] })).toBeNull();
    const c = sanitizeCalib({ corners: quatro, zone: 'lua', hue: 999, hueSet: true, checkTap: { x: 1, y: 2 }, extra: 1 });
    expect(c).toEqual({ corners: quatro, hue: expect.any(Number), hueSet: true, checkTap: { x: 1, y: 2 } });
    expect(c.zone).toBeUndefined();
    // Sem os quatro pontos, o 5º não vale.
    expect(sanitizeCalib({ corners: quatro.slice(0, 2), checkTap: { x: 1, y: 2 } }).checkTap).toBeNull();
  });

  it('o formato do banco não leva o que é só do aparelho', () => {
    expect(calibForDb({ corners: quatro, hue: 60, remoteMs: 5, zone: 'half_a' })).toEqual({ corners: quatro, hue: 60, checkTap: null, zone: 'half_a' });
  });

  it('a calibração da central chega na resolução atual da câmera', () => {
    const d = { calib: { corners: quatro }, vw: 1920 };
    expect(remoteCalibFor(d, 960).corners[0]).toEqual({ x: 5, y: 10 });
    expect(remoteCalibFor(d, undefined).corners[0]).toEqual({ x: 10, y: 20 });
    expect(remoteCalibFor({ calib: { corners: quatro.slice(0, 3) } }, 1920)).toBeNull();
  });

  it('o que a câmera faz com o documento', () => {
    expect(cameraTodo(null)).toEqual({ applyCalib: false, run: null, sendSnap: false });
    const d = { calib: { corners: quatro }, calib_ms: 10, run: true, run_ms: 20, snap_req_ms: 30, snap_ms: 5 };
    expect(cameraTodo(d, {})).toEqual({ applyCalib: true, run: true, sendSnap: true });
    expect(cameraTodo(d, { calibMs: 10, runMs: 20, snapMs: 30 })).toEqual({ applyCalib: false, run: null, sendSnap: false });
    // A foto que já está no banco, mais nova que o pedido, não sai de novo.
    expect(cameraTodo({ ...d, snap_ms: 40 }, {}).sendSnap).toBe(false);
  });

  it('foto velha ou ausente é pedida de novo', () => {
    expect(snapIsStale(null, 0)).toBe(true);
    expect(snapIsStale({ snap: 'x', snap_ms: 1000 }, 1000 + SNAP_STALE_MS - 1)).toBe(false);
    expect(snapIsStale({ snap: 'x', snap_ms: 1000 }, 1000 + SNAP_STALE_MS + 1)).toBe(true);
  });

  it('a central sabe se a câmera aplicou', () => {
    expect(remoteState({}, null)).toBe('idle');
    expect(remoteState({ applied_ms: 4 }, 5)).toBe('waiting');
    expect(remoteState({ applied_ms: 5 }, 5)).toBe('applied');
  });
});
