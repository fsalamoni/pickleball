/**
 * "Ajustar à linha": leva cada canto marcado para o canto EXTERNO da faixa
 * branca, perto de onde a pessoa tocou.
 *
 * Num canto da quadra as duas linhas formam um "L" branco. O ponto que vale
 * para a calibração é a borda de fora do L (a linha é dentro, então a quadra
 * termina na borda externa). Esse ponto é o pixel branco mais distante do
 * centro da quadra, na direção do canto — ele é procurado só numa janela
 * pequena em volta do toque, para não pegar outra coisa branca (tênis, fita
 * da rede). Só vale para os cantos da quadra (`court`): nas pontas da cozinha
 * a lateral continua depois do encontro e o "mais distante" escorregaria por
 * ela. Puro: recebe a imagem e devolve o ponto, ou null quando não tem certeza.
 */

export const SNAP = {
  /** Raio da janela em volta do toque (px da imagem inteira). */
  RADIUS: 14,
  /** Pixel "branco": todos os canais claros e pouca diferença entre eles. */
  MIN_RGB: 165,
  MAX_SPREAD: 50,
  /** Fração mínima e máxima de branco na janela (pouco = sem linha; muito = parede, luz estourada). */
  MIN_FRAC: 0.08,
  MAX_FRAC: 0.65,
  /** Quantos pixels mais externos entram na média (tira o ruído de um pixel só). */
  TOP: 4,
};

const isWhite = (d, i) => {
  const r = d[i]; const g = d[i + 1]; const b = d[i + 2];
  const lo = Math.min(r, g, b);
  return lo >= SNAP.MIN_RGB && Math.max(r, g, b) - lo <= SNAP.MAX_SPREAD;
};

/**
 * @param {Uint8ClampedArray} rgba  a imagem inteira
 * @param {number} w @param {number} h
 * @param {{x:number,y:number}} tap  o ponto marcado
 * @param {{x:number,y:number}} toward  o centro da quadra na imagem
 * @returns {{x:number,y:number}|null}
 */
export function snapToOuterCorner(rgba, w, h, tap, toward, radius = SNAP.RADIUS) {
  let ox = tap.x - toward.x;
  let oy = tap.y - toward.y;
  const len = Math.hypot(ox, oy);
  if (!len) return null;
  ox /= len; oy /= len;
  const cx = Math.round(tap.x);
  const cy = Math.round(tap.y);
  const pts = [];
  let total = 0;
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    if (y < 0 || y >= h) continue;
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if (x < 0 || x >= w || (x - cx) ** 2 + (y - cy) ** 2 > radius * radius) continue;
      total += 1;
      if (isWhite(rgba, (y * w + x) * 4)) pts.push({ x, y, s: (x - cx) * ox + (y - cy) * oy });
    }
  }
  if (!total) return null;
  const frac = pts.length / total;
  if (frac < SNAP.MIN_FRAC || frac > SNAP.MAX_FRAC) return null;
  pts.sort((a, b) => b.s - a.s);
  const top = pts.slice(0, SNAP.TOP);
  // O ponto mais externo encostado na borda da janela: o L continua além
  // dela, então não dá para saber onde ele termina.
  const edge = top.some((p) => (p.x - cx) ** 2 + (p.y - cy) ** 2 >= (radius - 1) ** 2);
  if (edge) return null;
  return {
    x: top.reduce((a, p) => a + p.x, 0) / top.length + 0.5,
    y: top.reduce((a, p) => a + p.y, 0) / top.length + 0.5,
  };
}

/** Centro dos pontos (a direção "para dentro" de cada canto). */
export const centroid = (pts) => ({
  x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
  y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
});
