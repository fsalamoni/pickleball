/**
 * Balanço do jogo (`training_debriefs/{uid}_{jogo}`): só da pessoa — só ela
 * lê e escreve; o admin lê e apaga. Um documento por jogo: responder de novo
 * substitui a resposta, e dispensar também fica gravado (para não perguntar
 * outra vez).
 */

import {
  collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { DEBRIEF_STATUS, debriefId, normalizeDebrief } from '../domain/debrief.js';
import { TrainingItemError } from './trainingItemService.js';
import { saveMeta } from './metaService.js';
import { todayLocal } from '../domain/dates.js';

export const TRAINING_DEBRIEFS = 'training_debriefs';

const ms = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : Number(v) || 0);
const toDoc = (d) => {
  const data = d.data();
  return { id: d.id, ...data, updated_at_ms: ms(data.updated_at) };
};

export async function listMyDebriefs(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, TRAINING_DEBRIEFS), where('uid', '==', uid)))).docs.map(toDoc);
}

/** Grava as respostas (cria ou substitui). @returns {Promise<string>} o id */
export async function saveDebrief(uid, input, { suggestion = null } = {}) {
  if (!uid) throw new TrainingItemError('Entre na sua conta.');
  const { valid, error, value } = normalizeDebrief(input);
  if (!valid) throw new TrainingItemError(error);
  const id = debriefId(uid, value.source);
  await setDoc(doc(db, TRAINING_DEBRIEFS, id), {
    ...value,
    uid,
    suggestion: suggestion ? {
      focus: (suggestion.focus || []).map((f) => f.id).slice(0, 2),
      item_ids: [...new Set((suggestion.days || []).flatMap((d) => d.item_ids || []))].slice(0, 16),
      light: suggestion.light === true,
    } : null,
    applied: null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return id;
}

/** "Agora não" para um jogo: fica registrado e não volta a perguntar. */
export async function skipDebrief(uid, source) {
  const id = debriefId(uid, source);
  if (!id) throw new TrainingItemError('Jogo inválido.');
  await setDoc(doc(db, TRAINING_DEBRIEFS, id), {
    uid,
    source: {
      type: source.type, ref_id: String(source.ref_id), title: String(source.title || '').slice(0, 120), date: source.date,
      games: null, wins: null,
    },
    status: DEBRIEF_STATUS.DISPENSADO,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
}

/** Registra que a sugestão entrou nos treinos (em que plano, e como). */
export async function markDebriefApplied(debriefDocId, { planId, mode, dates = [] }) {
  await updateDoc(doc(db, TRAINING_DEBRIEFS, debriefDocId), {
    applied: { plan_id: String(planId || ''), mode, dates: dates.slice(0, 7), at: todayLocal() },
    updated_at: serverTimestamp(),
  });
}

export async function deleteDebrief(id) {
  await deleteDoc(doc(db, TRAINING_DEBRIEFS, id));
}

/**
 * Liga ou desliga o balanço para a pessoa. Ligar grava o "desde": os jogos de
 * antes não viram pendência. Religar recomeça o "desde" — cobrar o que
 * aconteceu enquanto estava desligado seria o que a pessoa desligou para evitar.
 */
export async function setDebriefEnabled(uid, enabled) {
  await saveMeta(uid, { debrief: { enabled: Boolean(enabled), since: enabled ? todayLocal() : null } });
}
