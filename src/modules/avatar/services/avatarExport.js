/**
 * O avatar vira IMAGEM no próprio navegador: o palco 3D tira a foto num
 * canvas e ela sai como WebP (ou PNG, onde o navegador não codifica WebP).
 * Sem servidor, sem serviço de terceiros.
 */
import { requestSnap } from './avatarSnapshots.js';

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** As duas imagens que o cadastro guarda. */
export const AVATAR_IMAGE_SIZES = Object.freeze({
  bust: Object.freeze({ width: 512, height: 512 }),
  full: Object.freeze({ width: 680, height: 1040 }),
});

/**
 * @param {object} recipe receita normalizada
 * @param {{ view:'bust'|'full', brandItems?:Array }} opts
 * @returns {Promise<Blob>}
 */
export async function renderAvatarBlob(recipe, { view, brandItems = [] }) {
  const size = AVATAR_IMAGE_SIZES[view] || AVATAR_IMAGE_SIZES.bust;
  const canvas = await requestSnap(recipe, { view, ...size, brandItems, urgent: true, cache: false }).promise;
  const webp = await toBlob(canvas, 'image/webp', 0.92);
  if (webp && webp.type === 'image/webp') return webp;
  const png = await toBlob(canvas, 'image/png');
  if (!png) throw new Error('canvas');
  return png;
}

/** O Blob vira File com nome e tipo (o envio confere os dois). */
export function blobToFile(blob, base) {
  const ext = blob.type === 'image/webp' ? 'webp' : 'png';
  return new File([blob], `${base}.${ext}`, { type: blob.type });
}
