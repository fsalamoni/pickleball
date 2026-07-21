/**
 * Service: IoT + Multi-Unit + White Label + AI (Arena V3 — sprints 8-11).
 *
 * Consolidado para otimizar contexto. Cada sprint tem sua função.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, serverTimestamp, limit,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { normalizeDeviceInput, calculateDynamicPrice, aggregateNetworkStats, forecastDemand } from '../domain/arenaV3Advanced.js';

const COL_DEVICES = 'arena_devices';
const COL_NETWORKS = 'arena_networks';
const COL_NETWORK_MEMBERSHIPS = 'arena_network_memberships';

/* --------------------- IoT Devices --------------------- */

export async function listArenaDevices(arenaId, { lim = 50 } = {}) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL_DEVICES), where('arena_id', '==', arenaId), orderBy('name', 'asc'), limit(lim)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createDevice(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const { valid, errors, value } = normalizeDeviceInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  const id = doc(collection(db, COL_DEVICES)).id;
  await setDoc(doc(db, COL_DEVICES, id), {
    id, arena_id: arenaId, ...value, status: 'offline', last_seen: null, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_device_created', actor, details: { arena_id: arenaId, name: value.name } });
  return id;
}

export async function updateDeviceStatus(deviceId, status, actor) {
  if (!deviceId) return;
  await updateDoc(doc(db, COL_DEVICES, deviceId), {
    status,
    last_seen: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
}

/* --------------------- Multi-Unit (Network) --------------------- */

export async function listNetworks({ lim = 50 } = {}) {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, COL_NETWORKS), orderBy('name', 'asc'), limit(lim)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createNetwork(name, actor) {
  const id = doc(collection(db, COL_NETWORKS)).id;
  await setDoc(doc(db, COL_NETWORKS, id), {
    id, name, arenas: [], owner_id: actor?.uid, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_network_created', actor, details: { network_id: id, name } });
  return id;
}

export async function addArenaToNetwork(networkId, arenaId, actor) {
  if (!networkId || !arenaId) return;
  const ref = doc(db, COL_NETWORKS, networkId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const arenas = [...(snap.data().arenas || []), arenaId];
  await updateDoc(ref, { arenas, updated_at: serverTimestamp() });
  await setDoc(doc(db, COL_NETWORK_MEMBERSHIPS, `${networkId}_${arenaId}`), {
    id: `${networkId}_${arenaId}`, network_id: networkId, arena_id: arenaId, joined_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_added_to_network', actor, details: { network_id: networkId, arena_id: arenaId } });
}

/* --------------------- White Label --------------------- */

export async function updateBranding(arenaId, branding, actor) {
  if (!arenaId) return;
  // Atualiza arena_settings/{arenaId}.branding
  const ref = doc(db, 'arena_settings', arenaId);
  await setDoc(ref, { branding, updated_at: serverTimestamp(), updated_by: actor?.uid }, { merge: true });
  await createAuditLog({ action: 'arena_branding_updated', actor, details: { arena_id: arenaId } });
}

/* --------------------- AI (forecasting) --------------------- */

export async function getHistoricalBookings(arenaId, days = 30) {
  if (!db || !arenaId) return [];
  // Simplificado: retorna array vazio (real viria de arena_bookings)
  // Aqui só para satisfazer a interface
  const cutoff = Date.now() - days * 86_400_000;
  return [];
}

export { calculateDynamicPrice, aggregateNetworkStats, forecastDemand };
