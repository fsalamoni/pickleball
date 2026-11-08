import { describe, it, expect } from 'vitest';
import { shutterOptions, shutterConstraints, deliveredFps, fpsShortfall, SHUTTER_STEPS, framesFirst, lockOptions, lockConstraints, wideZoom } from './webcamTuning.js';

describe('captura: quadros antes de pixels, foco travado, grande-angular', () => {
  it('troca 1080p a 30 por 720p a 60 só quando a câmera tem 60', () => {
    expect(framesFirst({ frameRate: 30, height: 1080 }, { frameRate: { max: 60 } })).toEqual({ width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60, min: 50 } });
    expect(framesFirst({ frameRate: 30, height: 1080 }, { frameRate: { max: 30 } })).toBeNull();
    expect(framesFirst({ frameRate: 60, height: 1080 }, { frameRate: { max: 120 } })).toBeNull();
    expect(framesFirst({ frameRate: 30, height: 720 }, { frameRate: { max: 60 } })).toBeNull();
    expect(framesFirst({ frameRate: 30, height: 1080 }, null)).toBeNull();
  });

  it('trava o foco na distância de agora e solta para o contínuo', () => {
    const caps = { focusMode: ['continuous', 'manual'], whiteBalanceMode: ['continuous', 'manual'] };
    expect(lockOptions(caps)).toEqual({ focus: true, color: true });
    expect(lockConstraints(caps, { focusDistance: 3.2 }, true)).toEqual({ advanced: [{ focusMode: 'manual', focusDistance: 3.2 }, { whiteBalanceMode: 'manual' }] });
    expect(lockConstraints(caps, {}, false)).toEqual({ advanced: [{ focusMode: 'continuous' }, { whiteBalanceMode: 'continuous' }] });
    expect(lockConstraints({ focusMode: ['continuous', 'single-shot'] }, {}, true)).toEqual({ advanced: [{ focusMode: 'single-shot' }] });
    expect(lockConstraints({}, {}, true)).toBeNull();
  });

  it('grande-angular só com zoom abaixo de 1', () => {
    expect(wideZoom({ zoom: { min: 0.5, max: 10 } })).toBe(0.5);
    expect(wideZoom({ zoom: { min: 1, max: 10 } })).toBeNull();
    expect(wideZoom({})).toBeNull();
  });
});

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
