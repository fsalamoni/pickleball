/**
 * Service I/O do nível validado por professor (flag coach_leveling).
 *
 * Coleção `coach_level_validations/{coachId_studentId}` (aditiva). Um professor
 * atesta o nível de um aluno; o registro é público e vira selo no perfil do
 * atleta. Não altera rating nem ranking.
 *
 * Permissões (ver firestore.rules):
 * - Leitura pública (selo no perfil do atleta).
 * - Escreve/remove o professor (coach_id) ou admin.
 */

import {
  collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { normalizeValidation, validationDocId } from '../domain/validation.js';

export const COACH_VALIDATION_COLLECTION = 'coach_level_validations';

/** Validações emitidas por um professor. */
export async function listCoachValidations(coachId) {
  if (!coachId) return [];
  const q = query(collection(db, COACH_VALIDATION_COLLECTION), where('coach_id', '==', coachId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Validações recebidas por um atleta (selo no perfil). */
export async function listAthleteValidations(studentId) {
  if (!studentId) return [];
  const q = query(collection(db, COACH_VALIDATION_COLLECTION), where('student_id', '==', studentId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Cria/atualiza a validação de nível de um aluno (só o professor/admin). */
export async function upsertValidation(input, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  const { valid, error, value } = normalizeValidation(input);
  if (!valid) throw new Error(error);
  if (actor.uid !== value.coach_id && !actor.isPlatformAdmin) {
    throw new Error('Sem permissão para validar este nível.');
  }

  const id = validationDocId(value.coach_id, value.student_id);
  await setDoc(doc(db, COACH_VALIDATION_COLLECTION, id), {
    ...value,
    updated_at: serverTimestamp(),
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
  }, { merge: true });

  notifyUsers([value.student_id], {
    title: 'Seu nível foi validado',
    message: `${value.coach_name || 'Um professor'} validou seu nível: ${value.level_name}.`,
    type: NOTIFICATION_TYPE.GENERIC,
    link: '/perfil',
    actor: { uid: actor.uid },
  });
  await createAuditLog({ action: 'coach_level_validated', actor, details: { coach_id: value.coach_id, student_id: value.student_id, level_id: value.level_id } });
  return id;
}

/** Remove a validação (só o professor/admin). */
export async function removeValidation(coachId, studentId, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (actor.uid !== coachId && !actor.isPlatformAdmin) {
    throw new Error('Sem permissão.');
  }
  await deleteDoc(doc(db, COACH_VALIDATION_COLLECTION, validationDocId(coachId, studentId)));
  await createAuditLog({ action: 'coach_level_validation_removed', actor, details: { coach_id: coachId, student_id: studentId } });
}
