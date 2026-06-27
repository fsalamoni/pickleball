/**
 * Serviço de afiliados/parcerias (coleção `affiliate_links`).
 *
 * CRUD restrito ao admin master (reforçado pelas regras do Firestore). A
 * listagem lê tudo e a ordenação/filtro de ativos é feita no cliente pela
 * lógica pura em `domain/affiliate` (sem índice composto).
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { normalizeAffiliateInput } from '../domain/affiliate.js';

const COL = 'affiliate_links';

/** Cria um link de afiliado/patrocinador. */
export async function createLink(input, actor) {
  const { valid, errors, value } = normalizeAffiliateInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  const id = doc(collection(db, COL)).id;
  await setDoc(doc(db, COL, id), {
    id,
    ...value,
    created_by: actor?.uid || null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'affiliate_link_created', actor, details: { link_id: id, title: value.title } });
  return id;
}

/** Atualiza um link existente. */
export async function updateLink(id, input, actor) {
  const { valid, errors, value } = normalizeAffiliateInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  await updateDoc(doc(db, COL, id), { ...value, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'affiliate_link_updated', actor, details: { link_id: id } });
}

/** Remove um link. */
export async function deleteLink(id, actor) {
  await deleteDoc(doc(db, COL, id));
  await createAuditLog({ action: 'affiliate_link_deleted', actor, details: { link_id: id } });
}

/** Lista todos os links (para o admin). */
export async function listAllLinks() {
  if (!db) return [];
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map((d) => d.data());
}
