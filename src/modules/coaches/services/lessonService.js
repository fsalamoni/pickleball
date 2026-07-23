/**
 * Service I/O do produto de aulas do professor (Fase A).
 *
 * Coleções (aditivas, atrás da flag `coach_lessons`):
 * - coach_availability/{coachId} — disponibilidade semanal (1 doc/professor)
 * - coach_lessons/{lessonId}      — aulas (avulsas/recorrentes)
 *
 * Permissões (ver firestore.rules):
 * - Disponibilidade: leitura pública; escrita do próprio professor ou admin.
 * - Aula: cria o professor OU o aluno (student_id == uid) OU admin; responde/
 *   conclui/cancela o professor; o aluno só cancela a própria aula.
 */

import {
  collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp,
  setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { expandRecurring } from '../../arenas/domain/booking.js';
import { normalizeAvailability } from '../domain/availability.js';
import {
  normalizeLesson,
  canTransition,
  lessonSlots,
  lessonFirstSlot,
  LESSON_STATUS,
  LESSON_KIND,
} from '../domain/lesson.js';
import { getCoach } from './coachService.js';
import { debitForLesson } from './packageService.js';

export const COACH_LESSON_COLLECTIONS = {
  availability: 'coach_availability',
  lessons: 'coach_lessons',
};

const str = (v) => String(v ?? '').trim();

/* --------------------------- Disponibilidade --------------------------- */

/** Lê a disponibilidade de um professor (ou null). */
export async function getAvailability(coachId) {
  if (!coachId) return null;
  const snap = await getDoc(doc(db, COACH_LESSON_COLLECTIONS.availability, coachId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** Salva (merge) a disponibilidade. Só o próprio professor ou platform admin. */
export async function saveAvailability(coachId, input, actor) {
  if (!coachId) throw new Error('coachId é obrigatório.');
  if (actor?.uid !== coachId && !actor?.isPlatformAdmin) {
    throw new Error('Sem permissão para editar esta disponibilidade.');
  }
  const value = normalizeAvailability({ ...input, coach_id: coachId });
  await setDoc(doc(db, COACH_LESSON_COLLECTIONS.availability, coachId), {
    ...value,
    updated_at: serverTimestamp(),
  }, { merge: true });
  await createAuditLog({
    action: 'coach_availability_updated',
    actor,
    details: { coach_id: coachId, windows: value.windows.length },
  });
  return coachId;
}

/* -------------------------------- Aulas -------------------------------- */

export async function getLesson(lessonId) {
  if (!lessonId) return null;
  const snap = await getDoc(doc(db, COACH_LESSON_COLLECTIONS.lessons, lessonId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** Aulas de um professor (agenda do professor). */
export async function listCoachLessons(coachId) {
  if (!coachId) return [];
  const q = query(
    collection(db, COACH_LESSON_COLLECTIONS.lessons),
    where('coach_id', '==', coachId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Aulas de um aluno ("Minhas aulas"). */
export async function listStudentLessons(studentId) {
  if (!studentId) return [];
  const q = query(
    collection(db, COACH_LESSON_COLLECTIONS.lessons),
    where('student_id', '==', studentId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Slots ocupados (aulas confirmadas) de um professor — alimenta a geração de
 * horários livres da disponibilidade.
 */
export async function getBusySlots(coachId) {
  const lessons = await listCoachLessons(coachId);
  return lessons
    .filter((l) => l.status === LESSON_STATUS.CONFIRMED)
    .flatMap((l) => lessonSlots(l));
}

/**
 * Cria/solicita uma aula. O ator pode ser o aluno (solicita ao professor) ou
 * o próprio professor (agenda para um aluno). Nasce SOLICITADA quando pedida
 * pelo aluno; o professor pode marcar já confirmada ao criar (input.confirm).
 *
 * @param {string} coachId
 * @param {object} actor - usuário autenticado (.uid, .isPlatformAdmin)
 * @param {object} input - dados da aula (ver normalizeLesson) + recurring?
 * @returns {Promise<string>} id da aula
 */
export async function requestLesson(coachId, actor, input) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (!coachId) throw new Error('coachId é obrigatório.');

  const isCoach = actor.uid === coachId || actor.isPlatformAdmin;
  const requestedBy = isCoach ? 'coach' : 'student';

  // Expande recorrência (se houver) para slots concretos.
  let slots = Array.isArray(input.slots) ? input.slots : [];
  let recurrence = null;
  if (str(input.kind).toLowerCase() === LESSON_KIND.RECURRING || input.recurring) {
    recurrence = {
      weekday: Math.trunc(Number(input.recurring?.weekday)),
      start: str(input.recurring?.start),
      end: str(input.recurring?.end),
      weeks: Math.max(1, Math.min(52, Math.trunc(Number(input.recurring?.weeks) || 0))),
      fromDate: str(input.recurring?.fromDate),
    };
    slots = expandRecurring(recurrence);
    if (slots.length === 0) throw new Error('Preencha o dia da semana, os horários e o número de semanas.');
  }

  const { valid, error, value } = normalizeLesson({
    ...input,
    coach_id: coachId,
    kind: recurrence ? LESSON_KIND.RECURRING : LESSON_KIND.SINGLE,
    slots,
    recurrence,
    requested_by: requestedBy,
    // aluno solicitante: vincula student_id ao próprio uid
    student_id: isCoach ? (str(input.student_id) || null) : actor.uid,
    student_name: isCoach ? input.student_name : (input.student_name || actor.displayName),
    status: (isCoach && input.confirm) ? LESSON_STATUS.CONFIRMED : LESSON_STATUS.REQUESTED,
  });
  if (!valid) throw new Error(error);

  const id = doc(collection(db, COACH_LESSON_COLLECTIONS.lessons)).id;
  await setDoc(doc(db, COACH_LESSON_COLLECTIONS.lessons, id), {
    ...value,
    id,
    created_by: actor.uid,
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
    updated_at: serverTimestamp(),
  });

  const first = lessonFirstSlot(value);
  const when = first ? `${first.date} ${first.start}` : 'horário combinado';
  if (requestedBy === 'student') {
    notifyUsers([coachId], {
      title: 'Nova solicitação de aula',
      message: `${value.student_name || 'Um aluno'} solicitou aula (${when}). Toque para responder.`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: '/aulas',
      actor: { uid: actor.uid, displayName: value.student_name },
    });
  } else if (value.student_id) {
    notifyUsers([value.student_id], {
      title: 'Aula agendada pelo professor',
      message: `Você tem uma aula ${value.status === LESSON_STATUS.CONFIRMED ? 'confirmada' : 'proposta'} (${when}).`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: '/minhas-aulas',
      actor: { uid: actor.uid },
    });
  }
  await createAuditLog({ action: 'coach_lesson_requested', actor, details: { coach_id: coachId, lesson_id: id, requested_by: requestedBy } });
  return id;
}

/**
 * Transição de status de uma aula, com guarda de fluxo e de papel.
 * @param {object} lesson - documento atual (com id e status)
 * @param {string} nextStatus
 * @param {object} actor
 */
export async function respondLesson(lesson, nextStatus, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (!lesson?.id) throw new Error('Aula inválida.');
  const isCoach = actor.uid === lesson.coach_id || actor.isPlatformAdmin;
  const isStudent = actor.uid === lesson.student_id;
  if (!isCoach && !isStudent) throw new Error('Sem permissão para alterar esta aula.');
  if (!canTransition(lesson.status, nextStatus)) {
    throw new Error('Transição de status inválida.');
  }
  // Aluno só pode cancelar.
  if (!isCoach && nextStatus !== LESSON_STATUS.CANCELLED) {
    throw new Error('Sem permissão para esta ação.');
  }

  await updateDoc(doc(db, COACH_LESSON_COLLECTIONS.lessons, lesson.id), {
    status: nextStatus,
    updated_at: serverTimestamp(),
  });

  // Ao concluir, debita 1 crédito do pacote vinculado (best-effort).
  if (nextStatus === LESSON_STATUS.COMPLETED) {
    await debitForLesson(lesson, actor);
  }

  // Notifica a contraparte.
  const recipient = isCoach ? lesson.student_id : lesson.coach_id;
  if (recipient) {
    const first = lessonFirstSlot(lesson);
    const when = first ? `${first.date} ${first.start}` : '';
    const label = {
      [LESSON_STATUS.CONFIRMED]: 'confirmada',
      [LESSON_STATUS.DECLINED]: 'recusada',
      [LESSON_STATUS.CANCELLED]: 'cancelada',
      [LESSON_STATUS.COMPLETED]: 'concluída',
    }[nextStatus] || 'atualizada';
    notifyUsers([recipient], {
      title: `Aula ${label}`,
      message: `A aula ${when ? `de ${when} ` : ''}foi ${label}.`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: isCoach ? '/minhas-aulas' : '/aulas',
      actor: { uid: actor.uid },
    });
  }
  await createAuditLog({ action: 'coach_lesson_status_changed', actor, details: { lesson_id: lesson.id, to: nextStatus } });
}

/** Perfil do professor (reexport de conveniência para as telas de aula). */
export { getCoach };
