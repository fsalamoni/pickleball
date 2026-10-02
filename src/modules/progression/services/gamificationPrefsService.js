/**
 * gamificationPrefsService — o que a pessoa decide sobre a própria gamificação
 * (`user_gamification_prefs/{uid}`, privado).
 */
import { doc, getDoc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import {
  normalizeGamificationPrefs, mergeGamificationPrefs,
} from '@/modules/progression/domain/gamificationPrefs';
import { gamificationDb } from './firestoreDb.js';

const ref = (uid) => doc(gamificationDb(), 'user_gamification_prefs', uid);

/** Lê as preferências (ou os padrões). Erro de leitura PROPAGA. */
export async function getGamificationPrefs(uid) {
  if (!uid) return normalizeGamificationPrefs(null);
  const snap = await getDoc(ref(uid));
  return normalizeGamificationPrefs(snap.exists() ? snap.data() : null, uid);
}

/** Tempo real. */
export function watchGamificationPrefs(uid, onData, onError) {
  if (!uid) return () => {};
  return onSnapshot(
    ref(uid),
    (snap) => onData(normalizeGamificationPrefs(snap.exists() ? snap.data() : null, uid)),
    onError,
  );
}

/**
 * Aplica um patch por seção sobre o que está gravado. Lê antes de gravar (o
 * mapa do roteiro e os marcos só crescem — nunca se perde o que já existe).
 *
 * @param {string} uid
 * @param {object} patch ex.: `{ privacy: { showInHallOfFame: false } }`
 * @param {object|null} [atual] preferências já em memória (evita uma leitura)
 */
export async function savePrefsPatch(uid, patch, atual = null) {
  if (!uid) throw new Error('uid é obrigatório');
  const base = atual || await getGamificationPrefs(uid);
  const proximo = mergeGamificationPrefs(base, patch, uid);
  await setDoc(ref(uid), proximo);
  return proximo;
}

/** Apaga as preferências (volta aos padrões). */
export async function resetGamificationPrefs(uid) {
  if (!uid) return;
  await deleteDoc(ref(uid));
}
