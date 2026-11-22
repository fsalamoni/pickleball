/**
 * O criador por IA no navegador: fala com a callable `avatarAi` e prepara a
 * imagem que ela devolve (a inteira e a miniatura da foto do perfil).
 *
 * A tela manda só a RECEITA (ids do catálogo) e `keep`. O pedido da imagem é
 * escrito no servidor; a chave do provedor nunca chega aqui.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/core/config/firebase';
import { t } from '@/core/i18n';

/** `status`, `generate`, `last` e, para o admin, `config`/`config_save`. */
export async function avatarAiAction(action, payload = {}) {
  if (!functions) throw new Error(t('Firebase não está configurado neste ambiente.'));
  try {
    // A imagem leva cerca de meio minuto; o provedor pode levar até dois.
    const { data } = await httpsCallable(functions, 'avatarAi', { timeout: 300_000 })({ action, ...payload });
    return data;
  } catch (err) {
    // Mensagem do servidor (em português) vale; "internal", "unavailable" e afins (uma
    // palavra só, do SDK, quando a rede cai) viram a frase genérica.
    const doServidor = err?.code !== 'functions/internal' && /\s/.test(err?.message || '');
    const e = new Error(doServidor ? err.message : t('Não foi possível concluir. Tente de novo.'));
    e.code = err?.code;
    throw e;
  }
}

/**
 * O recorte da miniatura (foto do perfil, redonda) sobre a imagem quadrada,
 * em frações do lado. No corpo inteiro a foto é o ROSTO, não o corpo todo.
 * ponytail: recorte fixo por enquadramento — o pedido centraliza a pessoa;
 * detectar o rosto de verdade só se as fotos saírem cortadas.
 */
export function thumbCrop(frame) {
  return frame === 'full' ? { x: 0.3, y: 0.03, size: 0.4 } : { x: 0.1, y: 0, size: 0.8 };
}

export const THUMB_PX = 384;

function base64ToBlob(b64, mime) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(t('Não deu para abrir a imagem do avatar.')));
    img.src = url;
  });
}

/**
 * A imagem que o servidor devolveu, pronta para a tela e para salvar.
 * @returns {{ blob: Blob, url: string }} `url` é um endereço local (revogue com `URL.revokeObjectURL`)
 */
export function avatarImageFromBase64(b64, mime = 'image/jpeg') {
  const blob = base64ToBlob(b64, mime);
  return { blob, url: URL.createObjectURL(blob) };
}

/** Os dois arquivos a enviar: a imagem inteira e a miniatura recortada. */
export async function avatarFiles(image, frame) {
  const img = await loadImage(image.url);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const c = thumbCrop(frame);
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_PX;
  canvas.height = THUMB_PX;
  canvas.getContext('2d').drawImage(img, c.x * side, c.y * side, c.size * side, c.size * side, 0, 0, THUMB_PX, THUMB_PX);
  const thumb = await new Promise((resolve) => { canvas.toBlob(resolve, 'image/jpeg', 0.9); });
  if (!thumb) throw new Error(t('Não deu para preparar a foto do avatar.'));
  return {
    thumb: new File([thumb], 'avatar.jpg', { type: 'image/jpeg' }),
    full: new File([image.blob], 'avatar-inteiro.jpg', { type: image.blob.type || 'image/jpeg' }),
  };
}
