/**
 * Planos de treino (`training_plans`): do atleta, só ele lê e escreve.
 * Um plano ATIVO por vez — é ele que alimenta o "Hoje".
 */

import {
  collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { normalizePlan, PLAN_STATUS } from '../domain/plan.js';
import { TrainingItemError } from './trainingItemService.js';

export const TRAINING_PLANS = 'training_plans';
const toDoc = (d) => ({ id: d.id, ...d.data() });

export async function listMyPlans(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, TRAINING_PLANS), where('uid', '==', uid)))).docs.map(toDoc);
}

/** Pausa os outros planos ativos (no mesmo lote da escrita). */
function pauseOthers(batch, plans, keepId) {
  plans.filter((p) => p.id !== keepId && p.status === PLAN_STATUS.ATIVO)
    .forEach((p) => batch.update(doc(db, TRAINING_PLANS, p.id), { status: PLAN_STATUS.PAUSADO, updated_at: serverTimestamp() }));
}

/** Cria um plano. Nasce ativo e pausa o que estava ativo. @returns {Promise<string>} */
export async function createPlan(input, { identity, plans = [] }) {
  if (!identity?.uid) throw new TrainingItemError('Entre na sua conta.');
  const { valid, error, value } = normalizePlan(input);
  if (!valid) throw new TrainingItemError(error);
  const ref = doc(collection(db, TRAINING_PLANS));
  const batch = writeBatch(db);
  if (value.status === PLAN_STATUS.ATIVO) pauseOthers(batch, plans, ref.id);
  batch.set(ref, { ...value, uid: identity.uid, created_at: serverTimestamp(), updated_at: serverTimestamp() });
  await batch.commit();
  return ref.id;
}

export async function updatePlan(plan, input) {
  const { valid, error, value } = normalizePlan({ ...plan, ...input });
  if (!valid) throw new TrainingItemError(error);
  await updateDoc(doc(db, TRAINING_PLANS, plan.id), { ...value, updated_at: serverTimestamp() });
}

/** Ativa, pausa ou conclui. Ativar pausa o plano ativo anterior. */
export async function setPlanStatus(plan, status, { plans = [] } = {}) {
  if (!Object.values(PLAN_STATUS).includes(status)) throw new TrainingItemError('Situação inválida.');
  const batch = writeBatch(db);
  if (status === PLAN_STATUS.ATIVO) pauseOthers(batch, plans, plan.id);
  batch.update(doc(db, TRAINING_PLANS, plan.id), { status, updated_at: serverTimestamp() });
  await batch.commit();
}

export async function deletePlan(plan) {
  await deleteDoc(doc(db, TRAINING_PLANS, plan.id));
}

