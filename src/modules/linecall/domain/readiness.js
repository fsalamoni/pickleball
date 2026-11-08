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
  moved: 'a câmera saiu do lugar: calibrar de novo',
  dark: 'imagem escura demais',
  glare: 'sol ou reflexo forte na imagem',
});

/**
 * As posições que estão JULGANDO agora: câmera no ar, calibrada, analisando e
 * no lugar. A central compara de um retrato para o outro (`stoppedJudging`)
 * para AVISAR quando uma câmera para no meio do jogo — o sistema não pode
 * parar calado (Wimbledon 2025: metade da quadra ficou sem chamada por um
 * game e ninguém foi avisado).
 */
export function judgingPositions(positions, occ) {
  return (positions || []).filter((p) => {
    const c = occ?.[p];
    return Boolean(c && c.calibrated && c.analyzing && c.alert !== 'moved');
  });
}

/** As que julgavam no retrato anterior e não julgam mais. */
export function stoppedJudging(before, now) {
  const agora = new Set(now || []);
  return (before || []).filter((p) => !agora.has(p));
}

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
    // A câmera mesma conta (`cameraHealth`): saiu do lugar = mede errado; escura = perde a bola.
    if (c.alert === 'moved') add(p, 'moved', 'block');
    else if (c.alert === 'dark') add(p, 'dark', 'warn');
    else if (c.alert === 'glare') add(p, 'glare', 'warn');
  }
  const blocking = issues.filter((i) => i.level === 'block').length;
  return { ready: blocking === 0 && issues.length === 0, blocking, warnings: issues.length - blocking, issues };
}
