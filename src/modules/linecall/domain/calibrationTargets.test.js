import { describe, it, expect } from 'vitest';
import { calibrationTargets } from './cameraLayouts.js';
import { checkPointFor } from './calibrationCheck.js';
import { sanitizeCalib, calibForDb } from './remoteCalib.js';

const ids = (pts) => pts.map((p) => p.id);
const quatro = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }];

describe('os pontos que a calibração toca', () => {
  it('quadra inteira na lateral da rede marca os quatro cantos da quadra, não as cozinhas', () => {
    const pts = calibrationTargets({ zone: 'full', corners: [] }, 'rede_1');
    expect(ids(pts)).toEqual(['A1', 'A2', 'B2', 'B1']);
    // o 5º ponto não pode ser um dos cantos tocados
    expect(checkPointFor('rede_1', pts).id).toBe('KTA');
  });

  it('a calibração antiga da lateral (sem pts) segue lida pelas cozinhas, como foi marcada', () => {
    const pts = calibrationTargets({ zone: 'full', corners: quatro }, 'rede_1');
    expect(ids(pts)).toEqual(['KA1', 'KA2', 'KB2', 'KB1']);
    expect(checkPointFor('rede_1', pts).id).toBe('TA');
  });

  it('os pontos gravados na marcação valem, mesmo que a regra mude', () => {
    const pts = calibrationTargets({ zone: 'full', pts: ['A1', 'A2', 'B2', 'B1'], corners: quatro }, 'rede_1');
    expect(ids(pts)).toEqual(['A1', 'A2', 'B2', 'B1']);
  });

  it('uma parte da quadra usa os cantos dela; o fundo segue com os cantos da quadra', () => {
    expect(ids(calibrationTargets({ zone: 'kitchens' }, 'rede_1'))).toEqual(['KA1', 'KA2', 'KB2', 'KB1']);
    expect(ids(calibrationTargets({ zone: 'full', corners: quatro }, 'fundo_a'))).toEqual(['A1', 'A2', 'B2', 'B1']);
    expect(checkPointFor('fundo_b', calibrationTargets({}, 'fundo_b')).id).toBe('KTB');
  });

  it('pts vai e volta pelo banco; lixo é descartado', () => {
    const c = { corners: quatro, hue: 60, checkTap: null, zone: 'full', pts: ['A1', 'A2', 'B2', 'B1'] };
    expect(calibForDb(c).pts).toEqual(['A1', 'A2', 'B2', 'B1']);
    expect(sanitizeCalib({ ...c, pts: ['A1', 'X9', 'B2', 'B1'] }).pts).toBeUndefined();
  });
});
