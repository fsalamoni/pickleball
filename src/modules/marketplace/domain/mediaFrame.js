/**
 * MERCADO — enquadramento das fotos do anúncio (puro, sem React).
 *
 * O arquivo enviado nunca é alterado: girar, aproximar e escolher o centro
 * são DADOS da foto (`media[].frame`), aplicados por CSS. Assim a foto
 * ampliada é sempre a original inteira (só girada), e o card mostra o recorte
 * escolhido pelo vendedor.
 *
 *  - `aspect`: largura ÷ altura do arquivo, medido no editor ao carregar.
 *  - `frame.rotate`: 0 | 90 | 180 | 270 (horário).
 *  - `frame.zoom`: 1 a 4 (1 = a foto cobre o card sem sobra).
 *  - `frame.x`, `frame.y`: o ponto da foto (já girada, 0 a 1) que fica no
 *    centro do card.
 *
 * Foto sem `aspect` (anúncios antigos) é desenhada como sempre foi
 * (`object-cover`): sem a proporção não há como posicionar o recorte.
 */

export const DEFAULT_FRAME = Object.freeze({ rotate: 0, zoom: 1, x: 0.5, y: 0.5 });
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** A proporção válida (0,1 a 10) ou `null`. */
export function normalizeAspect(aspect) {
  const a = Number(aspect);
  return Number.isFinite(a) && a >= 0.1 && a <= 10 ? Math.round(a * 10000) / 10000 : null;
}

/** O enquadramento limpo: rotação em múltiplos de 90, zoom e centro nos limites. */
export function normalizeFrame(frame) {
  if (!frame || typeof frame !== 'object') return { ...DEFAULT_FRAME };
  const r = Math.round(num(frame.rotate, 0) / 90) * 90;
  const round = (v) => Math.round(v * 1000) / 1000;
  return {
    rotate: ((r % 360) + 360) % 360,
    zoom: round(clamp(num(frame.zoom, 1), ZOOM_MIN, ZOOM_MAX)),
    x: round(clamp(num(frame.x, 0.5), 0, 1)),
    y: round(clamp(num(frame.y, 0.5), 0, 1)),
  };
}

export const isDefaultFrame = (frame) => {
  const f = normalizeFrame(frame);
  return f.rotate === 0 && f.zoom === 1 && f.x === 0.5 && f.y === 0.5;
};

/** Proporção depois de girar: 90° e 270° trocam largura e altura. */
export const rotatedAspect = (aspect, rotate = 0) => (rotate % 180 ? 1 / aspect : aspect);

/**
 * Tamanho da foto girada no modo CARD, em frações do card (1 = o card todo).
 * `boxAspect` é largura ÷ altura do card (1 = quadrado).
 */
function coverSize(aspect, frame, boxAspect) {
  const a = rotatedAspect(aspect, frame.rotate);
  const [w, h] = a >= boxAspect ? [a / boxAspect, 1] : [1, boxAspect / a];
  return { w: w * frame.zoom, h: h * frame.zoom };
}

/** Prende o centro escolhido para a foto nunca deixar sobra no card. */
export function clampFrame(aspect, frame, boxAspect = 1) {
  const f = normalizeFrame(frame);
  if (!normalizeAspect(aspect)) return f;
  const { w, h } = coverSize(aspect, f, boxAspect);
  return { ...f, x: clamp(f.x, 0.5 / w, 1 - 0.5 / w), y: clamp(f.y, 0.5 / h, 1 - 0.5 / h) };
}

/**
 * A caixa da foto girada dentro do card, em % do card:
 * `{ left, top, width, height }`. `cover` aplica o recorte; `contain` mostra
 * a foto inteira, centralizada.
 */
export function photoBox(aspect, frame, { mode = 'cover', boxAspect = 1 } = {}) {
  const f = normalizeFrame(frame);
  if (mode === 'contain') {
    const a = rotatedAspect(aspect, f.rotate);
    const [w, h] = a >= boxAspect ? [1, boxAspect / a] : [a / boxAspect, 1];
    return { left: ((1 - w) / 2) * 100, top: ((1 - h) / 2) * 100, width: w * 100, height: h * 100 };
  }
  const c = clampFrame(aspect, f, boxAspect);
  const { w, h } = coverSize(aspect, c, boxAspect);
  return {
    left: clamp(0.5 - c.x * w, 1 - w, 0) * 100,
    top: clamp(0.5 - c.y * h, 1 - h, 0) * 100,
    width: w * 100,
    height: h * 100,
  };
}

/**
 * O tamanho do `<img>` (ainda sem girar) dentro da caixa girada, em % da
 * caixa. Em 90°/270° a largura do arquivo ocupa a ALTURA da caixa.
 */
export function innerImageSize(box, rotate, boxAspect = 1) {
  if (!(rotate % 180)) return { width: 100, height: 100 };
  // proporção da caixa em pixels: (width% × larguraCard) ÷ (height% × alturaCard)
  const ratio = (box.width / box.height) * boxAspect;
  return { width: 100 / ratio, height: 100 * ratio };
}

/** Arrastar no editor: desloca o centro (dx, dy em frações do card). */
export function panFrame(aspect, frame, dx, dy, boxAspect = 1) {
  const f = clampFrame(aspect, frame, boxAspect);
  const { w, h } = coverSize(aspect, f, boxAspect);
  return clampFrame(aspect, { ...f, x: f.x - dx / w, y: f.y - dy / h }, boxAspect);
}

/** Gira 90° (horário, ou anti-horário com `dir = -1`), mantendo o mesmo ponto no centro. */
export function rotateFrame(aspect, frame, dir = 1, boxAspect = 1) {
  const f = normalizeFrame(frame);
  const next = dir > 0
    ? { ...f, rotate: f.rotate + 90, x: 1 - f.y, y: f.x }
    : { ...f, rotate: f.rotate + 270, x: f.y, y: 1 - f.x };
  return clampFrame(aspect, next, boxAspect);
}

export function zoomFrame(aspect, frame, zoom, boxAspect = 1) {
  return clampFrame(aspect, { ...normalizeFrame(frame), zoom }, boxAspect);
}
