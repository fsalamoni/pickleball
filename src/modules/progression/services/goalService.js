/**
 * Metas pessoais do jogador (coleção `player_goals`, do próprio dono).
 * Id determinista `uid_goalId`. A conclusão é calculada (não persistida).
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { normalizeGoalInput } from '../domain/progression.js';

const COL = 'player_goals';

/** Cria uma meta para o usuário autenticado. */
export async function createGoal(input, actor) {
  if (!db || !actor?.uid) throw new Error('É preciso estar autenticado.');
  const { valid, errors, value } = normalizeGoalInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Meta inválida.');
  const goalId = doc(collection(db, COL)).id;
  const id = `${actor.uid}_${goalId}`;
  await setDoc(doc(db, COL, id), {
    id,
    uid: actor.uid,
    metric: value.metric,
    target: value.target,
    created_at: serverTimestamp(),
  });
  return id;
}

/** Lista as metas do usuário. */
export async function listGoals(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(query(collection(db, COL), where('uid', '==', uid)));
  return snap.docs.map((d) => d.data());
}

/** Remove uma meta. */
export async function deleteGoal(id) {
  if (!db || !id) return;
  await deleteDoc(doc(db, COL, id));
}
