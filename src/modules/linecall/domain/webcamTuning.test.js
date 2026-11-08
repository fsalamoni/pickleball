import { describe, it, expect } from 'vitest';
import { shutterOptions, shutterConstraints, deliveredFps, fpsShortfall, SHUTTER_STEPS } from './webcamTuning.js';

describe('obturador da webcam', () => {
  it('só oferece o que a câmera aceita', () => {
    expect(shutterOptions({ exposureMode: ['continuous', 'manual'], exposureTime: { min: 15, max: 10000 } }).map((s) => s.id)).toEqual(['s250', 's500']);
    expect(shutterOptions({ exposureMode: ['continuous', 'manual'], exposureTime: { min: 1, max: 5000 } })).toHaveLength(3);
  });
  it('câmera que não deixa mudar não mostra nada', () => {
    expect(shutterOptions({ exposureMode: ['continuous'] })).toEqual([]);
    expect(shutterOptions({})).toEqual([]);
    expect(shutterOptions(null)).toEqual([]);
  });
  it('monta as restrições e volta ao automático', () => {
    expect(shutterConstraints(SHUTTER_STEPS[2])).toEqual({ advanced: [{ exposureMode: 'manual', exposureTime: 10 }] });
    expect(shutterConstraints(null, { exposureMode: ['continuous', 'manual'] })).toEqual({ advanced: [{ exposureMode: 'continuous' }] });
  });
});

describe('quadros que chegaram', () => {
  it('conta pelo que o navegador entregou', () => {
    expect(deliveredFps({ deliveredFrames: 100, at: 0 }, { deliveredFrames: 160, at: 2000 })).toBe(30);
  });
  it('sem leitura ou janela curta, não inventa', () => {
    expect(deliveredFps(null, { deliveredFrames: 1, at: 1 })).toBeNull();
    expect(deliveredFps({ deliveredFrames: 1, at: 0 }, { deliveredFrames: 5, at: 100 })).toBeNull();
  });
  it('acusa a webcam que anuncia 60 e entrega 30', () => {
    expect(fpsShortfall(60, 30)).toBe(true);
    expect(fpsShortfall(60, 57)).toBe(false);
    expect(fpsShortfall(undefined, 30)).toBe(false);
  });
});
