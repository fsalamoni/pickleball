import { describe, it, expect } from 'vitest';
import { solveHomography, applyHomography, estimateCamera, liftToGround } from './homography.js';
import { COURT, BALL_RADIUS } from './court.js';

/** Uma câmera de verdade: centro C, olhando para L, foco f (px), imagem w×h. */
function camera(C, L, f, w = 1920, h = 1080) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const n = Math.hypot(...a); return a.map((v) => v / n); };
  const fwd = norm(sub(L, C));
  const right = norm(cross(fwd, [0, 0, 1]));
  const down = cross(fwd, right);
  const project = ([X, Y, Z]) => {
    const d = sub([X, Y, Z], C);
    const xc = right[0] * d[0] + right[1] * d[1] + right[2] * d[2];
    const yc = down[0] * d[0] + down[1] * d[1] + down[2] * d[2];
    const zc = fwd[0] * d[0] + fwd[1] * d[1] + fwd[2] * d[2];
    return { x: f * xc / zc + w / 2, y: f * yc / zc + h / 2 };
  };
  const corners = [[0, 0], [COURT.WIDTH, 0], [COURT.WIDTH, COURT.LENGTH], [0, COURT.LENGTH]];
  const H = solveHomography(corners.map(([x, y]) => project([x, y, 0])), corners.map(([x, y]) => ({ x, y })));
  return { H, project, size: { w, h } };
}

describe('estimateCamera — onde está a câmera, pela calibração', () => {
  it('acha a câmera atrás do fundo, a 4 m de altura', () => {
    const cam = camera([3.048, -3, 4], [3.048, 7, 0], 1400);
    const c = estimateCamera(cam.H, cam.size);
    expect(c.x).toBeCloseTo(3.048, 3);
    expect(c.y).toBeCloseTo(-3, 3);
    expect(c.z).toBeCloseTo(4, 3);
    expect(c.f).toBeCloseTo(1400, 0);
  });

  it('acha a câmera de canto, girada', () => {
    const cam = camera([-2, -1.5, 2.6], [4, 9, 0], 1000);
    const c = estimateCamera(cam.H, cam.size);
    expect(c.x).toBeCloseTo(-2, 2);
    expect(c.y).toBeCloseTo(-1.5, 2);
    expect(c.z).toBeCloseTo(2.6, 2);
  });

  it('com 2 px de erro nos toques, a altura erra pouco', () => {
    const cam = camera([3.048, -3, 4], [3.048, 7, 0], 1400);
    const corners = [[0, 0], [COURT.WIDTH, 0], [COURT.WIDTH, COURT.LENGTH], [0, COURT.LENGTH]];
    const jitter = [[2, -2], [-2, 2], [2, 2], [-2, -2]];
    const img = corners.map(([x, y], i) => {
      const p = cam.project([x, y, 0]);
      return { x: p.x + jitter[i][0], y: p.y + jitter[i][1] };
    });
    const H = solveHomography(img, corners.map(([x, y]) => ({ x, y })));
    const c = estimateCamera(H, cam.size);
    expect(c).not.toBeNull();
    expect(Math.abs(c.z - 4)).toBeLessThan(0.6);
  });

  it('câmera de cima para baixo não tem perspectiva: devolve null', () => {
    // Imagem paralela ao chão: a homografia é só escala e deslocamento.
    const H = [0.01, 0, -3, 0, 0.01, -2, 0, 0, 1];
    expect(estimateCamera(H, { w: 1920, h: 1080 })).toBeNull();
  });

  it('sem tamanho da imagem, não estima', () => {
    const cam = camera([3.048, -3, 4], [3.048, 7, 0], 1400);
    expect(estimateCamera(cam.H, null)).toBeNull();
  });
});

describe('liftToGround — o que não está no chão', () => {
  it('a bola no quique, perto do fundo distante: sem a correção erra ~15 cm', () => {
    const cam = camera([3.048, -3, 4], [3.048, 7, 0], 1400);
    const real = { x: 3, y: COURT.LENGTH - 0.02 };
    const img = cam.project([real.x, real.y, BALL_RADIUS]);
    const noChao = applyHomography(cam.H, img);
    // Projetada como se estivesse no chão, a bola "cai" além do fundo.
    expect(noChao.y - real.y).toBeGreaterThan(0.14);
    const c = estimateCamera(cam.H, cam.size);
    const certo = liftToGround(noChao, c, BALL_RADIUS);
    expect(certo.x).toBeCloseTo(real.x, 4);
    expect(certo.y).toBeCloseTo(real.y, 4);
  });

  it('sem câmera conhecida, devolve o ponto como veio', () => {
    const p = { x: 1, y: 2 };
    expect(liftToGround(p, null, 0.03)).toBe(p);
    expect(liftToGround(p, { x: 0, y: 0, z: 4 }, 0)).toBe(p);
  });
});
