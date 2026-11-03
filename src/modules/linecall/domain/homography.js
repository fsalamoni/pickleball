/**
 * Homografia (plano da quadra ⇄ imagem da câmera), em JavaScript puro.
 *
 * É o mesmo cálculo de `cv2.getPerspectiveTransform` (OpenCV): quatro pontos
 * conhecidos no chão da quadra, tocados na imagem, definem a transformação
 * projetiva 3×3. Vale para o que está NO CHÃO — o quique da bola e o pé
 * apoiado. Bola no ar não está no plano e não pode ser projetada assim.
 *
 * Escrito aqui (≈60 linhas) em vez de puxar o OpenCV.js (≈8 MB) para uma
 * conta de 8 equações.
 */

/** Resolve A·x = b por eliminação de Gauss com pivotamento parcial. */
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c += 1) {
    let p = c;
    for (let r = c + 1; r < n; r += 1) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null; // pontos colineares: sem solução
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r += 1) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k += 1) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * Homografia que leva `src[i]` em `dst[i]` (4 pares `{x, y}`).
 * @returns {number[]|null} matriz 3×3 em linha (9 números), ou null se degenerada
 */
export function solveHomography(src, dst) {
  if (!Array.isArray(src) || !Array.isArray(dst) || src.length !== 4 || dst.length !== 4) return null;
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  return h ? [...h, 1] : null;
}

/** Aplica a homografia a um ponto. */
export function applyHomography(H, { x, y }) {
  const w = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
}

/** Inversa de uma matriz 3×3 (em linha). */
export function invertHomography(H) {
  const [a, b, c, d, e, f, g, h, i] = H;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  return [
    A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det,
  ];
}

/**
 * Quantos METROS de chão cabem num pixel da imagem, naquele ponto. É o que
 * diz se a câmera enxerga a linha do fundo com detalhe suficiente: longe da
 * câmera um pixel cobre muito mais chão que perto.
 * @param {number[]} H imagem → quadra
 */
export function metersPerPixel(H, pt) {
  const o = applyHomography(H, pt);
  const dx = applyHomography(H, { x: pt.x + 1, y: pt.y });
  const dy = applyHomography(H, { x: pt.x, y: pt.y + 1 });
  return Math.max(Math.hypot(dx.x - o.x, dx.y - o.y), Math.hypot(dy.x - o.x, dy.y - o.y));
}
