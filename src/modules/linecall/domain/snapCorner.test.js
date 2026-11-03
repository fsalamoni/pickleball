import { describe, it, expect } from 'vitest';
import { snapToOuterCorner, centroid } from './snapCorner.js';

const W = 200;
const H = 200;

/** Fundo verde com um "L" branco de 6 px: canto externo em (60, 60), quadra para baixo/direita. */
function corner() {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * 4;
      const linha = (x >= 60 && x < 66 && y >= 60) || (y >= 60 && y < 66 && x >= 60);
      d[i] = linha ? 240 : 40; d[i + 1] = linha ? 240 : 120; d[i + 2] = linha ? 235 : 60; d[i + 3] = 255;
    }
  }
  return d;
}

describe('snapToOuterCorner', () => {
  const img = corner();
  const centro = { x: 150, y: 150 };

  it('leva o toque um pouco errado para o canto externo da linha', () => {
    const p = snapToOuterCorner(img, W, H, { x: 64, y: 66 }, centro);
    expect(p).not.toBeNull();
    expect(Math.abs(p.x - 60.5)).toBeLessThan(1.5);
    expect(Math.abs(p.y - 60.5)).toBeLessThan(1.5);
  });

  it('não mexe quando não há linha branca perto', () => {
    expect(snapToOuterCorner(img, W, H, { x: 150, y: 20 }, centro)).toBeNull();
  });

  it('não mexe numa área toda branca (luz estourada)', () => {
    const branco = new Uint8ClampedArray(W * H * 4).fill(250);
    expect(snapToOuterCorner(branco, W, H, { x: 100, y: 100 }, { x: 150, y: 150 })).toBeNull();
  });

  it('não mexe quando a linha segue até a borda da janela (meio de uma lateral)', () => {
    expect(snapToOuterCorner(img, W, H, { x: 63, y: 120 }, { x: 150, y: 120.5 })).toBeNull();
  });

  it('calcula o centro dos pontos', () => {
    expect(centroid([{ x: 0, y: 0 }, { x: 2, y: 4 }])).toEqual({ x: 1, y: 2 });
  });
});
