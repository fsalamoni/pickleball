/**
 * Service I/O da loja do professor (Fase — loja/mercado).
 *
 * Coleção `coach_products/{id}` (aditiva, flag coach_lessons).
 *
 * Permissões (ver firestore.rules):
 * - Lê: produtos públicos (qualquer um) e todos os do próprio professor/admin.
 * - Escreve: o professor/admin.
 */

import {
  collection, deleteDoc, doc, getDocs, query, serverTimestamp,
  setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { normalizeCoachProduct } from '../domain/coachProduct.js';

export const COACH_PRODUCT_COLLECTION = 'coach_products';

/** Todos os produtos de um professor (uso do dono/admin). */
export async function listCoachProducts(coachId) {
  if (!coachId) return [];
  const q = query(collection(db, COACH_PRODUCT_COLLECTION), where('coach_id', '==', coachId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Apenas os produtos públicos de um professor (seguro para visitantes). */
export async function listPublicCoachProducts(coachId) {
  if (!coachId) return [];
  const q = query(
    collection(db, COACH_PRODUCT_COLLECTION),
    where('coach_id', '==', coachId),
    where('visible_public', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.active !== false);
}

export async function createCoachProduct(coachId, input, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (actor.uid !== coachId && !actor.isPlatformAdmin) throw new Error('Sem permissão.');
  const { valid, error, value } = normalizeCoachProduct({ ...input, coach_id: coachId });
  if (!valid) throw new Error(error);
  const id = doc(collection(db, COACH_PRODUCT_COLLECTION)).id;
  await setDoc(doc(db, COACH_PRODUCT_COLLECTION, id), {
    ...value, id, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'coach_product_created', actor, details: { coach_id: coachId, product_id: id } });
  return id;
}

export async function updateCoachProduct(product, input, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (actor.uid !== product.coach_id && !actor.isPlatformAdmin) throw new Error('Sem permissão.');
  const { valid, error, value } = normalizeCoachProduct({ ...product, ...input, coach_id: product.coach_id });
  if (!valid) throw new Error(error);
  await updateDoc(doc(db, COACH_PRODUCT_COLLECTION, product.id), {
    name: value.name,
    description: value.description,
    price: value.price,
    category: value.category,
    visible_public: value.visible_public,
    active: value.active,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'coach_product_updated', actor, details: { product_id: product.id } });
}

export async function deleteCoachProduct(product, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (actor.uid !== product.coach_id && !actor.isPlatformAdmin) throw new Error('Sem permissão.');
  await deleteDoc(doc(db, COACH_PRODUCT_COLLECTION, product.id));
  await createAuditLog({ action: 'coach_product_deleted', actor, details: { product_id: product.id } });
}
