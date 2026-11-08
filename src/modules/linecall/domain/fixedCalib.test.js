import { describe, it, expect } from 'vitest';
import { cameraKey, fixedSnapshot, fixedPatches, restoreDecision, restoredCalib } from './fixedCalib.js';

const corners = [{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 9 }, { x: 1, y: 9 }];
const patch = (n) => ({ size: 2, cx: n, cy: n, data: new Uint8Array([0, 128, 255, n]) });
const calib = { corners, hue: 60, checkTap: { x: 5, y: 5 }, remoteMs: 7 };

describe('câmera fixa lembra a calibração', () => {
  it('cada câmera tem o seu nome', () => {
    expect(cameraKey('abc')).toBe('dev:abc');
    expect(cameraKey('')).toBe('padrao');
    expect(cameraKey({ url: 'http://localhost:1984/api/webrtc?src=q1' })).toBe('ip:http://localhost:1984/api/webrtc?src=q1');
  });

  it('guarda os pedaços e devolve iguais', () => {
    const s = fixedSnapshot(calib, { vw: 1920, vh: 1080, patches: [patch(3), null, patch(4)], now: 10 });
    expect(s).toMatchObject({ v: 1, vw: 1920, vh: 1080, savedMs: 10, hue: 60 });
    expect(s.remoteMs).toBeUndefined();
    expect(JSON.parse(JSON.stringify(s)).patches[1]).toBeNull();
    const back = fixedPatches(JSON.parse(JSON.stringify(s)));
    expect(Array.from(back[0].data)).toEqual([0, 128, 255, 3]);
    expect(back[2]).toMatchObject({ size: 2, cx: 4, cy: 4 });
  });

  it('não guarda calibração incompleta nem sem pedaços', () => {
    expect(fixedSnapshot({ corners: corners.slice(0, 3) }, { vw: 1, vh: 1, patches: [patch(1), patch(2)] })).toBeNull();
    expect(fixedSnapshot(calib, { vw: 1, vh: 1, patches: [patch(1)] })).toBeNull();
  });

  it('decide pela imagem de agora', () => {
    const s = fixedSnapshot(calib, { vw: 1920, vh: 1080, patches: [patch(1), patch(2)] });
    expect(restoreDecision(null, { vw: 1920, vh: 1080 })).toBe('none');
    expect(restoreDecision(s, { vw: 1280, vh: 720, drift: { known: true, moved: false } })).toBe('size');
    expect(restoreDecision(s, { vw: 1920, vh: 1080, drift: { known: true, moved: false } })).toBe('same');
    expect(restoreDecision(s, { vw: 1920, vh: 1080, drift: { known: true, moved: true } })).toBe('moved');
    expect(restoreDecision(s, { vw: 1920, vh: 1080, drift: { known: false } })).toBe('unsure');
  });

  it('sem certeza, volta sem o 5º ponto; mexida, não volta', () => {
    const s = fixedSnapshot(calib, { vw: 1920, vh: 1080, patches: [patch(1), patch(2)] });
    expect(restoredCalib(s, 'same')).toEqual({ corners, hue: 60, checkTap: { x: 5, y: 5 } });
    expect(restoredCalib(s, 'unsure')).toEqual({ corners, hue: 60 });
    expect(restoredCalib(s, 'moved')).toBeNull();
    expect(restoredCalib(s, 'size')).toBeNull();
  });
});
