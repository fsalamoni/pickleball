/**
 * I/O da lista de espera do professor (`coach_waitlist`).
 *
 * Permissões (firestore.rules, bloco "Lista de espera do professor"):
 *  - o ALUNO cria, edita as preferências e apaga a PRÓPRIA entrada (id
 *    `{coachId}_{uid}`); não grava `notified_at`;
 *  - o PROFESSOR lê e apaga as entradas da lista dele;
 *  - quem avisa a lista é o servidor (`functions/coachWaitlist.js`).
 *
 * As leituras filtram pelo campo que a regra confere (`user_id` ou
 * `coach_id`), uma igualdade só — sem índice composto.
 */
import {
  collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { COACH_WAITLIST_COLLECTION, normalizeWaitlistInput, waitlistDocId } from '../domain/waitlist.js';
import { t, tx } from '@/core/i18n';

const lista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/** As listas de espera em que o aluno está (todas as de professores). */
export async function listMyWaitlists(uid) {
  if (!uid) return [];
  return lista(await getDocs(query(collection(db, COACH_WAITLIST_COLLECTION), where('user_id', '==', uid))));
}

/** A lista de espera de um professor (só ele e o admin leem). */
export async function listCoachWaitlist(coachId) {
  if (!coachId) return [];
  return lista(await getDocs(query(collection(db, COACH_WAITLIST_COLLECTION), where('coach_id', '==', coachId))));
}

/**
 * Entra na lista (ou atualiza as preferências de quem já está).
 * `existing`: a entrada que a tela já tem em mãos — a regra não deixa ler um
 * documento que não existe, então quem decide entre criar e atualizar é a
 * lista que o aluno já leu.
 */
export async function joinCoachWaitlist(coachId, user, input = {}, { existing = null } = {}) {
  if (!user?.uid) throw new Error(t('Entre na plataforma para entrar na lista de espera.'));
  const { valid, error, value } = normalizeWaitlistInput({
    ...input, coach_id: coachId, user_id: user.uid,
    student_name: input.student_name || user.displayName || '',
  });
  if (!valid) throw new Error(error);
  const ref = doc(db, COACH_WAITLIST_COLLECTION, waitlistDocId(coachId, user.uid));

  if (existing) {
    const { format, periods, weekdays, note, student_name } = value;
    await updateDoc(ref, { format, periods, weekdays, note, student_name, updated_at: serverTimestamp() });
    return ref.id;
  }

  await setDoc(ref, {
    ...value,
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
    updated_at: serverTimestamp(),
  });
  // O professor fica sabendo da procura — é o motivo para abrir horário.
  notifyUsers([coachId], {
    title: tx('Aluno na sua lista de espera'),
    message: tx('{nome} quer aula e está esperando você abrir horários.', { nome: value.student_name || tx('Um aluno') }),
    type: NOTIFICATION_TYPE.GENERIC,
    link: '/aulas?aba=agenda',
    actor: { uid: user.uid, displayName: value.student_name },
  });
  return ref.id;
}

/** Sai da lista (o aluno) ou tira alguém dela (o professor). */
export async function leaveCoachWaitlist(coachId, uid) {
  if (!coachId || !uid) return;
  await deleteDoc(doc(db, COACH_WAITLIST_COLLECTION, waitlistDocId(coachId, uid)));
}
