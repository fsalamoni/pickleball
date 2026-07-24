/**
 * Serviço da lista de espera de RESERVAS (flag booking_waitlist).
 * Coleção `arena_waitlist`. Distinto do matchmaking waitlist (Arena V3).
 * Aditivo — não altera reservas existentes.
 */

import {
  collection, doc, getDocs, setDoc, deleteDoc, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { normalizeWaitlistEntry, waitlistDocId } from '../domain/booking_waitlist.js';
import { listArenaManagerIds } from './arenaService.js';

const COL = 'arena_waitlist';

/** Entra na lista de espera de um horário. Idempotente (id determinístico). */
export async function joinWaitlist(input, actor) {
  const { valid, error, value } = normalizeWaitlistEntry({ ...input, user_id: actor?.uid });
  if (!valid) throw new Error(error);
  const id = waitlistDocId(value);
  await setDoc(doc(db, COL, id), {
    id, ...value,
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
  });
  const managerIds = await listArenaManagerIds(value.arena_id).catch(() => []);
  notifyUsers(managerIds, {
    title: 'Interesse em horário ocupado',
    message: `${value.user_name} entrou na lista de espera para ${value.date} ${value.start}.`,
    type: NOTIFICATION_TYPE.GENERIC,
    link: `/arenas/${value.arena_id}/gerir`,
    actor: { uid: actor.uid, displayName: value.user_name },
  });
  await createAuditLog({ action: 'arena_waitlist_joined', actor, details: { arena_id: value.arena_id, date: value.date, start: value.start } });
  return id;
}

/** Sai da lista de espera (o próprio atleta ou o gestor). */
export async function leaveWaitlist(entryId, actor) {
  await deleteDoc(doc(db, COL, entryId));
  await createAuditLog({ action: 'arena_waitlist_left', actor, details: { entry_id: entryId } });
}

/** Lista de espera da arena (gestor). */
export async function listArenaWaitlist(arenaId) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL), where('arena_id', '==', arenaId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Minhas entradas na lista de espera. */
export async function listMyWaitlist(userId) {
  if (!db || !userId) return [];
  const snap = await getDocs(query(collection(db, COL), where('user_id', '==', userId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
