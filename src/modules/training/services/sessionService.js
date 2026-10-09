/**
 * Diário de treino (`training_sessions`) e os comentários de cada sessão.
 *
 * Só o dono escreve. O professor lê, comenta e confirma a sessão que o aluno
 * COMPARTILHOU com ele — e a consulta dele tem de filtrar pelos dois campos
 * que a regra confere (`shared_coach_id` e `uid`), um aluno por vez.
 */

import {
  addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { normalizeSession } from '../domain/session.js';
import { TrainingItemError } from './trainingItemService.js';

export const TRAINING_SESSIONS = 'training_sessions';
const toDoc = (d) => ({ id: d.id, ...d.data() });

export async function listMySessions(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, TRAINING_SESSIONS), where('uid', '==', uid)))).docs.map(toDoc);
}

/**
 * Sessões que os alunos compartilharam comigo. Um aluno que falha não
 * derruba os outros.
 * @returns {Promise<{ items: object[], incompleto: boolean }>}
 */
export async function listStudentSessions(coachUid, studentUids = []) {
  const res = await Promise.allSettled([...new Set(studentUids)].filter(Boolean).map(async (studentUid) => {
    const q = query(collection(db, TRAINING_SESSIONS),
      where('shared_coach_id', '==', coachUid), where('uid', '==', studentUid));
    return (await getDocs(q)).docs.map(toDoc);
  }));
  return {
    items: res.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value),
    incompleto: res.some((r) => r.status === 'rejected'),
  };
}

function notifyCoachShared(identity, coachId, title) {
  return notifyUsers([coachId], {
    type: NOTIFICATION_TYPE.TRAINING_COMMENT,
    title: 'Um aluno compartilhou um treino',
    message: `${identity.name || 'Seu aluno'} registrou "${title}".`,
    link: '/treino?aba=alunos',
    actor: { uid: identity.uid, name: identity.name },
  }).catch(() => 0);
}

/** Registra uma sessão. @returns {Promise<string>} id */
export async function createSession(input, { identity }) {
  if (!identity?.uid) throw new TrainingItemError('Entre na sua conta.');
  const { valid, error, value } = normalizeSession(input);
  if (!valid) throw new TrainingItemError(error);
  const ref = await addDoc(collection(db, TRAINING_SESSIONS), {
    ...value, uid: identity.uid, coach_confirmed_at: null, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  if (value.shared_coach_id) await notifyCoachShared(identity, value.shared_coach_id, value.title);
  return ref.id;
}

export async function updateSession(session, input, { identity }) {
  const { valid, error, value } = normalizeSession({ ...session, ...input });
  if (!valid) throw new TrainingItemError(error);
  await updateDoc(doc(db, TRAINING_SESSIONS, session.id), { ...value, updated_at: serverTimestamp() });
  if (value.shared_coach_id && value.shared_coach_id !== session.shared_coach_id) {
    await notifyCoachShared(identity, value.shared_coach_id, value.title);
  }
}

/** Apaga a sessão e os comentários dela. */
export async function deleteSession(session) {
  const comentarios = await getDocs(collection(db, TRAINING_SESSIONS, session.id, 'comments')).catch(() => null);
  if (comentarios?.docs.length) {
    const batch = writeBatch(db);
    comentarios.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit().catch(() => null);
  }
  await deleteDoc(doc(db, TRAINING_SESSIONS, session.id));
}

/** O professor confirma que viu a sessão (o aluno é avisado). */
export async function confirmSession(session, { identity }) {
  await updateDoc(doc(db, TRAINING_SESSIONS, session.id), { coach_confirmed_at: serverTimestamp(), updated_at: serverTimestamp() });
  await notifyUsers([session.uid], {
    type: NOTIFICATION_TYPE.TRAINING_COMMENT,
    title: 'Seu professor viu o seu treino',
    message: `${identity.name || 'Seu professor'} confirmou "${session.title}".`,
    link: '/treino?aba=diario',
    actor: { uid: identity.uid, name: identity.name },
  }).catch(() => 0);
}

export async function listComments(sessionId) {
  const snap = await getDocs(collection(db, TRAINING_SESSIONS, sessionId, 'comments'));
  return snap.docs.map(toDoc).sort((a, b) => (a.created_at?.toMillis?.() ?? 0) - (b.created_at?.toMillis?.() ?? 0));
}

/** Comenta (o dono ou o professor compartilhado); a outra parte é avisada. */
export async function addComment(session, text, { identity }) {
  const t = String(text ?? '').trim().slice(0, 1000);
  if (!t) throw new TrainingItemError('Escreva o comentário.');
  await addDoc(collection(db, TRAINING_SESSIONS, session.id, 'comments'), {
    uid: identity.uid, name: String(identity.name || '').slice(0, 80), text: t, created_at: serverTimestamp(),
  });
  const isOwner = session.uid === identity.uid;
  const to = isOwner ? session.shared_coach_id : session.uid;
  if (to) {
    await notifyUsers([to], {
      type: NOTIFICATION_TYPE.TRAINING_COMMENT,
      title: isOwner ? 'Seu aluno comentou um treino' : 'Seu professor comentou o seu treino',
      message: `${identity.name || 'Alguém'}: ${t.slice(0, 120)}`,
      link: isOwner ? '/treino?aba=alunos' : '/treino?aba=diario',
      actor: { uid: identity.uid, name: identity.name },
    }).catch(() => 0);
  }
}

export async function deleteComment(sessionId, commentId) {
  await deleteDoc(doc(db, TRAINING_SESSIONS, sessionId, 'comments', commentId));
}
