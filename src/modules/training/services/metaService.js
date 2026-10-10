/**
 * Preferências e progresso do treino de cada pessoa (`training_meta/{uid}`):
 * favoritos, rotina (o "Hoje"), domínio por item, autoavaliações e o balanço
 * do jogo ligado ou não (`debrief: { enabled, since }`).
 * Documento ausente é o começo (nada salvo ainda), não uma falha.
 */

import { arrayRemove, arrayUnion, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/core/config/firebase';

export const TRAINING_META = 'training_meta';

/** @returns {Promise<object|null>} */
export async function getMeta(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, TRAINING_META, uid));
  return snap.exists() ? snap.data() : null;
}

const ALLOWED = ['favorites', 'routine', 'onboarding_done', 'mastery', 'assessments', 'focus_hint', 'debrief'];

/** Grava só as chaves conhecidas (a regra recusa qualquer outra). */
export async function saveMeta(uid, patch = {}) {
  const data = {};
  for (const k of ALLOWED) if (k in patch) data[k] = patch[k];
  if (Array.isArray(data.favorites)) data.favorites = data.favorites.slice(-300);
  if (Array.isArray(data.assessments)) data.assessments = data.assessments.slice(-24);
  await setDoc(doc(db, TRAINING_META, uid), { ...data, updated_at: serverTimestamp() }, { merge: true });
}

export async function setFavorite(uid, itemId, on) {
  await setDoc(doc(db, TRAINING_META, uid), {
    favorites: on ? arrayUnion(itemId) : arrayRemove(itemId), updated_at: serverTimestamp(),
  }, { merge: true });
}

/** Domínio de um item ("aprendendo" / "consistente" / "dominado"; `null` apaga). */
export async function setMastery(uid, itemId, level) {
  const atual = (await getMeta(uid))?.mastery || {};
  const mastery = { ...atual };
  if (level) mastery[itemId] = level; else delete mastery[itemId];
  const chaves = Object.keys(mastery);
  if (chaves.length > 300) delete mastery[chaves[0]];
  // Sem merge no mapa: apagar uma chave exige regravar o mapa inteiro.
  await setDoc(doc(db, TRAINING_META, uid), { mastery, updated_at: serverTimestamp() }, { mergeFields: ['mastery', 'updated_at'] });
}
