/**
 * Service I/O de Circuitos (Sprint 4 ORG-20).
 *
 * Coleções:
 * - circuits/{id} — metadados do circuito
 * - circuit_admins/{circuitId_uid} — admins do circuito (id determinista)
 * - circuit_tournaments/{circuitId}_{tournamentId} — tournaments do circuito
 * - circuit_results/{circuitId}_{tournamentId}_{userId} — resultado por atleta
 *
 * Permissões:
 * - Criar/editar circuito: creator + circuit_admins + platform_admin
 * - Adicionar torneio: mesmo
 * - Registrar resultado: mesmo
 */

import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs,
  limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { normalizeCircuitInput, normalizeCircuitResult, pointsForPosition } from '../domain/circuit.js';

export const CIRCUIT_COLLECTIONS = {
  circuits: 'circuits',
  admins: 'circuit_admins',
  tournaments: 'circuit_tournaments',
  results: 'circuit_results',
};

function adminId(circuitId, userId) { return `${circuitId}_${userId}`; }
function tournamentLinkId(circuitId, tournamentId) { return `${circuitId}_${tournamentId}`; }
function resultId(circuitId, tournamentId, userId) { return `${circuitId}_${tournamentId}_${userId}`; }
function str(v) { return String(v ?? '').trim(); }

/* ----------------------------- Permissions ------------------------- */

async function isCircuitAdmin(circuitId, user) {
  if (!user?.uid || !circuitId) return false;
  if (user.isPlatformAdmin) return true;
  // creator
  const circuitSnap = await getDoc(doc(db, CIRCUIT_COLLECTIONS.circuits, circuitId));
  if (circuitSnap.exists() && circuitSnap.data()?.created_by === user.uid) return true;
  // admin doc
  const adminSnap = await getDoc(doc(db, CIRCUIT_COLLECTIONS.admins, adminId(circuitId, user.uid)));
  return adminSnap.exists();
}

/* ----------------------------- CRUD -------------------------------- */

