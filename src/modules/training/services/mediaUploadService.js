/**
 * Envio de imagem e vídeo de treino para o Storage (`treino/{uid}/...`).
 *
 * A regra do Storage confere dono, tipo e tamanho (imagem < 3 MB, vídeo
 * < 60 MB). O que ela não vê fica aqui, ANTES de subir:
 * - a imagem é REDUZIDA (≤ 1600 px) e recodificada em WebP — o que também
 *   descarta EXIF/GPS da foto do celular;
 * - o vídeo tem a duração medida pelo próprio navegador;
 * - a cota de arquivos por pessoa (`listAll` da própria pasta).
 * O envio pode ser pausado, retomado e cancelado (`uploadBytesResumable`).
 */

import { deleteObject, getDownloadURL, listAll, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { stripImageMetadata } from '@/core/lib/imageMetadata';
import { IMAGE_MIME, storageFileName, trainingStoragePath, validateUpload } from '../domain/media.js';

const MAX_SIDE = 1600;

/** Quantos arquivos a pessoa já tem na pasta de treino (para a cota). */
export async function countMyUploads(uid) {
  if (!storage || !uid) return 0;
  const res = await listAll(ref(storage, `treino/${uid}`));
  return res.items.length;
}

/** Duração do vídeo em segundos, pelo próprio navegador (`null` se não der para ler). */
export function measureVideoDuration(file) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || !file) { resolve(null); return; }
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const done = (v) => { URL.revokeObjectURL(url); resolve(v); };
    video.preload = 'metadata';
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => done(null);
    video.src = url;
  });
}

/**
 * Reduz e recodifica a imagem em WebP. Se o navegador não souber (ou o
 * resultado ficar maior), devolve o original sem metadados.
 */
export async function compressImage(file) {
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') throw new Error('sem canvas');
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.82));
    if (!blob || blob.type !== 'image/webp') throw new Error('sem webp');
    if (blob.size >= file.size && IMAGE_MIME.includes(file.type) && scale === 1) return stripImageMetadata(file);
    return new File([blob], 'imagem.webp', { type: 'image/webp' });
  } catch {
    return stripImageMetadata(file);
  }
}

/**
 * Prepara e confere um arquivo. Imagens são comprimidas antes da conferência
 * de tamanho (uma foto de 8 MB costuma virar 400 kB).
 * @returns {Promise<{ ok: boolean, error: string, file: File|null, type: 'image'|'video'|null }>}
 */
export async function prepareUpload(file, limits) {
  if (!file) return { ok: false, error: 'Selecione um arquivo.', file: null, type: null };
  const isImage = String(file.type).startsWith('image/');
  const prepared = isImage ? await compressImage(file) : file;
  const durationSec = !isImage && String(file.type).startsWith('video/') ? await measureVideoDuration(file) : null;
  const check = validateUpload({ type: prepared.type, size: prepared.size, durationSec }, limits);
  return { ok: check.ok, error: check.error, file: check.ok ? prepared : null, type: check.type };
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
