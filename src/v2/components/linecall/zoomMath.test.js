import { describe, it, expect } from 'vitest';
import { clampView, pinchView, zoomAt, panView, MAX_ZOOM, NO_ZOOM } from './zoomMath.js';

const VW = 400;
const VH = 225;
/** O pixel da janela onde cai um ponto da imagem (coordenadas sem zoom). */
const onScreen = (v, p) => ({ x: p.x * v.z + v.tx, y: p.y * v.z + v.ty });

describe('zoom da calibração', () => {
  it('o ponto debaixo do dedo fica debaixo do dedo ao dar zoom', () => {
    const p = { x: 300, y: 150 };
    const v = zoomAt(NO_ZOOM, 3, p, VW, VH);
    expect(v.z).toBe(3);
    expect(onScreen(v, p).x).toBeCloseTo(300);
    expect(onScreen(v, p).y).toBeCloseTo(150);
  });

  it('pinça + arrastar: o ponto da imagem acompanha o meio dos dedos', () => {
    const start = { z: 2, tx: -100, ty: -50 };
    const from = { x: 200, y: 100 };
    const to = { x: 220, y: 110 };
    const img = { x: (from.x - start.tx) / start.z, y: (from.y - start.ty) / start.z };
    const v = pinchView(start, from, to, 1.5, VW, VH);
    expect(onScreen(v, img).x).toBeCloseTo(220);
    expect(onScreen(v, img).y).toBeCloseTo(110);
  });

  it('nunca menos que a imagem inteira nem mais que o máximo, e sem borda vazia', () => {
    expect(zoomAt(NO_ZOOM, 0.2, { x: 10, y: 10 }, VW, VH)).toEqual(NO_ZOOM);
    expect(zoomAt(NO_ZOOM, 100, { x: 10, y: 10 }, VW, VH).z).toBe(MAX_ZOOM);
    const v = panView({ z: 2, tx: 0, ty: 0 }, 500, 500, VW, VH);
    expect(v).toEqual({ z: 2, tx: 0, ty: 0 });
    expect(clampView({ z: 2, tx: -5000, ty: -5000 }, VW, VH)).toEqual({ z: 2, tx: -VW, ty: -VH });
  });
});
