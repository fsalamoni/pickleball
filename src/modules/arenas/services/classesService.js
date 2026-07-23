/**
 * Service: Classes & Coaches (Arena V3 — sprint 4).
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, increment, limit,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { normalizeCoachInput, normalizeClassInput, calculateCommission, CLASS_STATUS } from '../domain/classes.js';

const COL_COACHES = 'arena_coaches';
const COL_CLASSES = 'arena_classes';
const COL_BOOKINGS = 'arena_class_bookings';

function str(v) { return String(v ?? '').trim(); }
function displayName(u, p) {
  return p?.platform_name || p?.full_name || u?.displayName || u?.email || 'Atleta';
}

/* --------------------- Coaches -------------------- */

export async function listArenaCoaches(arenaId, { onlyActive = true, lim = 50 } = {}) {
  if (!db || !arenaId) return [];
  const c = [where('arena_id', '==', arenaId)];
  if (onlyActive) c.push(where('active', '==', true));
  c.push(orderBy('name', 'asc'));
  c.push(limit(lim));
  const snap = await getDocs(query(collection(db, COL_COACHES), ...c));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createArenaCoach(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const { valid, errors, value } = normalizeCoachInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  const id = doc(collection(db, COL_COACHES)).id;
  await setDoc(doc(db, COL_COACHES, id), {
    id, arena_id: arenaId, ...value, rating_avg: null, rating_count: 0, sessions_given: 0, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_coach_created', actor, details: { arena_id: arenaId, name: value.name } });
  return id;
}

export async function deleteArenaCoach(coachId, actor) {
  if (!coachId) return;
  await deleteDoc(doc(db, COL_COACHES, coachId));
  await createAuditLog({ action: 'arena_coach_deleted', actor, details: { coach_id: coachId } });
}

/* --------------------- Classes -------------------- */

export async function listArenaClasses(arenaId, { onlyFuture = false, lim = 100 } = {}) {
  if (!db || !arenaId) return [];
  const c = [where('arena_id', '==', arenaId), where('status', '==', CLASS_STATUS.SCHEDULED)];
  if (onlyFuture) {
    const today = new Date().toISOString().slice(0, 10);
    c.push(where('date', '>=', today));
  }
  c.push(orderBy('date', 'asc'));
  c.push(limit(lim));
  const snap = await getDocs(query(collection(db, COL_CLASSES), ...c));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createArenaClass(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const { valid, errors, value } = normalizeClassInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  const id = doc(collection(db, COL_CLASSES)).id;
  await setDoc(doc(db, COL_CLASSES, id), {
    id, arena_id: arenaId, ...value, enrolled: 0, created_by: actor?.uid, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_class_created', actor, details: { arena_id: arenaId, date: value.date } });
  return id;
}

export async function bookClass(classId, user, profile) {
  if (!classId) throw new Error('classId obrigatório.');
  if (!user?.uid) throw new Error('Faça login.');

  const classRef = doc(db, COL_CLASSES, classId);
  const cSnap = await getDoc(classRef);
  if (!cSnap.exists()) throw new Error('Aula não encontrada.');
  const cls = { id: cSnap.id, ...cSnap.data() };

  if (cls.status !== CLASS_STATUS.SCHEDULED) throw new Error('Aula não disponível.');
  if ((cls.enrolled || 0) >= (cls.max_students || 1)) {
    throw new Error('Aula lotada.');
  }

  const bookingId = `${classId}_${user.uid}`;
  await setDoc(doc(db, COL_BOOKINGS, bookingId), {
    id: bookingId,
    class_id: classId,
    arena_id: cls.arena_id,
    athlete_id: user.uid,
    athlete_name: displayName(user, profile),
    paid: false,
    amount: cls.price,
    commission_pct: 50,
    booked_at: serverTimestamp(),
  });
  await updateDoc(classRef, {
    enrolled: increment(1),
    updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_class_booked', actor: user, details: { class_id: classId } });
}
