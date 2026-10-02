/**
 * goalsService — as metas do mês de um professor, uma arena ou um clube
 * (`gamification_goals`). Um documento por dono e por mês.
 */
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { goalsDocId, normalizeGoals } from '@/modules/progression/domain/supplyHealth';
import { gamificationDb } from './firestoreDb.js';

const db = () => gamificationDb();

/** @returns {Promise<Array<{ metric: string, target: number }>>} */
export async function getGoals(ownerType, ownerId, monthKey) {
  if (!ownerType || !ownerId || !monthKey) return [];
  const snap = await getDoc(doc(db(), 'gamification_goals', goalsDocId(ownerType, ownerId, monthKey)));
  return snap.exists() ? normalizeGoals(ownerType, snap.data().goals) : [];
}

export async function saveGoals(ownerType, ownerId, monthKey, goals) {
  const limpas = normalizeGoals(ownerType, goals);
  const id = goalsDocId(ownerType, ownerId, monthKey);
  if (limpas.length === 0) {
    await deleteDoc(doc(db(), 'gamification_goals', id));
    return [];
  }
  await setDoc(doc(db(), 'gamification_goals', id), {
    ownerType, ownerId, month: monthKey, goals: limpas, updatedAt: Date.now(),
  });
  return limpas;
}
