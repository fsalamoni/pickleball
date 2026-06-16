/**
 * Serviço de upload de imagens para o Firebase Storage.
 *
 * Convenções:
 *  - Todo upload fica em `uploads/{uid}/{folder}/...`, de modo que as regras de
 *    segurança possam restringir a escrita ao próprio usuário autenticado.
 *  - As imagens são enviadas sem reprocessamento (preservando a qualidade
 *    original); apenas validamos tipo e tamanho.
 *  - Retorna a URL pública de download (com token) usada nas <img> e nos docs.
 */

import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
export const ACCEPTED_IMAGE_ATTR = 'image/*';

export function maxImageMb() {
  return Math.round(MAX_IMAGE_BYTES / (1024 * 1024));
}

function sanitizeName(name) {
  const base = String(name || 'imagem')
    .toLowerCase()
    .normalize('NFD')
    // Remove acentos (marcas combinantes) e qualquer caractere fora do ASCII
    // imprimível, mantendo o nome do arquivo seguro para o caminho do Storage.
    .replace(/[^ -~]/g, '')
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (base || 'imagem').slice(-80);
}

/** Valida um arquivo de imagem. Retorna mensagem de erro ou null. */
export function validateImageFile(file) {
  if (!file) return 'Selecione um arquivo.';
  if (!String(file.type || '').startsWith('image/')) return 'O arquivo precisa ser uma imagem.';
  if (file.size > MAX_IMAGE_BYTES) return `Imagem muito grande (máximo ${maxImageMb()} MB).`;
  return null;
}

/**
 * Faz upload de uma imagem e resolve com metadados + URL de download.
 * @returns {Promise<{url:string, path:string, name:string, size:number, contentType:string}>}
 */
export function uploadImage(file, { uid, folder = 'misc', onProgress } = {}) {
  return new Promise((resolve, reject) => {
    if (!storage) {
      reject(new Error('Armazenamento de imagens indisponível neste ambiente.'));
      return;
    }
    if (!uid) {
      reject(new Error('Usuário não autenticado.'));
      return;
    }
    const validationError = validateImageFile(file);
    if (validationError) {
      reject(new Error(validationError));
      return;
    }

    const path = `uploads/${uid}/${folder}/${Date.now()}-${sanitizeName(file.name)}`;
    const task = uploadBytesResumable(ref(storage, path), file, {
      contentType: file.type,
      cacheControl: 'public, max-age=31536000, immutable',
    });

    task.on(
      'state_changed',
      (snap) => {
        if (onProgress && snap.totalBytes) {
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      (error) => {
        logger.error('Falha no upload de imagem:', error);
        reject(new Error('Não foi possível enviar a imagem. Tente novamente.'));
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({ url, path, name: file.name, size: file.size, contentType: file.type });
        } catch (error) {
          logger.error('Falha ao obter URL da imagem:', error);
          reject(new Error('Imagem enviada, mas não foi possível obter o link.'));
        }
      },
    );
  });
}

/** Remove uma imagem do Storage (best-effort). */
export async function deleteImage(path) {
  if (!storage || !path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    logger.error('Falha ao remover imagem do Storage:', err);
  }
}

/**
 * Baixa uma imagem para o dispositivo do usuário, preservando a qualidade
 * original. Tenta via blob (download real) e, em caso de bloqueio de CORS,
 * abre a imagem em nova aba como alternativa.
 */
export async function downloadImage(url, fileName = 'imagem') {
  if (!url) return;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('fetch failed');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName || 'imagem';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  } catch (err) {
    logger.error('Download direto falhou, abrindo em nova aba:', err);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/* ------------------------- Anexos genéricos (qualquer arquivo) ----------- */

// Limite maior para documentos (PDF, planilhas, etc.) usados em chat e fóruns.
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
export const ACCEPTED_FILE_ATTR =
  'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z';

export function maxFileMb() {
  return Math.round(MAX_FILE_BYTES / (1024 * 1024));
}

/** Formata um tamanho em bytes para exibição (ex.: "1,2 MB"). */
export function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** exponent;
  const formatted = exponent === 0 ? String(size) : value.toFixed(value >= 10 ? 0 : 1).replace('.', ',');
  return `${formatted} ${units[exponent]}`;
}

/** Indica se o tipo de conteúdo é uma imagem exibível inline. */
export function isImageContentType(contentType) {
  return String(contentType || '').startsWith('image/');
}

/** Valida um arquivo genérico (qualquer tipo). Retorna mensagem de erro ou null. */
export function validateUploadFile(file) {
  if (!file) return 'Selecione um arquivo.';
  if (file.size > MAX_FILE_BYTES) return `Arquivo muito grande (máximo ${maxFileMb()} MB).`;
  return null;
}

/**
 * Faz upload de um anexo de qualquer tipo (imagem ou documento) e resolve com
 * metadados. Imagens são marcadas com `kind: 'image'` para exibição inline.
 * @returns {Promise<{url:string, path:string, name:string, size:number, content_type:string, kind:'image'|'file'}>}
 */
export function uploadAttachment(file, { uid, folder = 'attachments', onProgress } = {}) {
  return new Promise((resolve, reject) => {
    if (!storage) {
      reject(new Error('Armazenamento de arquivos indisponível neste ambiente.'));
      return;
    }
    if (!uid) {
      reject(new Error('Usuário não autenticado.'));
      return;
    }
    const validationError = validateUploadFile(file);
    if (validationError) {
      reject(new Error(validationError));
      return;
    }

    const path = `uploads/${uid}/${folder}/${Date.now()}-${sanitizeName(file.name)}`;
    const task = uploadBytesResumable(ref(storage, path), file, {
      contentType: file.type || 'application/octet-stream',
      cacheControl: 'public, max-age=31536000, immutable',
    });

    task.on(
      'state_changed',
      (snap) => {
        if (onProgress && snap.totalBytes) {
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      (error) => {
        logger.error('Falha no upload de anexo:', error);
        reject(new Error('Não foi possível enviar o arquivo. Tente novamente.'));
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({
            url,
            path,
            name: file.name,
            size: file.size,
            content_type: file.type || 'application/octet-stream',
            kind: isImageContentType(file.type) ? 'image' : 'file',
          });
        } catch (error) {
          logger.error('Falha ao obter URL do anexo:', error);
          reject(new Error('Arquivo enviado, mas não foi possível obter o link.'));
        }
      },
    );
  });
}

/** Remove um anexo do Storage (best-effort). Alias semântico de deleteImage. */
export async function deleteAttachment(path) {
  return deleteImage(path);
}

/** Baixa um anexo qualquer preservando o nome original. */
export async function downloadAttachment(url, fileName = 'arquivo') {
  return downloadImage(url, fileName);
}
