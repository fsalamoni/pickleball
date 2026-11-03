/**
 * "Pronto para começar?" — o que falta em cada posição antes do primeiro saque,
 * a partir só da presença das câmeras (`positionOccupancy`). Puro.
 *
 * Gravidade: `block` = a posição não julga nada; `warn` = julga, mas pior.
 */

export const READINESS_LIMITS = Object.freeze({ minFps: 24, lowBattery: 20, maxCheckCm: 6 });

export const READINESS_TEXT = Object.freeze({
  missing: 'sem câmera',
  not_calibrated: 'falta calibrar',
  paused: 'calibrada, mas sem analisar',
  slow: 'menos de 24 quadros/s',
  battery: 'bateria baixa fora do carregador',
  calibration: 'calibração com erro acima de 6 cm',
});

/**
 * @param {string[]} positions  as posições do arranjo
 * @param {Record<string, object|null>} occ  `positionOccupancy(...)`
 * @returns {{ ready: boolean, blocking: number, warnings: number,
 *   issues: { position: string, code: string, level: 'block'|'warn' }[] }}
 */
export function readinessCheck(positions, occ) {
  const L = READINESS_LIMITS;
  const issues = [];
  const add = (position, code, level) => issues.push({ position, code, level });
  for (const p of positions || []) {
    const c = occ?.[p];
    if (!c) { add(p, 'missing', 'block'); continue; }
    if (!c.calibrated) { add(p, 'not_calibrated', 'block'); continue; }
    if (!c.analyzing) add(p, 'paused', 'block');
    if (c.analyzing && c.fps > 0 && c.fps < L.minFps) add(p, 'slow', 'warn');
    if (Number.isFinite(c.battery) && c.battery <= L.lowBattery && c.charging !== true) add(p, 'battery', 'warn');
    if (Number.isFinite(c.check_cm) && c.check_cm > L.maxCheckCm) add(p, 'calibration', 'warn');
  }
  const blocking = issues.filter((i) => i.level === 'block').length;
  return { ready: blocking === 0 && issues.length === 0, blocking, warnings: issues.length - blocking, issues };
}
