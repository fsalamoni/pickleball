import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FRAME, clampFrame, innerImageSize, isDefaultFrame, normalizeAspect, normalizeFrame,
  panFrame, photoBox, rotateFrame, zoomFrame,
} from './mediaFrame';

describe('enquadramento das fotos do Mercado', () => {
  it('normaliza rotação, zoom e centro', () => {
    expect(normalizeFrame(null)).toEqual(DEFAULT_FRAME);
    expect(normalizeFrame({ rotate: 450, zoom: 9, x: -1, y: 2 })).toEqual({ rotate: 90, zoom: 4, x: 0, y: 1 });
    expect(normalizeFrame({ rotate: -90 }).rotate).toBe(270);
    expect(isDefaultFrame({})).toBe(true);
    expect(normalizeAspect('abc')).toBeNull();
    expect(normalizeAspect(1.5)).toBe(1.5);
  });

  it('foto deitada no card quadrado: altura cheia, centralizada', () => {
    const b = photoBox(2, DEFAULT_FRAME);
    expect(b).toMatchObject({ width: 200, height: 100, top: 0, left: -50 });
  });

  it('o centro não deixa sobra no card', () => {
    const b = photoBox(2, { ...DEFAULT_FRAME, x: 0 });
    expect(b.left).toBe(0);
    const c = clampFrame(2, { ...DEFAULT_FRAME, x: 1 });
    expect(c.x).toBe(0.75);
  });

  it('a foto inteira (contain) cabe sem corte e gira', () => {
    expect(photoBox(2, DEFAULT_FRAME, { mode: 'contain' })).toEqual({ left: 0, top: 25, width: 100, height: 50 });
    expect(photoBox(2, { rotate: 90 }, { mode: 'contain' })).toEqual({ left: 25, top: 0, width: 50, height: 100 });
  });

  it('girada 90°, a imagem interna troca largura e altura', () => {
    const box = photoBox(2, { rotate: 90 }, { mode: 'contain' });
    expect(innerImageSize(box, 90)).toEqual({ width: 200, height: 50 });
    expect(innerImageSize(box, 0)).toEqual({ width: 100, height: 100 });
  });

  it('arrastar desloca o centro dentro dos limites', () => {
    const f = panFrame(2, DEFAULT_FRAME, 0.2, 0);
    expect(f.x).toBeCloseTo(0.4);
    expect(panFrame(2, DEFAULT_FRAME, 5, 0).x).toBe(0.25);
  });

  it('girar e voltar devolve o mesmo enquadramento', () => {
    const f = zoomFrame(1.5, { ...DEFAULT_FRAME, x: 0.4, y: 0.6 }, 2);
    const ida = rotateFrame(1.5, f, 1);
    expect(ida.rotate).toBe(90);
    const volta = rotateFrame(1.5, ida, -1);
    expect(volta.rotate).toBe(0);
    expect(volta.x).toBeCloseTo(f.x);
    expect(volta.y).toBeCloseTo(f.y);
  });
});
