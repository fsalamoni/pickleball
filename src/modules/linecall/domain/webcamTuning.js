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
 * QUADROS antes de pixels: o navegador escolhe o modo mais perto do pedido
 * (1080p e 120 q/s), e muita câmera abre em 1080p a 30 quando teria 720p a 60.
 * Para a bola, 60 q/s em 720p rendem mais que 30 em 1080p (a bola anda
 * metade entre um quadro e outro). Devolve as restrições da troca, ou null
 * quando não há o que ganhar.
 * @param {{ frameRate?: number, height?: number }} settings o que a câmera entregou
 * @param {object} caps `track.getCapabilities()`
 */
export function framesFirst(settings, caps) {
  const fps = settings?.frameRate;
  const max = caps?.frameRate?.max;
  if (!Number.isFinite(fps) || !Number.isFinite(max)) return null;
  if (fps >= 50 || max < 50 || !(settings.height > 720)) return null;
  return { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: Math.min(max, 120), min: 50 } };
}

/**
 * TRAVAR foco e cor depois de enquadrar: com o foco automático a lente
 * "respira" quando um jogador passa perto (a imagem mexe um pouco e a
 * calibração deixa de bater) e a cor da bola muda com o balanço de branco.
 * @returns {{ focus: boolean, color: boolean }} o que ESTA câmera deixa travar
 */
export function lockOptions(caps) {
  const fm = Array.isArray(caps?.focusMode) ? caps.focusMode : [];
  const wb = Array.isArray(caps?.whiteBalanceMode) ? caps.whiteBalanceMode : [];
  return { focus: fm.includes('manual') || fm.includes('single-shot'), color: wb.includes('manual') };
}

/** As restrições que travam (ou soltam) foco e cor, no ponto de agora. */
export function lockConstraints(caps, settings, lock) {
  const o = lockOptions(caps);
  const fm = Array.isArray(caps?.focusMode) ? caps.focusMode : [];
  const adv = [];
  if (o.focus) {
    if (!lock) adv.push({ focusMode: 'continuous' });
    else if (fm.includes('manual') && Number.isFinite(settings?.focusDistance)) adv.push({ focusMode: 'manual', focusDistance: settings.focusDistance });
    else adv.push({ focusMode: fm.includes('single-shot') ? 'single-shot' : 'manual' });
  }
  if (o.color) adv.push({ whiteBalanceMode: lock ? 'manual' : 'continuous' });
  return adv.length ? { advanced: adv } : null;
}

/**
 * A GRANDE-ANGULAR pelo zoom: em parte dos Android a lente 0,5× não aparece
 * na lista de câmeras, mas a câmera aceita zoom abaixo de 1. Devolve esse
 * zoom (o mínimo), ou null quando não há.
 */
export function wideZoom(caps) {
  const min = caps?.zoom?.min;
  return Number.isFinite(min) && min < 1 ? min : null;
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
