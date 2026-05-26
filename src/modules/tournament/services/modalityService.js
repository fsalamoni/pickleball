/**
 * Modalidades e níveis dentro de um torneio.
 * Cada modalidade representa uma "categoria" jogável: ex. Duplas Masculinas Avançado.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import {
  MODALITY_FORMAT,
  SKILL_LEVEL,
  GENDER_CATEGORY,
  AGE_CATEGORY,
} from '../domain/constants.js';
import { DEFAULT_MAX_ENTRIES, normalizeMaxEntries } from '../domain/capacity.js';
import { normalizeScoringConfig } from '../domain/scoring.js';

const COL = 'tournament_modalities';

export async function createModality(tournamentId, data, actor) {
  const id = doc(collection(db, COL)).id;
  const payload = {
    id,
    tournament_id: tournamentId,
    name: data.name?.trim() || 'Modalidade',
    format: data.format || MODALITY_FORMAT.DOUBLES,
    skill_level: data.skill_level || SKILL_LEVEL.INTERMEDIATE,
    gender_category: data.gender_category || GENDER_CATEGORY.OPEN,
    age_category: data.age_category || AGE_CATEGORY.OPEN,
    max_entries: normalizeMaxEntries(data.max_entries, { defaultValue: DEFAULT_MAX_ENTRIES, allowUnlimited: true }),
    entry_fee_cents: Math.max(0, Number(data.entry_fee_cents) || 0),
    /** Override de regras de pontuação (opcional, herda do torneio se vazio). */
    scoring_override: data.scoring_override ? normalizeScoringConfig(data.scoring_override) : null,
    /** Estrutura de fases. Array em ordem de execução. */
    stages: data.stages || [
      { type: 'round_robin', name: 'Fase única', group_count: 1, seed_count: 0 },
    ],
    notes: data.notes || '',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  await setDoc(doc(db, COL, id), payload);
  await createAuditLog({
    action: 'modality_created',
    actor,
    details: { tournament_id: tournamentId, modality_id: id, name: payload.name },
  });
  return id;
}

export async function updateModality(id, updates, actor) {
  const normalizedUpdates = { ...updates };
  if (Object.hasOwn(normalizedUpdates, 'max_entries')) {
    normalizedUpdates.max_entries = normalizeMaxEntries(normalizedUpdates.max_entries, {
      defaultValue: DEFAULT_MAX_ENTRIES,
      allowUnlimited: true,
    });
  }
  await updateDoc(doc(db, COL, id), { ...normalizedUpdates, updated_at: serverTimestamp() });
  await createAuditLog({
    action: 'modality_updated',
    actor,
    details: { modality_id: id, fields: Object.keys(normalizedUpdates) },
  });
}

export async function deleteModality(id, actor) {
  await deleteDoc(doc(db, COL, id));
  await createAuditLog({ action: 'modality_deleted', actor, details: { modality_id: id } });
}

export async function getModality(id) {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? snap.data() : null;
}

export async function listModalities(tournamentId) {
  const q = query(
    collection(db, COL),
    where('tournament_id', '==', tournamentId),
    orderBy('created_at', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}
