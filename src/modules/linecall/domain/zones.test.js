import { describe, it, expect } from 'vitest';
import { COURT } from './court.js';
import { solveHomography, applyHomography } from './homography.js';
import {
  CAMERA_ZONES, zoneById, zoneCalibrationPoints, zoneCheckPoint, eventInZone, pointInZone,
} from './zones.js';

const { WIDTH: W, LENGTH: L, NET_Y: N, KITCHEN: K } = COURT;
const bounce = (y, x = 2) => ({ type: 'bounce', point: { x, y } });

describe('área vigiada pela câmera', () => {
  it('sem área gravada vale a quadra inteira, com os pontos da posição (calibração antiga segue igual)', () => {
    expect(zoneById(undefined).id).toBe('full');
    expect(zoneCalibrationPoints(undefined)).toBeNull();
    expect(zoneCheckPoint('full')).toBeNull();
    expect(eventInZone(bounce(-3), 'full')).toBe(true);
  });

  it('cada parte tem quatro cantos pintados que fecham uma calibração, e um 5º ponto que não é canto', () => {
    CAMERA_ZONES.filter((z) => z.points).forEach((z) => {
      const pts = zoneCalibrationPoints(z.id);
      expect(pts).toHaveLength(4);
      // a área dos quatro cantos é exatamente a da parte
      expect(Math.min(...pts.map((p) => p.y))).toBeCloseTo(z.y0);
      expect(Math.max(...pts.map((p) => p.y))).toBeCloseTo(z.y1);
      const img = pts.map((p) => ({ x: p.x * 50 + 7, y: p.y * 30 + 3 }));
      const H = solveHomography(img, pts);
      const c = zoneCheckPoint(z.id);
      expect(pts.some((p) => p.id === c.id)).toBe(false);
      const back = applyHomography(H, { x: c.x * 50 + 7, y: c.y * 30 + 3 });
      expect(back.x).toBeCloseTo(c.x);
      expect(back.y).toBeCloseTo(c.y);
    });
  });

  it('só o fundo do lado A: a bola longa é dela, a do outro lado da rede não', () => {
    expect(eventInZone(bounce(-0.5), 'back_a')).toBe(true);
    expect(eventInZone(bounce(1), 'back_a')).toBe(true);
    // na linha da cozinha (borda da área) ainda é dela
    expect(eventInZone(bounce(N - K + 0.1), 'back_a')).toBe(true);
    expect(eventInZone(bounce(N - 0.2), 'back_a')).toBe(false);
    expect(eventInZone(bounce(L - 1), 'back_a')).toBe(false);
  });

  it('só as cozinhas: pé na cozinha dos dois lados, nada de fundo nem de pé no saque', () => {
    expect(eventInZone({ type: 'volley', point: { x: 2, y: N - 1 } }, 'kitchens')).toBe(true);
    expect(eventInZone({ type: 'volley', point: { x: 2, y: N + 1 } }, 'kitchens')).toBe(true);
    expect(eventInZone({ type: 'serve_foot', point: { x: 2, y: -0.1 } }, 'kitchens')).toBe(false);
    expect(eventInZone(bounce(0.3), 'kitchens')).toBe(false);
    expect(eventInZone(bounce(N + K - 0.1), 'kitchens')).toBe(true);
  });

  it('o pé de quem saca é de quem vê aquela linha de fundo; a cozinha, de quem a cobre inteira', () => {
    expect(eventInZone({ type: 'serve_foot', point: { x: 2, y: L + 0.2 } }, 'half_b')).toBe(true);
    expect(eventInZone({ type: 'serve_foot', point: { x: 2, y: -0.2 } }, 'half_b')).toBe(false);
    expect(eventInZone({ type: 'volley', point: { x: 2, y: N - 0.5 } }, 'back_a')).toBe(false);
    expect(eventInZone({ type: 'volley', point: { x: 2, y: N - 0.5 } }, 'kitchen_a')).toBe(true);
    expect(eventInZone({ type: 'volley', point: { x: 2, y: N + 0.5 } }, 'kitchen_a')).toBe(false);
  });

  it('lance sem ponto conhecido fica (melhor revisar do que calar)', () => {
    expect(eventInZone({ type: 'two_bounce', point: null }, 'back_a')).toBe(true);
  });

  it('a bola larga (fora pela lateral) é da área do trecho onde caiu', () => {
    expect(pointInZone({ x: -1, y: 2 }, 'back_a')).toBe(true);
    expect(pointInZone({ x: W + 1, y: 2 }, 'kitchen_a')).toBe(false);
  });
});
