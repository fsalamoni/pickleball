/**
 * O ajuste fino da WEBCAM, pelo próprio navegador (docs/53 §5b):
 *
 * - OBTURADOR: no automático a webcam alonga a exposição na luz de quadra
 *   coberta e a bola vira um risco borrado. Quando a câmera deixa
 *   (`getCapabilities().exposureMode` com `manual`), a tela oferece tempos
 *   curtos. A unidade de `exposureTime` é 100 µs (W3C Image Capture): 1/1000 s = 10.
 * - QUADROS DE VERDADE: a webcam ANUNCIA 60 e entrega 30 com pouca luz.
 *   `track.stats.deliveredFrames` (Chrome) diz o que chegou.
 */

/** Os tempos de obturador oferecidos, do mais longo ao mais curto. */
export const SHUTTER_STEPS = Object.freeze([
  { id: 's250', label: '1/250', units: 40 },
  { id: 's500', label: '1/500', units: 20 },
  { id: 's1000', label: '1/1000', units: 10 },
]);

/**
 * Os tempos que ESTA câmera aceita. Vazio = a câmera não deixa mudar
 * (a tela não mostra nada).
 * @param {object} caps o retorno de `track.getCapabilities()`
 */
export function shutterOptions(caps) {
  const modes = Array.isArray(caps?.exposureMode) ? caps.exposureMode : [];
  const range = caps?.exposureTime;
  if (!modes.includes('manual') || !range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) return [];
  return SHUTTER_STEPS.filter((s) => s.units >= range.min && s.units <= range.max);
}

/** As restrições que põem o obturador num tempo (ou de volta no automático). */
export function shutterConstraints(step, caps) {
  if (!step) {
    const modes = Array.isArray(caps?.exposureMode) ? caps.exposureMode : [];
    return { advanced: [{ exposureMode: modes.includes('continuous') ? 'continuous' : 'manual' }] };
  }
  return { advanced: [{ exposureMode: 'manual', exposureTime: step.units }] };
}

/**
 * Quadros por segundo que CHEGARAM entre duas leituras de `track.stats`.
 * null se não dá para saber (navegador sem `stats`, leitura muito curta).
 * @param {{ deliveredFrames: number, at: number }|null} a
 * @param {{ deliveredFrames: number, at: number }|null} b
 */
export function deliveredFps(a, b) {
  if (!a || !b) return null;
  const dt = (b.at - a.at) / 1000;
  const df = b.deliveredFrames - a.deliveredFrames;
  if (!(dt >= 0.5) || !Number.isFinite(df) || df < 0) return null;
  return Math.round(df / dt);
}

/**
 * A webcam entrega bem menos do que anuncia? (10% de folga: o relógio do
 * navegador e o da câmera nunca batem exato.)
 */
export function fpsShortfall(announced, delivered) {
  if (!Number.isFinite(announced) || !Number.isFinite(delivered) || announced <= 0) return false;
  return delivered < announced * 0.9;
}
