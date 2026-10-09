/**
 * Dúvidas ao professor (`training_questions` + `messages`).
 *
 * A pergunta e a primeira mensagem são escritas EM SEQUÊNCIA, não num lote:
 * a regra das mensagens lê a pergunta (`get()`), e dentro de um lote o
 * `get()` enxerga o banco de antes do lote — a pergunta ainda não existiria.
 * Se a mensagem falhar, a pergunta vazia é apagada.
 */

import {
  addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { MESSAGE_MAX, normalizeQuestion, QUESTION_STATUS, statusAfterMessage } from '../domain/question.js';
import { TrainingItemError } from './trainingItemService.js';

export const TRAINING_QUESTIONS = 'training_questions';
const toDoc = (d) => ({ id: d.id, ...d.data() });

/** As que eu fiz (aluno). */
export async function listMyQuestions(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, TRAINING_QUESTIONS), where('asker_uid', '==', uid)))).docs.map(toDoc);
}

/** As que me fizeram (professor). */
export async function listCoachQuestions(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, TRAINING_QUESTIONS), where('coach_uid', '==', uid)))).docs.map(toDoc);
}

export async function listMessages(questionId) {
  const snap = await getDocs(collection(db, TRAINING_QUESTIONS, questionId, 'messages'));
  return snap.docs.map(toDoc).sort((a, b) => (a.created_at?.toMillis?.() ?? 0) - (b.created_at?.toMillis?.() ?? 0));
}

/** Abre uma dúvida (vínculo ATIVO com o professor). @returns {Promise<string>} id */
export async function createQuestion(input, { identity }) {
  if (!identity?.uid) throw new TrainingItemError('Entre na sua conta.');
  const { valid, error, value } = normalizeQuestion(input);
  if (!valid) throw new TrainingItemError(error);
  const ref = doc(collection(db, TRAINING_QUESTIONS));
  await setDoc(ref, {
    asker_uid: identity.uid,
    asker_name: String(identity.name || '').slice(0, 80),
    coach_uid: value.coach_uid,
    coach_name: value.coach_name,
    subject: value.subject,
    item_id: value.item_id,
    item_title: value.item_title,
    status: QUESTION_STATUS.ABERTA,
    last_from: 'aluno',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  try {
    await addDoc(collection(db, TRAINING_QUESTIONS, ref.id, 'messages'), {
      uid: identity.uid, name: String(identity.name || '').slice(0, 80), text: value.text, created_at: serverTimestamp(),
    });
  } catch (err) {
    await deleteDoc(ref).catch(() => null);
    throw err;
  }
  await notifyUsers([value.coach_uid], {
    type: NOTIFICATION_TYPE.TRAINING_QUESTION,
    title: 'Nova dúvida de aluno',
    message: `${identity.name || 'Seu aluno'}: ${value.subject}`,
    link: `/treino?aba=duvidas&q=${ref.id}`,
    actor: { uid: identity.uid, name: identity.name },
  }).catch(() => 0);
  return ref.id;
}

/** Responde/continua a conversa; a outra parte é avisada. */
export async function sendMessage(question, text, { identity }) {
  const t = String(text ?? '').trim().slice(0, MESSAGE_MAX);
  if (!t) throw new TrainingItemError('Escreva a mensagem.');
  const from = question.coach_uid === identity.uid ? 'professor' : 'aluno';
  await addDoc(collection(db, TRAINING_QUESTIONS, question.id, 'messages'), {
    uid: identity.uid, name: String(identity.name || '').slice(0, 80), text: t, created_at: serverTimestamp(),
  });
  await updateDoc(doc(db, TRAINING_QUESTIONS, question.id), {
    status: statusAfterMessage(from), last_from: from, updated_at: serverTimestamp(),
  });
  const to = from === 'professor' ? question.asker_uid : question.coach_uid;
  await notifyUsers([to], {
    type: from === 'professor' ? NOTIFICATION_TYPE.TRAINING_ANSWER : NOTIFICATION_TYPE.TRAINING_QUESTION,
    title: from === 'professor' ? 'Seu professor respondeu' : 'Seu aluno escreveu de novo',
    message: `${question.subject}: ${t.slice(0, 120)}`,
    link: `/treino?aba=duvidas&q=${question.id}`,
    actor: { uid: identity.uid, name: identity.name },
  }).catch(() => 0);
}

/** Encerra (ou reabre) a conversa. */
export async function setQuestionClosed(question, closed) {
  await updateDoc(doc(db, TRAINING_QUESTIONS, question.id), {
    status: closed ? QUESTION_STATUS.ENCERRADA : statusAfterMessage(question.last_from),
    updated_at: serverTimestamp(),
  });
}

/** Quem perguntou apaga a conversa. */
export async function deleteQuestion(question) {
  await deleteDoc(doc(db, TRAINING_QUESTIONS, question.id));
}
