/**
 * A conta do zoom da imagem da câmera na calibração.
 *
 * O zoom é só da TELA: um `translate + scale` em volta do vídeo e do desenho.
 * Os pontos ficam guardados em pixels do VÍDEO, então dar ou tirar zoom não
 * mexe em ponto nenhum — eles ficam presos na quadra.
 *
 * `view = { z, tx, ty }`: escala (1 = imagem inteira) e deslocamento, em px da
 * janela, com origem no canto de cima à esquerda.
 */

export const MAX_ZOOM = 8;
export const NO_ZOOM = Object.freeze({ z: 1, tx: 0, ty: 0 });

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Prende a imagem na janela: sem zoom menor que 1 nem borda vazia aparecendo. */
export function clampView({ z, tx, ty }, vw, vh) {
  const zz = clamp(Number.isFinite(z) ? z : 1, 1, MAX_ZOOM);
  return { z: zz, tx: clamp(tx, vw - vw * zz, 0), ty: clamp(ty, vh - vh * zz, 0) };
}

/**
 * O gesto de pinça (e o arrastar com dois dedos): parte da vista do começo do
 * gesto, multiplica o zoom por `factor` e mantém o ponto da imagem que estava
 * sob `from` debaixo de `to`.
 */
export function pinchView(start, from, to, factor, vw, vh) {
  const z = clamp(start.z * factor, 1, MAX_ZOOM);
  const cx = (from.x - start.tx) / start.z;
  const cy = (from.y - start.ty) / start.z;
  return clampView({ z, tx: to.x - cx * z, ty: to.y - cy * z }, vw, vh);
}

/** Zoom em volta de um ponto da janela (roda do mouse, botões + e −). */
export function zoomAt(view, factor, p, vw, vh) {
  return pinchView(view, p, p, factor, vw, vh);
}

/** Arrastar a imagem com zoom. */
export function panView(start, dx, dy, vw, vh) {
  return clampView({ z: start.z, tx: start.tx + dx, ty: start.ty + dy }, vw, vh);
}
