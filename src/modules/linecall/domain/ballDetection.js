/**
 * Achar a bola num quadro — visão computacional clássica, sem modelo treinado.
 *
 * A bola de pickleball é de cor viva (amarelo/verde-limão, laranja) e está
 * quase sempre em MOVIMENTO. Um pixel é candidato quando tem a cor da bola
 * (matiz perto do aprendido, saturação e brilho altos) E mudou desde o quadro
 * anterior. Os candidatos viram manchas (componentes conexos); fica a de
 * tamanho de bola mais perto de onde a bola deveria estar.
 *
 * É o mesmo princípio dos detectores clássicos de bola de tênis, e roda no
 * navegador a 60 quadros sobre uma imagem reduzida. O caminho para mais
 * precisão é trocar esta função por um modelo do tipo TrackNet/WASB treinado
 * com vídeo de pickleball (ver docs/53-CONTROLE-DE-LINHAS.md §4); o motor
 * de decisão não muda.
 */

export const BALL_DEFAULTS = Object.freeze({
  hue: 65, // amarelo-limão (graus)
  hueTol: 28,
  minSat: 0.4,
  minVal: 0.45,
  motion: 40, // soma |ΔR|+|ΔG|+|ΔB| mínima para contar como "mudou"
  minArea: 2,
  maxArea: 400,
  maxJump: 120, // px (na imagem reduzida) entre quadros seguidos
});

/** RGB (0–255) → { h: graus, s: 0–1, v: 0–1 }. */
export function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max / 255 };
}

const hueDiff = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/**
 * Manchas com cor de bola (e em movimento, se houver o quadro anterior).
 * @param {Uint8ClampedArray} rgba
 * @param {Uint8ClampedArray|null} prev o quadro anterior, mesmo tamanho
 * @returns {Array<{ x: number, y: number, area: number }>}
 */
export function findBallCandidates(rgba, prev, width, height, opts = {}) {
  const o = { ...BALL_DEFAULTS, ...opts };
  const n = width * height;
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) {
    const j = i * 4;
    const r = rgba[j]; const g = rgba[j + 1]; const b = rgba[j + 2];
    if (prev && Math.abs(r - prev[j]) + Math.abs(g - prev[j + 1]) + Math.abs(b - prev[j + 2]) < o.motion) continue;
    const { h, s, v } = rgbToHsv(r, g, b);
    if (s >= o.minSat && v >= o.minVal && hueDiff(h, o.hue) <= o.hueTol) mask[i] = 1;
  }
  const out = [];
  const stack = [];
  for (let i = 0; i < n; i += 1) {
    if (mask[i] !== 1) continue;
    mask[i] = 2;
    stack.push(i);
    let area = 0; let sx = 0; let sy = 0;
    while (stack.length) {
      const k = stack.pop();
      const x = k % width; const y = (k - x) / width;
      area += 1; sx += x; sy += y;
      if (x > 0 && mask[k - 1] === 1) { mask[k - 1] = 2; stack.push(k - 1); }
      if (x < width - 1 && mask[k + 1] === 1) { mask[k + 1] = 2; stack.push(k + 1); }
      if (y > 0 && mask[k - width] === 1) { mask[k - width] = 2; stack.push(k - width); }
      if (y < height - 1 && mask[k + width] === 1) { mask[k + width] = 2; stack.push(k + width); }
    }
    if (area >= o.minArea && area <= o.maxArea) out.push({ x: sx / area, y: sy / area, area });
  }
  return out;
}

/**
 * A bola entre os candidatos: a mais perto da posição esperada; sem
 * referência, a maior mancha. Longe demais do esperado = não é a bola.
 */
export function pickBall(candidates, expected = null, opts = {}) {
  const o = { ...BALL_DEFAULTS, ...opts };
  if (!candidates.length) return null;
  if (!expected) return [...candidates].sort((a, b) => b.area - a.area)[0];
  const best = candidates
    .map((c) => ({ c, d: Math.hypot(c.x - expected.x, c.y - expected.y) }))
    .sort((a, b) => a.d - b.d)[0];
  return best.d <= o.maxJump ? best.c : null;
}
