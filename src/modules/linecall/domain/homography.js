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

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Onde a câmera ESTÁ — o ponto no chão embaixo dela e a ALTURA, em metros —,
 * tirado da própria calibração (os quatro pontos), supondo uma câmera comum:
 * pixel quadrado e centro óptico no meio da imagem (celular, webcam, câmera de
 * ação em modo linear). A distância focal sai das duas condições de uma
 * rotação (os eixos do chão são perpendiculares e do mesmo tamanho na
 * câmera), por mínimos quadrados.
 *
 * Serve para corrigir o que NÃO está no chão: no quique o centro da bola está
 * 3,7 cm acima do piso, e projetá-lo como se estivesse no chão joga o ponto
 * para LONGE da câmera — 15 cm no fundo mais distante, com a câmera a 4 m de
 * altura atrás do outro fundo. Ver `liftToGround`.
 *
 * Câmera quase de cima para baixo não tem perspectiva para isso: devolve
 * `null`, e quem usa soma a dúvida na incerteza.
 *
 * @param {number[]} H imagem → quadra
 * @param {{ w: number, h: number }} size a imagem, em pixels
 * @returns {{ x: number, y: number, z: number, f: number }|null}
 */
export function estimateCamera(H, size) {
  if (!H || !(size?.w > 0) || !(size?.h > 0)) return null;
  const G = invertHomography(H); // quadra → imagem
  if (!G) return null;
  const cx = size.w / 2;
  const cy = size.h / 2;
  // Colunas de T·G, com T levando o centro da imagem à origem.
  const col = (j) => [G[j] - cx * G[6 + j], G[3 + j] - cy * G[6 + j], G[6 + j]];
  const g1 = col(0);
  const g2 = col(1);
  const g3 = col(2);
  // r1 ⟂ r2 e |r1| = |r2|: duas equações lineares em w = 1/f².
  const A1 = g1[0] * g2[0] + g1[1] * g2[1];
  const B1 = g1[2] * g2[2];
  const A2 = g1[0] ** 2 + g1[1] ** 2 - g2[0] ** 2 - g2[1] ** 2;
  const B2 = g1[2] ** 2 - g2[2] ** 2;
  const den = A1 * A1 + A2 * A2;
  if (!(den > 0)) return null;
  const w = -(A1 * B1 + A2 * B2) / den;
  if (!(w > 0)) return null;
  const f = 1 / Math.sqrt(w);
  // Lente de 10° a 120° na horizontal; fora disso a conta não é de câmera.
  if (f < 0.29 * size.w || f > 5.7 * size.w) return null;
  const r1 = [g1[0] / f, g1[1] / f, g1[2]];
  const r2 = [g2[0] / f, g2[1] / f, g2[2]];
  const tv = [g3[0] / f, g3[1] / f, g3[2]];
  const k = 2 / (Math.hypot(...r1) + Math.hypot(...r2));
  const R1 = r1.map((v) => v * k);
  const R2 = r2.map((v) => v * k);
  const R3 = cross(R1, R2);
  const t = tv.map((v) => v * k);
  // C = −Rᵀt. Trocar o sinal da escala só troca o lado do chão (z).
  const z = Math.abs(dot(R3, t));
  if (!(z > 0.3 && z < 40)) return null;
  return { x: -dot(R1, t), y: -dot(R2, t), z, f };
}

/**
 * O ponto do CHÃO embaixo de algo que está a `heightM` do piso, a partir da
 * projeção dele como se estivesse no chão (a reta da câmera até ele continua
 * até o piso, além dele). Sem câmera conhecida, devolve o ponto como veio.
 */
export function liftToGround(p, cam, heightM) {
  if (!cam || !(heightM > 0) || !(cam.z > heightM)) return p;
  const k = 1 - heightM / cam.z;
  return { x: cam.x + (p.x - cam.x) * k, y: cam.y + (p.y - cam.y) * k };
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
