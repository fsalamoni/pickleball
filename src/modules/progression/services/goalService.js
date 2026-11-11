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
  updateDoc,
  deleteField,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { normalizeGoalInput } from '../domain/progression.js';
import { t } from '@/core/i18n';

const COL = 'player_goals';

/** Cria uma meta para o usuário autenticado. */
export async function createGoal(input, actor) {
  if (!db || !actor?.uid) throw new Error(t('É preciso estar autenticado.'));
  const { valid, errors, value } = normalizeGoalInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || t('Meta inválida.'));
  const goalId = doc(collection(db, COL)).id;
  const id = `${actor.uid}_${goalId}`;
  // A meta da temporada (`kind`) grava os campos novos; a antiga, só métrica e alvo, como sempre.
  const campos = value.kind ? value : { metric: value.metric, target: value.target };
  await setDoc(doc(db, COL, id), {
    id,
    uid: actor.uid,
    ...campos,
    created_at: serverTimestamp(),
  });
  return id;
}

/**
 * Atualiza a meta da temporada (concluir, abandonar, progresso de processo,
 * editar). Passa pelo mesmo normalizador; só vale para meta com `kind`.
 */
export async function updateGoal(goal, patch) {
  if (!db || !goal?.id || !goal.kind) throw new Error(t('Meta inválida.'));
  const { valid, errors, value } = normalizeGoalInput({ ...goal, ...patch, kind: goal.kind });
  if (!valid) throw new Error(Object.values(errors)[0] || t('Meta inválida.'));
  // O campo opcional apagado na edição sai do documento (senão o antigo ficaria).
  const fora = Object.fromEntries(['if_then', 'aspect_id', 'metric', 'target', 'progress_manual']
    .filter((k) => !(k in value)).map((k) => [k, deleteField()]));
  await updateDoc(doc(db, COL, goal.id), { ...fora, ...value, updated_at: serverTimestamp() });
}

/** Lista as metas do usuário. */
export async function listGoals(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(query(collection(db, COL), where('uid', '==', uid)));
  // O id é o do DOCUMENTO: é por ele que a tela edita e apaga.
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

/** Remove uma meta. */
export async function deleteGoal(id) {
  if (!db || !id) return;
  await deleteDoc(doc(db, COL, id));
}
