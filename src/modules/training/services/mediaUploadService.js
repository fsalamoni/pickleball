/**
 * Envio de imagem e vídeo de treino para o Storage (`treino/{uid}/...`).
 *
 * A regra do Storage confere dono, tipo e tamanho (imagem < 3 MB, vídeo
 * < 60 MB). O que ela não vê fica aqui, ANTES de subir:
 * - a imagem é REDUZIDA (≤ 1600 px) e recodificada em WebP (JPEG no
 *   navegador que não codifica WebP) — o que também descarta EXIF/GPS;
 * - o vídeo tem a duração medida pelo próprio navegador, com tempo-limite;
 *   .mov (HEVC) e vídeo que o navegador não abre recebem um AVISO, não um
 *   bloqueio;
 * - a cota de arquivos por pessoa (`listAll` da própria pasta).
 * O envio pode ser pausado, retomado e cancelado (`uploadBytesResumable`).
 */

import { deleteObject, getDownloadURL, listAll, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { stripImageMetadata } from '@/core/lib/imageMetadata';
import {
  IMAGE_MIME, VIDEO_MIME, storageFileName, trainingStoragePath, validateUpload,
} from '../domain/media.js';

const MAX_SIDE = 1600;

/** Quantos arquivos a pessoa já tem na pasta de treino (para a cota). */
export async function countMyUploads(uid) {
  if (!storage || !uid) return 0;
  const res = await listAll(ref(storage, `treino/${uid}`));
  return res.items.length;
}

/** Quanto esperar o navegador ler a duração do vídeo antes de desistir. */
export const VIDEO_DURATION_TIMEOUT_MS = 8000;

const AVISO_MOV = 'Vídeos .mov (comuns no iPhone) podem não tocar em todos os aparelhos. Se der, envie em MP4.';
const AVISO_ILEGIVEL = 'Este navegador não conseguiu abrir o vídeo, então ele pode não tocar em todos os aparelhos. Se der, envie em MP4.';
const ERRO_DEMOROU = 'Não deu para ler a duração do vídeo a tempo. Tente de novo; se continuar, envie em MP4.';

/** Lê a duração com tempo-limite: `{ seconds, timedOut }`. Nunca fica pendurado. */
function lerDuracao(file, timeoutMs = VIDEO_DURATION_TIMEOUT_MS) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || !file) { resolve({ seconds: null, timedOut: false }); return; }
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let acabou = false;
    let timer = null;
    const done = (seconds, timedOut = false) => {
      if (acabou) return;
      acabou = true;
      clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute('src');
      URL.revokeObjectURL(url);
      resolve({ seconds, timedOut });
    };
    timer = setTimeout(() => done(null, true), timeoutMs);
    video.preload = 'metadata';
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => done(null);
    video.src = url;
  });
}

/** Duração do vídeo em segundos, pelo próprio navegador (`null` se não der para ler a tempo). */
export async function measureVideoDuration(file, { timeoutMs } = {}) {
  return (await lerDuracao(file, timeoutMs)).seconds;
}

/** Recodifica o canvas; `null` quando o navegador não sabe aquele formato. */
async function codificar(canvas, tipo, qualidade) {
  const blob = await new Promise((r) => canvas.toBlob(r, tipo, qualidade));
  return blob && blob.type === tipo ? blob : null;
}

/**
 * Reduz e recodifica a imagem em WebP — ou em JPEG, no navegador que não
 * codifica WebP. Se nenhum der certo (ou o resultado ficar maior), devolve o
 * original sem metadados.
 */
export async function compressImage(file) {
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') throw new Error('sem canvas');
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob = await codificar(canvas, 'image/webp', 0.82);
    if (!blob) {
      // JPEG não tem transparência: fundo branco, senão o PNG transparente fica preto.
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      blob = await codificar(canvas, 'image/jpeg', 0.85);
    }
    bitmap.close?.();
    if (!blob) throw new Error('sem codificador');
    if (blob.size >= file.size && IMAGE_MIME.includes(file.type) && scale === 1) return stripImageMetadata(file);
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `imagem.${ext}`, { type: blob.type });
  } catch {
    return stripImageMetadata(file);
  }
}

/**
 * Prepara e confere um arquivo. Imagens são comprimidas antes da conferência
 * de tamanho (uma foto de 8 MB costuma virar 400 kB). `warning` (opcional) é
 * um aviso para a tela mostrar sem bloquear o envio.
 * @returns {Promise<{ ok: boolean, error: string, file: File|null, type: 'image'|'video'|null, warning?: string }>}
 */
export async function prepareUpload(file, limits) {
  if (!file) return { ok: false, error: 'Selecione um arquivo.', file: null, type: null };
  const isImage = String(file.type).startsWith('image/');
  const isVideo = !isImage && String(file.type).startsWith('video/');
  const prepared = isImage ? await compressImage(file) : file;
  let durationSec = null;
  let warning = '';
  if (isVideo && VIDEO_MIME.includes(file.type) && limits?.videoEnabled !== false) {
    const lido = await lerDuracao(file);
    if (lido.timedOut) return { ok: false, error: ERRO_DEMOROU, file: null, type: 'video' };
    durationSec = lido.seconds;
    if (file.type === 'video/quicktime') warning = AVISO_MOV;
    else if (durationSec === null) warning = AVISO_ILEGIVEL;
  }
  const check = validateUpload({ type: prepared.type, size: prepared.size, durationSec }, limits);
  const result = { ok: check.ok, error: check.error, file: check.ok ? prepared : null, type: check.type };
  if (check.ok && warning) result.warning = warning;
  return result;
}

/**
 * Sobe um arquivo JÁ preparado (`prepareUpload`).
 * @returns {{ task: import('firebase/storage').UploadTask|null,
 *   done: Promise<{ url: string, path: string, type: 'image'|'video' }> }}
 */
export function uploadTrainingMedia(file, { uid, type, onProgress } = {}) {
  if (!storage) return { task: null, done: Promise.reject(new Error('Envio de arquivos indisponível neste ambiente.')) };
  if (!uid) return { task: null, done: Promise.reject(new Error('Entre na sua conta.')) };
  const path = trainingStoragePath(uid, storageFileName(file.type));
  const task = uploadBytesResumable(ref(storage, path), file, {
    contentType: file.type,
    cacheControl: 'public, max-age=31536000, immutable',
  });
  const done = new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => {
        if (onProgress && snap.totalBytes) onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      },
      (error) => {
        if (error?.code === 'storage/canceled') { reject(Object.assign(new Error('Envio cancelado.'), { canceled: true })); return; }
        logger.error('Falha no envio de mídia de treino:', error);
        reject(new Error('Não foi possível enviar o arquivo. Confira a conexão e tente de novo.'));
      },
      async () => {
        try {
          resolve({ url: await getDownloadURL(task.snapshot.ref), path, type });
        } catch (error) {
          logger.error('Falha ao obter o link da mídia de treino:', error);
          reject(new Error('Arquivo enviado, mas não deu para obter o link. Tente de novo.'));
        }
      },
    );
  });
  return { task, done };
}

/** Apaga um arquivo enviado (só o dono consegue; best-effort). */
export async function deleteTrainingMedia(path) {
  if (!storage || !path || !String(path).startsWith('treino/')) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    if (err?.code !== 'storage/object-not-found') logger.error('Falha ao apagar mídia de treino:', err);
  }
}
