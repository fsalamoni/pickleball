/**
 * Service: Operations (Arena V3 — sprint 7).
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, limit,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import {
  normalizeChecklistItem, normalizeMaintenanceInput, checklistProgress,
  CHECKLIST_KIND, MAINTENANCE_STATUS,
} from '../domain/operations.js';

const COL_CHECKLISTS = 'arena_checklists';
const COL_MAINTENANCE = 'arena_maintenance_orders';

function str(v) { return String(v ?? '').trim(); }

/* --------------------- Checklists -------------------- */

export async function listArenaChecklists(arenaId, { kind, onlyActive = false, lim = 50 } = {}) {
  if (!db || !arenaId) return [];
  const c = [where('arena_id', '==', arenaId)];
  if (kind) c.push(where('kind', '==', kind));
  c.push(orderBy('created_at', 'desc'));
  c.push(limit(lim));
  const snap = await getDocs(query(collection(db, COL_CHECKLISTS), ...c));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createChecklist(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const items = (Array.isArray(input.items) ? input.items : []).map(normalizeChecklistItem);
  const kind = Object.values(CHECKLIST_KIND).includes(input.kind) ? input.kind : CHECKLIST_KIND.OPENING;
  const id = doc(collection(db, COL_CHECKLISTS)).id;
  await setDoc(doc(db, COL_CHECKLISTS, id), {
    id, arena_id: arenaId, kind,
    title: str(input.title).slice(0, 120),
    items: items.map((i) => ({ ...i, completed: false, completed_at: null, completed_by: null })),
    completed_pct: 0,
    created_by: actor?.uid, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_checklist_created', actor, details: { arena_id: arenaId, kind } });
  return id;
}

export async function toggleChecklistItem(checklistId, itemIdx, userId) {
  if (!checklistId || !Number.isFinite(itemIdx)) return;
  const ref = doc(db, COL_CHECKLISTS, checklistId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const cl = { id: snap.id, ...snap.data() };
  const items = [...(cl.items || [])];
  if (itemIdx < 0 || itemIdx >= items.length) return;
  items[itemIdx] = {
    ...items[itemIdx],
    completed: !items[itemIdx].completed,
    completed_at: items[itemIdx].completed ? null : serverTimestamp(),
    completed_by: items[itemIdx].completed ? null : userId,
  };
  const completed_pct = checklistProgress(items);
  await updateDoc(ref, { items, completed_pct, updated_at: serverTimestamp() });
}

/* --------------------- Maintenance -------------------- */

export async function listArenaMaintenance(arenaId, { lim = 50 } = {}) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL_MAINTENANCE), where('arena_id', '==', arenaId), orderBy('created_at', 'desc'), limit(lim)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createMaintenance(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const { valid, errors, value } = normalizeMaintenanceInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  const id = doc(collection(db, COL_MAINTENANCE)).id;
  await setDoc(doc(db, COL_MAINTENANCE, id), {
    id, arena_id: arenaId, ...value, created_by: actor?.uid, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_maintenance_created', actor, details: { arena_id: arenaId, title: value.title } });
  return id;
}

export async function updateMaintenanceStatus(orderId, status, actor) {
  if (!orderId) return;
  if (!Object.values(MAINTENANCE_STATUS).includes(status)) throw new Error('Status inválido.');
  await updateDoc(doc(db, COL_MAINTENANCE, orderId), {
    status,
    completed_at: status === MAINTENANCE_STATUS.DONE ? serverTimestamp() : null,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_maintenance_status', actor, details: { order_id: orderId, status } });
}
