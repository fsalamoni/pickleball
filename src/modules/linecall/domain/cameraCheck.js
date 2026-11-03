/**
 * A câmera serve para o controle de linhas? Responde com o que a câmera
 * ENTREGOU (não o que foi pedido: o navegador pede 120 quadros e a câmera dá
 * 30 sem avisar) e com o que a calibração mostra da quadra.
 *
 * Os números saem da física do jogo: a bola de pickleball anda 10–25 m/s;
 * a 30 quadros ela percorre até 80 cm entre duas fotos, a 60 até 40 cm, a
 * 120 até 20 cm. O ponto do quique é estimado entre quadros, e a incerteza
 * cresce com esse salto.
 */

import { metersPerPixel } from './homography.js';

export const CAMERA_LEVEL = Object.freeze({ OK: 'ok', WARN: 'warn', BLOCK: 'block' });

export const CAMERA_MIN = Object.freeze({ fps: 30, height: 720 });
export const CAMERA_GOOD = Object.freeze({ fps: 60, height: 1080 });

/**
 * @param {{ width?: number, height?: number, frameRate?: number }} settings
 *   o `getSettings()` da trilha de vídeo
 * @returns {Array<{ level: string, key: string, value: number|null }>}
 */
export function assessCamera(settings = {}) {
  const fps = Number(settings.frameRate) || null;
  const h = Math.min(Number(settings.width) || 0, Number(settings.height) || 0) || null;
  const level = (v, min, good) => {
    if (v == null) return CAMERA_LEVEL.WARN;
    if (v < min) return CAMERA_LEVEL.BLOCK;
    return v < good ? CAMERA_LEVEL.WARN : CAMERA_LEVEL.OK;
  };
  return [
    { key: 'fps', value: fps, level: level(fps, CAMERA_MIN.fps, CAMERA_GOOD.fps) },
    { key: 'resolution', value: h, level: level(h, CAMERA_MIN.height, CAMERA_GOOD.height) },
  ];
}

/**
 * Quantos centímetros de chão cabem num pixel no PIOR canto da quadra (o
 * mais longe da câmera). Acima de 3 cm/px a linha de fundo de lá vira um
 * borrão de um ou dois pixels.
 * @param {number[]} H imagem → quadra
 * @param {Array<{x,y}>} imageCorners os quatro cantos tocados
 */
export function worstCmPerPixel(H, imageCorners) {
  return Math.max(...imageCorners.map((p) => metersPerPixel(H, p))) * 100;
}

/** O pior nível de uma lista de avaliações. */
export function worstLevel(items) {
  if (items.some((i) => i.level === CAMERA_LEVEL.BLOCK)) return CAMERA_LEVEL.BLOCK;
  if (items.some((i) => i.level === CAMERA_LEVEL.WARN)) return CAMERA_LEVEL.WARN;
  return CAMERA_LEVEL.OK;
}
