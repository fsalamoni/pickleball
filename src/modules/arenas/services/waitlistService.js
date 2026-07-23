/**
 * Service: Waitlist (Arena V3 — sprint 1).
 *
 * Fila de espera para slots/lockings lotados.
 * Coleção: arena_waitlist/{waitlistId}.
 *
 * Aditivo — não mexe em nenhuma coleção existente.
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
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  canJoinWaitlist,
  getNextInLine,
  isPromotionExpired,
  getNextPosition,
  compactPositions,
  buildAcceptPromotionAction,
  buildDeclinePromotionAction,
  computePromotionExpiresAt,
  WAITLIST_STATUS,
  DEFAULT_PROMOTION_WINDOW_MINUTES,
} from '../domain/waitlist.js';
import { getArena } from './arenaService.js';
import { getOpenSlot, joinOpenSlot } from './openMatchService.js';

const COL = 'arena_waitlist';

function str(v) {
  return String(v ?? '').trim();
}

function displayName(user, profile) {
  return profile?.platform_name || profile?.full_name || user?.displayName || user?.email || 'Atleta';
}

/**
 * Atleta entra na fila de espera de um slot.
 */
export async function joinWaitlist(slotId, user, profile) {
  if (!slotId) throw new Error('slotId é obrigatório.');
  if (!user?.uid) throw new Error('Faça login.');

  const slot = await getOpenSlot(slotId);
  if (!slot) throw new Error('Slot não encontrado.');

  // Verifica se já está na fila
  const existing = await getUserWaitlistEntry(user.uid, slotId);
  const check = canJoinWaitlist(slot, user, existing);
  if (!check.ok) throw new Error(check.reason);

  // Calcula próxima posição
  const allEntries = await listSlotWaitlist(slotId);
  const position = getNextPosition(allEntries);

  const id = `${slotId}_${user.uid}`;  // determinístico
  await setDoc(doc(db, COL, id), {
    id,
    arena_id: slot.arena_id,
    slot_id: slotId,
    slot_kind: 'open_match',
    athlete_id: user.uid,
    athlete_name: displayName(user, profile),
    position,
    status: WAITLIST_STATUS.WAITING,
    window_minutes: DEFAULT_PROMOTION_WINDOW_MINUTES,
    joined_at: serverTimestamp(),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  await createAuditLog({
    action: 'waitlist_joined',
    actor: user,
    details: { slot_id: slotId, arena_id: slot.arena_id, position },
  });
  return { id, position };
}

/**
 * Atleta sai da fila.
 */
export async function leaveWaitlist(slotId, userId, actor) {
  if (!slotId || !userId) throw new Error('Parâmetros obrigatórios.');
  const id = `${slotId}_${userId}`;
  await deleteDoc(doc(db, COL, id));
  // Reordena
  await reorderWaitlist(slotId);
  await createAuditLog({
    action: 'waitlist_left',
    actor,
    details: { slot_id: slotId, athlete_id: userId },
  });
}

/**
 * Lista a fila de um slot.
 */
export async function listSlotWaitlist(slotId) {
  if (!db || !slotId) return [];
  const snap = await getDocs(query(collection(db, COL), where('slot_id', '==', slotId), orderBy('position', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Busca a entrada de um user em um slot.
 */
export async function getUserWaitlistEntry(userId, slotId) {
  if (!userId || !slotId) return null;
  const id = `${slotId}_${userId}`;
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Lista todas as entradas de waitlist de um user.
 */
export async function listUserWaitlist(userId) {
  if (!userId) return [];
  const snap = await getDocs(query(collection(db, COL), where('athlete_id', '==', userId), orderBy('joined_at', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Notifica o próximo da fila (geralmente chamado quando alguém sai do slot).
 * Marca o próximo como 'notified' e define expires_at = now + window.
 */
export async function notifyNextInLine(slotId, actor) {
  const allEntries = await listSlotWaitlist(slotId);
  const next = getNextInLine(allEntries);
  if (!next) return null;

  const now = Date.now();
  const expiresMs = computePromotionExpiresAt(now, DEFAULT_PROMOTION_WINDOW_MINUTES);

  await updateDoc(doc(db, COL, next.id), {
    status: WAITLIST_STATUS.NOTIFIED,
    notified_at: serverTimestamp(),
    notification_expires_at: new Date(expiresMs),
    updated_at: serverTimestamp(),
  });

  // Notifica o atleta
  try {
    const slot = await getOpenSlot(slotId);
    notifyUsers([next.athlete_id], {
      title: `Vaga aberta em "${str(slot?.arena_name || '').slice(0, 50)}"`,
      message: `Você tem ${DEFAULT_PROMOTION_WINDOW_MINUTES} minutos para aceitar. Slot de ${slot?.date} ${slot?.start}.`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: `/minha-fila`,
      actor,
    });
  } catch (err) {
    logger.info('Falha ao notificar próximo da fila', { err: err?.code });
  }

  await createAuditLog({
    action: 'waitlist_notified',
    actor,
    details: { slot_id: slotId, athlete_id: next.athlete_id, position: next.position },
  });

  return { athlete_id: next.athlete_id, expires_at: expiresMs };
}

/**
 * Atleta aceita promoção.
 */
export async function acceptWaitlistPromotion(slotId, user, profile) {
  if (!slotId || !user?.uid) throw new Error('Parâmetros obrigatórios.');
  const entry = await getUserWaitlistEntry(user.uid, slotId);
  if (!entry) throw new Error('Você não está na fila.');

  const action = buildAcceptPromotionAction(entry, user);
  if (!action) {
    if (isPromotionExpired(entry)) {
      throw new Error('Promoção expirou.');
    }
    throw new Error('Não foi possível aceitar.');
  }

  // Marca como aceito
  await updateDoc(doc(db, COL, entry.id), {
    status: WAITLIST_STATUS.ACCEPTED,
    accepted_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  // Inscreve no slot
  await joinOpenSlot(slotId, user, profile);

  // Reordena os próximos
  await reorderWaitlist(slotId);

  await createAuditLog({
    action: 'waitlist_accepted',
    actor: user,
    details: { slot_id: slotId, position: entry.position },
  });
}

/**
 * Atleta recusa promoção.
 */
export async function declineWaitlistPromotion(slotId, user, actor) {
  if (!slotId || !user?.uid) throw new Error('Parâmetros obrigatórios.');
  const entry = await getUserWaitlistEntry(user.uid, slotId);
  if (!entry) throw new Error('Você não está na fila.');

  const action = buildDeclinePromotionAction(entry, user);
  if (!action) {
    throw new Error('Não foi possível recusar.');
  }

  await updateDoc(doc(db, COL, entry.id), {
    status: WAITLIST_STATUS.DECLINED,
    declined_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  // Reordena e notifica o próximo
  await reorderWaitlist(slotId);
  await notifyNextInLine(slotId, actor);

  await createAuditLog({
    action: 'waitlist_declined',
    actor: user,
    details: { slot_id: slotId, position: entry.position },
  });
}

/**
 * Expira notificações antigas (chamado periodicamente).
 * Retorna o número de entradas expiradas.
 */
export async function expireStaleNotifications(now = Date.now()) {
  if (!db) return 0;
  const snap = await getDocs(query(collection(db, COL), where('status', '==', WAITLIST_STATUS.NOTIFIED)));
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (isPromotionExpired(data, now)) {
      await updateDoc(d.ref, {
        status: WAITLIST_STATUS.EXPIRED,
        expired_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      count++;
    }
  }
  return count;
}

/**
 * Reordena posições da fila.
 */
async function reorderWaitlist(slotId) {
  const allEntries = await listSlotWaitlist(slotId);
  const waiting = allEntries.filter((e) => e.status === WAITLIST_STATUS.WAITING);
  const compact = compactPositions(waiting);
  if (compact.length === 0) return;
  const batch = writeBatch(db);
  compact.forEach((entry) => {
    const ref = doc(db, COL, entry.id);
    batch.update(ref, { position: entry.position, updated_at: serverTimestamp() });
  });
  await batch.commit();
}
