/**
 * MERCADO — envio de fotos, vídeo e comprovante para `mercado/{uid}/…`.
 *
 * A preparação (reduzir e tirar o EXIF da foto, medir o vídeo) é a MESMA do
 * Centro de Treino (`prepareUpload`), com os mesmos limites — a regra do
 * Storage confere dono, tipo e tamanho. O comprovante do Pix pode ser foto ou
 * PDF (até 3 MB).
 */
import { deleteObject, getDownloadURL, listAll, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { prepareUpload } from '@/modules/training/services/mediaUploadService';
import { MEDIA_LIMITS } from '../domain/constants.js';
import { t } from '@/core/i18n';

const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'application/pdf': 'pdf' };

export const marketStoragePath = (uid, type, pasta = 'anuncios') => (
  `mercado/${uid}/${pasta}-${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${EXT[type] || 'bin'}`
);

/** Prepara o arquivo: `{ ok, error, file, type: 'image'|'video'|'pdf', warning? }`. */
export async function prepareMarketFile(file, { allowVideo = true, allowPdf = false } = {}) {
  if (allowPdf && file?.type === 'application/pdf') {
    return file.size < MEDIA_LIMITS.maxImageBytes
      ? { ok: true, error: '', file, type: 'pdf' }
      : { ok: false, error: t('PDF de até 3 MB.'), file: null, type: 'pdf' };
  }
  return prepareUpload(file, { imageMb: 3, videoMb: 60, videoSeconds: MEDIA_LIMITS.maxVideoSeconds, videoEnabled: allowVideo });
}

/**
 * Sobe um arquivo JÁ preparado.
 * @returns {{ task, done: Promise<{ url: string, path: string, kind: 'image'|'video'|'pdf' }> }}
 */
export function uploadMarketFile(file, { uid, kind, folder, onProgress } = {}) {
  if (!storage) return { task: null, done: Promise.reject(new Error(t('Envio de arquivos indisponível neste ambiente.'))) };
  if (!uid) return { task: null, done: Promise.reject(new Error(t('Entre na sua conta.'))) };
  const path = marketStoragePath(uid, file.type, folder);
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' });
  const done = new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (s) => { if (onProgress && s.totalBytes) onProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)); },
      (error) => {
        if (error?.code === 'storage/canceled') { reject(Object.assign(new Error(t('Envio cancelado.')), { canceled: true })); return; }
        logger.error('Falha no envio de arquivo do Mercado:', error);
        reject(new Error(t('Não foi possível enviar o arquivo. Confira a conexão e tente de novo.')));
      },
      async () => {
        try {
          resolve({ url: await getDownloadURL(task.snapshot.ref), path, kind });
        } catch (error) {
          logger.error('Falha ao obter o link do arquivo do Mercado:', error);
          reject(new Error(t('Arquivo enviado, mas não deu para obter o link. Tente de novo.')));
        }
      },
    );
  });
  return { task, done };
}

/** Apaga um arquivo enviado (só o dono consegue; best-effort). */
export async function deleteMarketFile(path) {
  if (!storage || !path || !String(path).startsWith('mercado/')) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    if (err?.code !== 'storage/object-not-found') logger.error('Falha ao apagar arquivo do Mercado:', err);
  }
}

/** Os caminhos dos arquivos da pessoa no Mercado (para a exportação). */
export async function listMyMarketUploads(uid) {
  if (!storage || !uid) return [];
  const res = await listAll(ref(storage, `mercado/${uid}`));
  return res.items.map((i) => i.fullPath);
}

/** O link de um arquivo pelo caminho (o comprovante do Pix, que o pedido guarda só como caminho). */
export async function getMarketFileUrl(path) {
  if (!storage || !path || !String(path).startsWith('mercado/')) return null;
  return getDownloadURL(ref(storage, path));
}
