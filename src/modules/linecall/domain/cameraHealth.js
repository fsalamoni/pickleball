/**
 * Saúde da câmera durante o jogo — duas perguntas que o motor não faz:
 *
 * 1. **A câmera saiu do lugar?** A calibração vale para UMA posição exata do
 *    aparelho; um esbarrão no tripé de poucos pixels desloca a quadra inteira e
 *    toda marcação dali em diante erra calada. Na calibração guardamos um
 *    pedacinho da imagem em volta de cada ponto marcado; durante o jogo
 *    procuramos cada pedaço por perto. Se a maioria dos que foram ACHADOS se
 *    deslocou, a câmera mexeu. Um jogador parado em cima de um ponto esconde só
 *    aquele pedaço (ele não é achado e não vota).
 * 2. **Tem luz?** Imagem escura obriga o sensor a expor mais tempo, e a bola
 *    vira um rastro que a cor não reconhece.
 *
 * Tudo em tons de cinza sobre a imagem reduzida da análise (`SCAN_W`). Puro.
 */

export const HEALTH = {
  /** Lado do pedaço guardado em volta de cada ponto (px da imagem reduzida). */
  PATCH: 16,
  /** Até onde procurar o pedaço (px). */
  SEARCH: 10,
  /** A partir de quantos px conta como "mexeu". */
  MOVED_PX: 3,
  /** Diferença média por pixel acima da qual o pedaço não foi achado (0–255). */
  MAX_SAD: 28,
  /** Pedaço liso demais não serve para achar nada (desvio dos tons). */
  MIN_TEXTURE: 6,
  /** Brilho médio abaixo do qual a imagem é escura (0–255). */
  DARK: 55,
};

/** Tons de cinza de uma imagem RGBA (`ImageData.data`). */
export function toGray(rgba, w, h) {
  const g = new Uint8Array(w * h);
  for (let i = 0, j = 0; j < g.length; i += 4, j += 1) {
    g[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
  }
  return g;
}

/** Recorta o pedaço centrado em (cx, cy); null se cair fora ou for liso. */
export function cutPatch(gray, w, h, cx, cy, size = HEALTH.PATCH) {
  const half = Math.floor(size / 2);
  const x0 = Math.round(cx) - half;
  const y0 = Math.round(cy) - half;
  if (x0 < 0 || y0 < 0 || x0 + size > w || y0 + size > h) return null;
  const p = new Uint8Array(size * size);
  let sum = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const v = gray[(y0 + y) * w + x0 + x];
      p[y * size + x] = v;
      sum += v;
    }
  }
  const mean = sum / p.length;
  let dev = 0;
  for (let i = 0; i < p.length; i += 1) dev += Math.abs(p[i] - mean);
  if (dev / p.length < HEALTH.MIN_TEXTURE) return null;
  return { data: p, size, cx: Math.round(cx), cy: Math.round(cy) };
}

/**
 * Procura o pedaço em volta de onde ele estava. Devolve o deslocamento do
 * melhor encaixe e a diferença média por pixel, ou null se não achou.
 */
export function matchPatch(gray, w, h, patch, search = HEALTH.SEARCH) {
  if (!patch) return null;
  const { data, size, cx, cy } = patch;
  const half = Math.floor(size / 2);
  let best = null;
  for (let dy = -search; dy <= search; dy += 1) {
    for (let dx = -search; dx <= search; dx += 1) {
      const x0 = cx - half + dx;
      const y0 = cy - half + dy;
      if (x0 < 0 || y0 < 0 || x0 + size > w || y0 + size > h) continue;
      let sad = 0;
      for (let y = 0; y < size && (!best || sad < best.sad); y += 1) {
        const row = (y0 + y) * w + x0;
        for (let x = 0; x < size; x += 1) sad += Math.abs(gray[row + x] - data[y * size + x]);
      }
      if (!best || sad < best.sad) best = { dx, dy, sad };
    }
  }
  if (!best) return null;
  const mean = best.sad / (size * size);
  return mean <= HEALTH.MAX_SAD ? { dx: best.dx, dy: best.dy, sad: mean } : null;
}

/**
 * Junta os encaixes. Precisa de pelo menos dois pedaços achados; a câmera
 * "mexeu" quando a mediana dos deslocamentos passa de `MOVED_PX`.
 * @returns {{ known: boolean, moved: boolean, px: number|null, seen: number }}
 */
export function driftFrom(matches) {
  const ok = (matches || []).filter(Boolean);
  if (ok.length < 2) return { known: false, moved: false, px: null, seen: ok.length };
  const d = ok.map((m) => Math.hypot(m.dx, m.dy)).sort((a, b) => a - b);
  const mid = d.length % 2 ? d[(d.length - 1) / 2] : (d[d.length / 2 - 1] + d[d.length / 2]) / 2;
  return { known: true, moved: mid >= HEALTH.MOVED_PX, px: Math.round(mid * 10) / 10, seen: ok.length };
}

/** Brilho médio (0–255) e se está escuro. */
export function brightness(gray) {
  if (!gray?.length) return { mean: null, dark: false };
  let s = 0;
  const step = 7; // amostra: não precisa de todos os pixels
  let n = 0;
  for (let i = 0; i < gray.length; i += step) { s += gray[i]; n += 1; }
  const mean = Math.round(s / n);
  return { mean, dark: mean < HEALTH.DARK };
}
