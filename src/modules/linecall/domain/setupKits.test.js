import { describe, it, expect } from 'vitest';
import { SETUP_KITS, KIT_ORDER, deviceProfile, kitWarnings, cameraSource, CAMERA_SOURCE_TIP } from './setupKits.js';
import { layoutById } from './cameraLayouts.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Safari';
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130';

describe('kits de montagem', () => {
  it('todo kit está na ordem e só aponta para arranjos que existem, com o número de câmeras certo', () => {
    expect([...KIT_ORDER].sort()).toEqual(Object.keys(SETUP_KITS).sort());
    for (const k of Object.values(SETUP_KITS)) {
      expect(k.steps.length).toBeGreaterThan(2);
      for (const id of k.layouts) {
        const l = layoutById(id);
        expect(l.id).toBe(id);
        expect(l.positions.length).toBeGreaterThanOrEqual(k.cams[0]);
        expect(l.positions.length).toBeLessThanOrEqual(k.cams[1]);
      }
    }
  });
});

describe('deviceProfile', () => {
  it('celular é uma câmera; computador forte aguenta várias', () => {
    expect(deviceProfile({ userAgent: IPHONE })).toMatchObject({ kind: 'phone', maxCams: 1 });
    expect(deviceProfile({ userAgent: PC, cores: 12, memoryGb: 16 }).maxCams).toBe(4);
    expect(deviceProfile({ userAgent: PC, cores: 8, memoryGb: 8 }).maxCams).toBe(3);
    expect(deviceProfile({ userAgent: PC, cores: 4, memoryGb: 8 }).maxCams).toBe(1);
  });
  it('sem saber o processador, fica no conservador e diz que não sabe', () => {
    expect(deviceProfile({ userAgent: PC })).toMatchObject({ kind: 'computer', maxCams: 1, known: false });
  });
  it('iPad que se diz Mac é tablet', () => {
    expect(deviceProfile({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', maxTouchPoints: 5 }).kind).toBe('tablet');
  });
});

describe('kitWarnings', () => {
  it('kit de computador num celular avisa; computador fraco para 4 câmeras avisa', () => {
    expect(kitWarnings('estudio', deviceProfile({ userAgent: IPHONE }))).toContain('needs_computer');
    expect(kitWarnings('computador', deviceProfile({ userAgent: PC, cores: 6, memoryGb: 8 }))).toContain('weak_computer');
    expect(kitWarnings('celulares', deviceProfile({ userAgent: IPHONE }))).toEqual([]);
  });
});

describe('cameraSource', () => {
  it('reconhece OBS, NDI, celular sem fio, captura e a câmera da frente', () => {
    expect(cameraSource('OBS Virtual Camera')).toBe('obs');
    expect(cameraSource('NDI Webcam Video 1')).toBe('ndi');
    expect(cameraSource('DroidCam Source 2')).toBe('phone_wireless');
    expect(cameraSource('Cam Link 4K')).toBe('capture');
    expect(cameraSource('Câmera frontal')).toBe('front');
    expect(cameraSource('camera2 0, facing back')).toBe('back');
    expect(CAMERA_SOURCE_TIP[cameraSource('Logitech C920')]).toBeNull();
  });
});
