/**
 * Service I/O do roster de alunos do professor (Fase B).
 *
 * Coleção `coach_students/{coachId_studentId}` (aditiva, flag coach_lessons).
 *
 * Permissões (ver firestore.rules):
 * - Lê o professor e o próprio aluno.
 * - Escreve o professor (cria/edita ficha, tags, notas, status).
 * - O aluno pode aceitar o convite alterando apenas o próprio status.
 */

import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp,
  setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  normalizeStudent, studentDocId, canTransitionStudent, STUDENT_STATUS,
} from '../domain/student.js';

export const COACH_STUDENT_COLLECTION = 'coach_students';

const str = (v) => String(v ?? '').trim();

/** Roster completo de um professor. */
export async function listCoachStudents(coachId) {
  if (!coachId) return [];
  const q = query(collection(db, COACH_STUDENT_COLLECTION), where('coach_id', '==', coachId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Vínculos de um aluno (professores que o adicionaram). */
export async function listStudentCoaches(studentId) {
  if (!studentId) return [];
  const q = query(collection(db, COACH_STUDENT_COLLECTION), where('student_id', '==', studentId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getStudent(coachId, studentId) {
  const id = studentDocId(coachId, studentId);
  const snap = await getDoc(doc(db, COACH_STUDENT_COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Cria ou atualiza a ficha de um aluno (só o professor/admin). Preserva o
 * status atual se o vínculo já existir e o input não trouxer status novo.
 */
export async function upsertStudent(coachId, input, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (actor.uid !== coachId && !actor.isPlatformAdmin) {
    throw new Error('Sem permissão para editar este aluno.');
  }
  const { valid, error, value } = normalizeStudent({ ...input, coach_id: coachId });
  if (!valid) throw new Error(error);

  const id = studentDocId(coachId, value.student_id);
  const existing = await getDoc(doc(db, COACH_STUDENT_COLLECTION, id));
  const isNew = !existing.exists();
  // Numa atualização, não rebaixa o status por omissão.
  const status = (!isNew && !input.status) ? existing.data().status : value.status;

  await setDoc(doc(db, COACH_STUDENT_COLLECTION, id), {
    ...value,
    status,
    updated_at: serverTimestamp(),
    ...(isNew ? { joined_at: serverTimestamp(), invited_by: actor.uid } : {}),
  }, { merge: true });

  if (isNew && value.student_id) {
    notifyUsers([value.student_id], {
      title: 'Você foi adicionado por um professor',
      message: `${str(actor.displayName) || 'Um professor'} adicionou você como aluno. Toque para ver.`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: '/minhas-aulas',
      actor: { uid: actor.uid },
    });
  }
  await createAuditLog({ action: isNew ? 'coach_student_added' : 'coach_student_updated', actor, details: { coach_id: coachId, student_id: value.student_id } });
  return id;
}

/**
 * Muda o status do vínculo com guarda. O professor pode ativar/pausar; o aluno
 * pode aceitar o convite (invited → active) sobre o próprio vínculo.
 */
export async function setStudentStatus(student, nextStatus, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (!student?.coach_id || !student?.student_id) throw new Error('Vínculo inválido.');
  const isCoach = actor.uid === student.coach_id || actor.isPlatformAdmin;
  const isStudent = actor.uid === student.student_id;
  if (!isCoach && !isStudent) throw new Error('Sem permissão.');
  if (!canTransitionStudent(student.status, nextStatus)) {
    throw new Error('Transição de status inválida.');
  }
  // O aluno só pode aceitar o convite (virar ativo).
  if (!isCoach && !(student.status === STUDENT_STATUS.INVITED && nextStatus === STUDENT_STATUS.ACTIVE)) {
    throw new Error('Sem permissão para esta ação.');
  }

  const id = studentDocId(student.coach_id, student.student_id);
  await updateDoc(doc(db, COACH_STUDENT_COLLECTION, id), {
    status: nextStatus,
    updated_at: serverTimestamp(),
  });

  if (isStudent && nextStatus === STUDENT_STATUS.ACTIVE) {
    notifyUsers([student.coach_id], {
      title: 'Aluno aceitou o convite',
      message: `${str(student.student_name) || 'Um aluno'} aceitou fazer parte do seu roster.`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: '/aulas',
      actor: { uid: actor.uid },
    });
  }
  await createAuditLog({ action: 'coach_student_status_changed', actor, details: { coach_id: student.coach_id, student_id: student.student_id, to: nextStatus } });
}

/** Remove o vínculo (só o professor/admin). */
export async function removeStudent(student, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (actor.uid !== student.coach_id && !actor.isPlatformAdmin) {
    throw new Error('Sem permissão para remover este aluno.');
  }
  const id = studentDocId(student.coach_id, student.student_id);
  await deleteDoc(doc(db, COACH_STUDENT_COLLECTION, id));
  await createAuditLog({ action: 'coach_student_removed', actor, details: { coach_id: student.coach_id, student_id: student.student_id } });
}
