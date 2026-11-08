import { describe, it, expect } from 'vitest';
import { toGray, cutPatch, matchPatch, driftFrom, brightness, HEALTH } from './cameraHealth.js';

const W = 120;
const H = 80;

/** Uma "quadra" de mentira: fundo com textura e cantos claros, deslocada por (ox, oy). */
function scene(ox = 0, oy = 0) {
  const g = new Uint8Array(W * H);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const sx = x - ox;
      const sy = y - oy;
      // textura sem período (um "hash" da posição), como o piso de verdade
      const n = Math.sin(sx * 12.9898 + sy * 78.233) * 43758.5453;
      g[y * W + x] = Math.floor((n - Math.floor(n)) * 60) + ((sx > 30 && sy > 20) ? 150 : 60);
    }
  }
  return g;
}

describe('cameraHealth', () => {
  it('converte RGBA em cinza', () => {
    const g = toGray(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]), 2, 1);
    expect(g[0]).toBeGreaterThan(250);
    expect(g[1]).toBe(0);
  });

  it('não guarda pedaço liso nem fora da imagem', () => {
    const flat = new Uint8Array(W * H).fill(100);
    expect(cutPatch(flat, W, H, 50, 40)).toBeNull();
    expect(cutPatch(scene(), W, H, 2, 2)).toBeNull();
  });

  it('acha o pedaço onde estava e diz que não mexeu', () => {
    const g = scene();
    const pts = [[31, 21], [60, 40], [90, 60]];
    const patches = pts.map(([x, y]) => cutPatch(g, W, H, x, y));
    const res = driftFrom(patches.map((p) => matchPatch(g, W, H, p)));
    expect(res).toMatchObject({ known: true, moved: false, px: 0 });
  });

  it('percebe quando a câmera mexeu alguns pixels', () => {
    const ref = scene();
    const patches = [[31, 21], [60, 40], [90, 60]].map(([x, y]) => cutPatch(ref, W, H, x, y));
    const moved = scene(5, 0);
    const res = driftFrom(patches.map((p) => matchPatch(moved, W, H, p)));
    expect(res.moved).toBe(true);
    expect(res.px).toBe(5);
  });

  it('um jogador em cima de um ponto não decide sozinho', () => {
    const ref = scene();
    const patches = [[31, 21], [60, 40], [90, 60]].map(([x, y]) => cutPatch(ref, W, H, x, y));
    const now = scene();
    for (let y = 30; y < 50; y += 1) for (let x = 50; x < 70; x += 1) now[y * W + x] = (x * y) % 255;
    const res = driftFrom(patches.map((p) => matchPatch(now, W, H, p)));
    expect(res.moved).toBe(false);
  });

  it('com menos de dois pedaços achados não afirma nada', () => {
    expect(driftFrom([null, { dx: 9, dy: 0 }])).toMatchObject({ known: false, moved: false });
  });

  it('diz quando a imagem está escura', () => {
    expect(brightness(new Uint8Array(100).fill(20)).dark).toBe(true);
    expect(brightness(new Uint8Array(100).fill(HEALTH.DARK + 40)).dark).toBe(false);
    // Sol ou reflexo: um terço da imagem estourada; quadra coberta clara, não.
    const sol = new Uint8Array(700).fill(120);
    sol.fill(255, 0, 250);
    expect(brightness(sol).glare).toBe(true);
    expect(brightness(new Uint8Array(700).fill(230)).glare).toBe(false);
  });
});
