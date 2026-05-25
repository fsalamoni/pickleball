/**
 * Serviço base para operações CRUD no Firestore.
 * Todos os módulos devem usar este serviço como base para consistência.
 */
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';

/**
 * Obtém um documento pelo ID.
 */
export async function getDocument(collectionName, docId) {
  const snap = await getDoc(doc(db, collectionName, docId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Obtém todos os documentos de uma coleção.
 */
export async function getCollection(collectionName, constraints = []) {
  const q = query(collection(db, collectionName), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Cria ou atualiza um documento (upsert).
 */
export async function setDocument(collectionName, docId, data) {
  await setDoc(doc(db, collectionName, docId), {
    ...data,
    updated_at: serverTimestamp(),
  }, { merge: true });
}

/**
 * Atualiza campos específicos de um documento.
 */
export async function updateDocument(collectionName, docId, updates) {
  await updateDoc(doc(db, collectionName, docId), {
    ...updates,
    updated_at: serverTimestamp(),
  });
}

/**
 * Remove um documento.
 */
export async function deleteDocument(collectionName, docId) {
  await deleteDoc(doc(db, collectionName, docId));
}

export { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, serverTimestamp };
export { logger };
