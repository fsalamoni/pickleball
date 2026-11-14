import { describe, it, expect } from 'vitest';
import { cameraViewRotation, viewOf, viewSides, spotInView, calibrationPoints } from './cameraLayouts.js';
import { zoneCalibrationPoints, CAMERA_ZONES } from './zones.js';
import { COURT_POINTS } from './court.js';

describe('a quadra vista de cada câmera', () => {
  it('a lateral da rede vê a quadra deitada: lado 1 perto, lado A à direita (rede_1)', () => {
    expect(cameraViewRotation('rede_1')).toBe(-90);
    expect(cameraViewRotation('rede_2')).toBe(90);
    expect(viewSides('rede_1')).toEqual({ A: 'right', B: 'left' });
    expect(viewSides('rede_2')).toEqual({ A: 'left', B: 'right' });
    expect(spotInView('rede_1', COURT_POINTS.KA1)).toBe('perto da câmera, à direita');
    expect(spotInView('rede_1', COURT_POINTS.KB2)).toBe('longe da câmera, à esquerda');
    expect(spotInView('rede_2', COURT_POINTS.KA2)).toBe('perto da câmera, à esquerda');
    expect(spotInView('rede_1', COURT_POINTS.N1)).toBe('perto da câmera, no meio');
    // O 5º ponto da lateral (meio do fundo A) fica na ponta direita da imagem.
    expect(spotInView('rede_1', { x: 3.048, y: 0 })).toBe('na ponta direita da imagem');
  });

  it('o fundo A vê o lado 1 à esquerda; o fundo B, de ponta-cabeça', () => {
    expect(viewSides('fundo_a')).toBeNull();
    expect(spotInView('fundo_a', COURT_POINTS.A1)).toBe('perto da câmera, à esquerda');
    expect(spotInView('fundo_b', COURT_POINTS.A1)).toBe('longe da câmera, à direita');
    expect(spotInView('fundo_b', COURT_POINTS.B2)).toBe('perto da câmera, à esquerda');
    expect(cameraViewRotation('canto_b2')).toBe(180);
  });

  it('a de cima e os cantos não dizem direita/esquerda', () => {
    expect(viewOf('topo', COURT_POINTS.A1)).toBeNull();
    expect(spotInView('canto_a1', COURT_POINTS.A1)).toBeNull();
  });

  it('em toda área, os quatro pontos dão a volta na imagem da lateral (a ordem de toque não cruza)', () => {
    const lado = (a, b, c) => Math.sign((b.u - a.u) * (c.v - a.v) - (b.v - a.v) * (c.u - a.u));
    const sets = [calibrationPoints('rede_1'), ...CAMERA_ZONES.map((z) => zoneCalibrationPoints(z.id)).filter(Boolean)];
    ['rede_1', 'rede_2', 'fundo_a', 'fundo_b'].forEach((pos) => sets.forEach((set) => {
      const q = set.map((p) => viewOf(pos, p));
      const turns = q.map((_, i) => lado(q[i], q[(i + 1) % 4], q[(i + 2) % 4]));
      expect(new Set(turns).size).toBe(1);
    }));
  });
});
