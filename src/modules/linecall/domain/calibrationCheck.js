/**
 * CONFERIR a calibração com um 5º ponto.
 *
 * Quatro toques sempre "fecham" (a homografia passa exatamente por eles), então
 * eles sozinhos não dizem se a pessoa tocou no lugar certo. Um quinto ponto
 * conhecido, que NÃO é canto, diz: o erro entre onde a calibração acha que ele
 * está e onde ele está de verdade, em cm, é o erro que as marcações vão ter.
 *
 * O ponto é o "T" da linha central com a linha da cozinha do lado da câmera
 * (fundos, cantos, de cima) — ou, na lateral da rede (calibrada pelas
 * cozinhas), o meio da linha de fundo do lado A.
 */

import { applyHomography } from './homography.js';
import { COURT } from './court.js';
import { CAMERA_POSITIONS } from './cameraLayouts.js';

const { WIDTH: W, NET_Y: N, KITCHEN: K } = COURT;

export const CHECK_LEVEL = Object.freeze({ GREAT: 'great', GOOD: 'good', REDO: 'redo' });
/** Até quantos cm cada nível vai. */
export const CHECK_CM = Object.freeze({ great: 3, good: 6 });

/** O ponto de conferência da posição: `{ id, x, y }` em metros. */
export function checkPointFor(positionId) {
  const p = CAMERA_POSITIONS[positionId] || CAMERA_POSITIONS.fundo_a;
  if (p.corners === 'kitchens') return { id: 'TA', x: W / 2, y: 0 };
  const sideB = /_b/.test(p.id);
  return sideB ? { id: 'KTB', x: W / 2, y: N + K } : { id: 'KTA', x: W / 2, y: N - K };
}

/**
 * @param {number[]} H  imagem → chão
 * @param {{x:number,y:number}} tapped  o toque, em pixels do vídeo
 * @param {{x:number,y:number}} expected  o ponto de verdade, em metros
 */
export function calibrationCheck(H, tapped, expected) {
  const got = applyHomography(H, tapped);
  const cm = Math.hypot(got.x - expected.x, got.y - expected.y) * 100;
  const level = cm <= CHECK_CM.great ? CHECK_LEVEL.GREAT : cm <= CHECK_CM.good ? CHECK_LEVEL.GOOD : CHECK_LEVEL.REDO;
  return { cm: Math.round(cm * 10) / 10, level };
}