/** Cria circuito. Adiciona creator como admin. */
export async function createCircuit(input, actor) {
  const { valid, error, value } = normalizeCircuitInput(input);
  if (!valid) throw new Error(error);
  const ref = await addDoc(collection(db, CIRCUIT_COLLECTIONS.circuits), {
    ...value,
    created_by: actor?.uid || null,
    created_by_name: str(actor?.displayName) || str(actor?.email) || null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  // adiciona creator como admin (id = circuitId_uid)
  await setDoc(doc(db, CIRCUIT_COLLECTIONS.admins, adminId(ref.id, actor?.uid || 'unknown')), {
    circuit_id: ref.id, user_id: actor?.uid || null, role: 'owner',
    added_at: serverTimestamp(), added_by: actor?.uid || null,
  });
  await createAuditLog({
    action: 'circuit_created',
    actor,
    details: { circuit_id: ref.id, name: value.name, season: value.season },
  });
  return ref.id;
}

/** Atualiza circuito (apenas admins). */
export async function updateCircuit(circuitId, updates, actor) {
  if (!await isCircuitAdmin(circuitId, actor)) {
    throw new Error('Sem permissão para editar este circuito.');
  }
  const { valid, error, value } = normalizeCircuitInput({ ...updates, name: updates.name || 'placeholder' });
  // re-valida campos críticos
  if (!valid && updates.name) throw new Error(error);
  const allowed = ['name', 'description', 'season', 'categories', 'start_date', 'end_date', 'active', 'points_table'];
  const sanitized = {};
  allowed.forEach((k) => {
    if (updates[k] !== undefined) sanitized[k] = value[k] !== undefined ? value[k] : updates[k];
  });
  await updateDoc(doc(db, CIRCUIT_COLLECTIONS.circuits, circuitId), {
    ...sanitized, updated_at: serverTimestamp(), updated_by: actor?.uid || null,
  });
  await createAuditLog({ action: 'circuit_updated', actor, details: { circuit_id: circuitId, fields: Object.keys(sanitized) } });
}

/** Lista circuitos públicos. */
export async function listCircuits({ limit: lim = 50, activeOnly = true } = {}) {
  const filters = [orderBy('created_at', 'desc')];
  if (activeOnly) filters.push(where('active', '==', true));
  const q = query(collection(db, CIRCUIT_COLLECTIONS.circuits), ...filters, limit(lim));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Lista circuitos que o user é admin/owner. */
export async function listMyCircuits(userId) {
  if (!userId) return [];
  const q = query(collection(db, CIRCUIT_COLLECTIONS.admins), where('user_id', '==', userId));
  const adminSnap = await getDocs(q);
  const circuitIds = adminSnap.docs.map((d) => d.data().circuit_id).filter(Boolean);
  if (circuitIds.length === 0) return [];
  const circuits = [];
  for (const id of circuitIds) {
    const c = await getDoc(doc(db, CIRCUIT_COLLECTIONS.circuits, id));
    if (c.exists()) circuits.push({ id: c.id, ...c.data() });
  }
  return circuits;
}

export async function getCircuit(circuitId) {
  if (!circuitId) return null;
  const snap = await getDoc(doc(db, CIRCUIT_COLLECTIONS.circuits, circuitId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** Adiciona torneio ao circuito. */
export async function addTournamentToCircuit(circuitId, tournamentId, actor) {
  if (!await isCircuitAdmin(circuitId, actor)) {
    throw new Error('Sem permissão para adicionar torneio a este circuito.');
  }
  await setDoc(doc(db, CIRCUIT_COLLECTIONS.tournaments, tournamentLinkId(circuitId, tournamentId)), {
    circuit_id: circuitId, tournament_id: tournamentId,
    added_at: serverTimestamp(), added_by: actor?.uid || null,
  });
  await createAuditLog({
    action: 'circuit_tournament_added',
    actor,
    details: { circuit_id: circuitId, tournament_id: tournamentId },
  });
}

export async function removeTournamentFromCircuit(circuitId, tournamentId, actor) {
  if (!await isCircuitAdmin(circuitId, actor)) {
    throw new Error('Sem permissão para remover torneio deste circuito.');
  }
  await deleteDoc(doc(db, CIRCUIT_COLLECTIONS.tournaments, tournamentLinkId(circuitId, tournamentId)));
  await createAuditLog({
    action: 'circuit_tournament_removed',
    actor,
    details: { circuit_id: circuitId, tournament_id: tournamentId },
  });
}

export async function listCircuitTournaments(circuitId) {
  if (!circuitId) return [];
  const q = query(collection(db, CIRCUIT_COLLECTIONS.tournaments), where('circuit_id', '==', circuitId), orderBy('added_at', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ----------------------------- Results ----------------------------- */

/** Registra resultado de 1 atleta em 1 torneio do circuito. */
export async function recordCircuitResult(circuitId, tournamentId, input, actor) {
  if (!await isCircuitAdmin(circuitId, actor)) {
    throw new Error('Sem permissão para registrar resultados neste circuito.');
  }
  const { valid, error, value } = normalizeCircuitResult({ ...input, tournament_id: tournamentId });
  if (!valid) throw new Error(error);
  await setDoc(
    doc(db, CIRCUIT_COLLECTIONS.results, resultId(circuitId, tournamentId, value.user_id)),
    { ...value, circuit_id: circuitId, updated_at: serverTimestamp(), updated_by: actor?.uid || null },
  );
  await createAuditLog({
    action: 'circuit_result_recorded',
    actor,
    details: { circuit_id: circuitId, tournament_id: tournamentId, user_id: value.user_id, position: value.position, points: value.points },
  });
}

/** Registra vários resultados em batch (1 torneio). */
export async function recordCircuitResultsBatch(circuitId, tournamentId, results, actor) {
  if (!await isCircuitAdmin(circuitId, actor)) {
    throw new Error('Sem permissão para registrar resultados neste circuito.');
  }
  let count = 0;
  for (const r of results) {
    const { valid, value } = normalizeCircuitResult({ ...r, tournament_id: tournamentId });
    if (!valid) continue;
    await setDoc(
      doc(db, CIRCUIT_COLLECTIONS.results, resultId(circuitId, tournamentId, value.user_id)),
      { ...value, circuit_id: circuitId, updated_at: serverTimestamp(), updated_by: actor?.uid || null },
    );
    count += 1;
  }
  await createAuditLog({
    action: 'circuit_results_batch',
    actor,
    details: { circuit_id: circuitId, tournament_id: tournamentId, count },
  });
  return count;
}

export async function listCircuitResults(circuitId) {
  if (!circuitId) return [];
  const q = query(collection(db, CIRCUIT_COLLECTIONS.results), where('circuit_id', '==', circuitId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

/** Calcula points por posição usando tabela do circuito. */
export async function getCircuitPointsTable(circuitId) {
  const c = await getCircuit(circuitId);
  return c?.points_table || null;
}
