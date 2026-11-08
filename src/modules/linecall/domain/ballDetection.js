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
// A máscara é reaproveitada entre quadros do mesmo tamanho: a cada quadro
// (30–60 por segundo) alocar 130 mil bytes e um objeto de cor POR PIXEL era o
// que mais pesava na coleta de lixo do celular.
let maskBuf = null;

export function findBallCandidates(rgba, prev, width, height, opts = {}) {
  const o = { ...BALL_DEFAULTS, ...opts };
  const n = width * height;
  if (!maskBuf || maskBuf.length !== n) maskBuf = new Uint8Array(n);
  else maskBuf.fill(0);
  const mask = maskBuf;
  const minV = o.minVal * 255;
  for (let i = 0; i < n; i += 1) {
    const j = i * 4;
    const r = rgba[j]; const g = rgba[j + 1]; const b = rgba[j + 2];
    if (prev && Math.abs(r - prev[j]) + Math.abs(g - prev[j + 1]) + Math.abs(b - prev[j + 2]) < o.motion) continue;
    // O mesmo HSV de `rgbToHsv`, sem criar objeto e saindo cedo pelo brilho e pela saturação.
    const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    if (max < minV) continue;
    const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
    const d = max - min;
    if (!d || d / max < o.minSat) continue;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    if (hueDiff(h, o.hue) <= o.hueTol) mask[i] = 1;
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
 * Onde a bola deve estar no próximo quadro: seguindo o rumo dos dois últimos
 * (velocidade constante), como fazem os rastreadores abertos (PickleIQ,
 * TrackNet com Kalman). Num drive a 30 quadros/s a bola anda dezenas de pixels
 * por quadro; procurar perto de onde ela ESTAVA escolhe a mancha errada quando
 * há outra coisa amarela no caminho (camisa, bola da quadra vizinha). Sem o
 * quadro anterior, é a última posição — o de sempre.
 */
export function predictNext(last, before) {
  if (!last) return null;
  if (!before) return last;
  return { x: 2 * last.x - before.x, y: 2 * last.y - before.y };
}

/**
 * A bola entre os candidatos: a mais perto da posição esperada; sem
 * referência, a maior mancha. Longe demais do esperado = não é a bola.
 */
export function pickBall(candidates, expected = null, opts = {}) {
  const o = { ...BALL_DEFAULTS, ...opts };
  if (!candidates.length) return null;
  if (!expected) return [...candidates].sort((a, b) => b.area - a.area)[0];
  // `anchor`: a última posição vista. Com a previsão (`predictNext`) em
  // `expected`, vence a mais perto da previsão, mas vale a que está perto de
  // uma OU de outra: no quique e na batida a bola volta e se afasta da
  // previsão, e continua perto de onde estava.
  const near = (c, p) => (p ? Math.hypot(c.x - p.x, c.y - p.y) : Infinity);
  const best = candidates
    .map((c) => ({ c, d: near(c, expected), ok: Math.min(near(c, expected), near(c, o.anchor)) <= o.maxJump }))
    .filter((x) => x.ok)
    .sort((a, b) => a.d - b.d)[0];
  return best ? best.c : null;
}
