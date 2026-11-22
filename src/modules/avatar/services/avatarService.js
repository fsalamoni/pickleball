/**
 * Salvar o avatar: as duas imagens vão para `uploads/{uid}/avatar/` (a pasta
 * pública da pessoa; regra do Storage de sempre) e o cadastro é gravado pelo
 * `updateUserProfile` do contexto — que já registra na auditoria e espelha
 * no perfil público.
 *
 * ponytail: imagens antigas do avatar NÃO são apagadas — cópias do
 * `photo_url` vivem em inscrições, membros de clube etc., e apagar o arquivo
 * quebraria a foto lá. Cada versão tem ~30–80 kB; limpar exige saber quem
 * ainda aponta para ela.
 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { uploadImage } from '@/core/services/storageService';
import { createAuditLog } from '@/core/services/auditService';
import { blobToFile } from './avatarExport.js';
import { normalizeBrandCatalog } from '../domain/brandItems.js';

export const AVATAR_CATALOG_DOC = 'avatar_catalog';
const catalogRef = () => doc(db, 'platform_settings', AVATAR_CATALOG_DOC);

/**
 * Envia as duas imagens e devolve os endereços.
 * @returns {Promise<{ url:string, fullUrl:string, path:string, fullPath:string }>}
 */
export async function uploadAvatarImages(uid, { bust, full }, onProgress) {
  const a = await uploadImage(blobToFile(bust, 'avatar'), { uid, folder: 'avatar', onProgress: (p) => onProgress?.(Math.round(p / 2)) });
  const b = await uploadImage(blobToFile(full, 'avatar-corpo'), { uid, folder: 'avatar', onProgress: (p) => onProgress?.(50 + Math.round(p / 2)) });
  return { url: a.url, path: a.path, fullUrl: b.url, fullPath: b.path };
}

/** O catálogo de itens de marca (legível por todos; sem documento = vazio). */
export async function getAvatarCatalog() {
  if (!db) return { brand_paddles: [] };
  const snap = await getDoc(catalogRef());
  return { brand_paddles: normalizeBrandCatalog(snap.exists() ? snap.data().brand_paddles : []) };
}

/** O admin grava a lista inteira (normalizada) e registra na auditoria. */
export async function saveAvatarCatalog(brandPaddles, actor) {
  const list = normalizeBrandCatalog(brandPaddles);
  await setDoc(catalogRef(), { brand_paddles: list, updated_at: serverTimestamp(), updated_by: actor?.uid || null }, { merge: true });
  await createAuditLog({ action: 'avatar_catalog_changed', actor, details: { brand_paddles: list.map((b) => b.id) } });
  return list;
}
