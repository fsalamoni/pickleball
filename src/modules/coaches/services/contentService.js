/**
 * Service I/O da biblioteca de conteúdo do professor (Fase D — PRO-18).
 *
 * Coleção `coach_content/{id}` (aditiva, flag coach_lessons).
 *
 * Permissões (ver firestore.rules):
 * - Lê: conteúdo público (qualquer um), o professor e alunos vinculados ativos.
 * - Escreve: o professor/admin.
 */

import {
  collection, deleteDoc, doc, getDocs, query, serverTimestamp,
  setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { normalizeContent } from '../domain/content.js';

export const COACH_CONTENT_COLLECTION = 'coach_content';

/**
 * Todo o conteúdo de um professor. Use apenas quando o leitor tem direito de
 * ler tudo (o próprio professor ou um aluno vinculado) — caso contrário a
 * query inteira é rejeitada pelas regras. Para visitantes, use
 * `listPublicCoachContent`.
 */
export async function listCoachContent(coachId) {
  if (!coachId) return [];
  const q = query(collection(db, COACH_CONTENT_COLLECTION), where('coach_id', '==', coachId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Apenas o conteúdo público de um professor (seguro para qualquer visitante). */
export async function listPublicCoachContent(coachId) {
  if (!coachId) return [];
  const q = query(
    collection(db, COACH_CONTENT_COLLECTION),
    where('coach_id', '==', coachId),
    where('visibility', '==', 'public'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createContent(coachId, input, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (actor.uid !== coachId && !actor.isPlatformAdmin) throw new Error('Sem permissão.');
  const { valid, error, value } = normalizeContent({ ...input, coach_id: coachId });
  if (!valid) throw new Error(error);
  const id = doc(collection(db, COACH_CONTENT_COLLECTION)).id;
  await setDoc(doc(db, COACH_CONTENT_COLLECTION, id), {
    ...value, id, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'coach_content_created', actor, details: { coach_id: coachId, content_id: id } });
  return id;
}

export async function updateContent(content, input, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (actor.uid !== content.coach_id && !actor.isPlatformAdmin) throw new Error('Sem permissão.');
  const { valid, error, value } = normalizeContent({ ...content, ...input, coach_id: content.coach_id });
  if (!valid) throw new Error(error);
  await updateDoc(doc(db, COACH_CONTENT_COLLECTION, content.id), {
    title: value.title,
    body: value.body,
    video_url: value.video_url,
    category: value.category,
    visibility: value.visibility,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'coach_content_updated', actor, details: { content_id: content.id } });
}

export async function deleteContent(content, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (actor.uid !== content.coach_id && !actor.isPlatformAdmin) throw new Error('Sem permissão.');
  await deleteDoc(doc(db, COACH_CONTENT_COLLECTION, content.id));
  await createAuditLog({ action: 'coach_content_deleted', actor, details: { content_id: content.id } });
}
