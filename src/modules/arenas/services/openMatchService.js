/**
 * Service: Open Match (Arena V3 — sprint 1).
 *
 * CRUD + ações de slots de jogo aberto.
 * Coleção: arena_open_slots/{slotId}.
 *
 * Aditivo — não mexe em arena_bookings nem em nenhuma coleção existente.
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
  arrayUnion,
  arrayRemove,
  writeBatch,
  limit,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  normalizeOpenSlotInput,
  computeSlotStatus,
  isSlotFinished,
  OPEN_SLOT_STATUS,
  canJoinOpenSlot,
  getAvailableSpots,
} from '../domain/openMatch.js';
import { getNextInLine, WAITLIST_STATUS, compactPositions, computePromotionExpiresAt, DEFAULT_PROMOTION_WINDOW_MINUTES } from '../domain/waitlist.js';
import { getArena, listArenaManagers } from './arenaService.js';

const COL = 'arena_open_slots';

function str(v) {
  return String(v ?? '').trim();
}

function displayName(user, profile) {
  return profile?.platform_name || profile?.full_name || user?.displayName || user?.email || 'Atleta';
}

/**
 * Cria um slot de open match.
 * @returns {Promise<string>} slotId
 */
export async function createOpenSlot(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId é obrigatório.');
  if (!actor?.uid) throw new Error('Usuário não autenticado.');

  const { valid, errors, value } = normalizeOpenSlotInput(input);
  if (!valid) {
    const firstError = Object.values(errors)[0] || 'Dados inválidos.';
    throw new Error(firstError);
  }

  const arena = await getArena(arenaId);
  if (!arena) throw new Error('Arena não encontrada.');

  const id = doc(collection(db, COL)).id;
  const payload = {
    id,
    arena_id: arenaId,
    arena_name: arena.name || '',
    ...value,
    filled_spots: 0,
    participants: [],
    status: OPEN_SLOT_STATUS.OPEN,
    created_by: actor.uid,
    created_by_name: displayName(actor, actor.profile),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  await setDoc(doc(db, COL, id), payload);
  await createAuditLog({
    action: 'open_slot_created',
    actor,
    details: { arena_id: arenaId, slot_id: id, date: value.date, start: value.start },
  });
  logger.info('open_slot_created', { id, arenaId });
  return id;
}

/**
 * Atualiza um slot.
 */
export async function updateOpenSlot(slotId, updates, actor) {
  if (!slotId) throw new Error('slotId é obrigatório.');
  const { valid, errors, value } = normalizeOpenSlotInput(updates);
  if (!valid) {
    const firstError = Object.values(errors)[0] || 'Dados inválidos.';
    throw new Error(firstError);
  }
  await updateDoc(doc(db, COL, slotId), {
    ...value,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'open_slot_updated',
    actor,
    details: { slot_id: slotId },
  });
}

/**
 * Cancela um slot.
 */
export async function cancelOpenSlot(slotId, reason, actor) {
  if (!slotId) throw new Error('slotId é obrigatório.');
  await updateDoc(doc(db, COL, slotId), {
    status: OPEN_SLOT_STATUS.CANCELLED,
    cancellation_reason: str(reason).slice(0, 200),
    cancelled_by: actor?.uid,
    cancelled_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'open_slot_cancelled',
    actor,
    details: { slot_id: slotId, reason: str(reason).slice(0, 200) },
  });
}

/**
 * Lista slots de uma arena (com filtros opcionais).
 */
export async function listArenaOpenSlots(arenaId, { status, limit: lim = 50 } = {}) {
  if (!db || !arenaId) return [];
  const constraints = [where('arena_id', '==', arenaId)];
  if (status) constraints.push(where('status', '==', status));
  constraints.push(orderBy('date', 'asc'));
  constraints.push(limit(lim));
  const snap = await getDocs(query(collection(db, COL), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Lista slots abertos no sistema (público).
 */
export async function listOpenSlotsGlobal({ limit: lim = 100, onlyFuture = true } = {}) {
  if (!db) return [];
  const constraints = [where('status', '==', OPEN_SLOT_STATUS.OPEN)];
  if (onlyFuture) {
    const today = new Date().toISOString().slice(0, 10);
    constraints.push(where('date', '>=', today));
  }
  constraints.push(orderBy('date', 'asc'));
  constraints.push(limit(lim));
  const snap = await getDocs(query(collection(db, COL), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Busca um slot por id.
 */
export async function getOpenSlot(slotId) {
  if (!db || !slotId) return null;
  const snap = await getDoc(doc(db, COL, slotId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Atleta se inscreve em um slot.
 * Valida usando canJoinOpenSlot.
 * Notifica a arena.
 */
export async function joinOpenSlot(slotId, user, profile) {
  if (!slotId) throw new Error('slotId é obrigatório.');
  if (!user?.uid) throw new Error('Faça login para se inscrever.');

  const slot = await getOpenSlot(slotId);
  if (!slot) throw new Error('Slot não encontrado.');

  const check = canJoinOpenSlot(slot, user, profile);
  if (!check.ok) throw new Error(check.reason);

  const ref = doc(db, COL, slotId);
  const newParticipants = [...(slot.participants || []), user.uid];
  const newFilled = newParticipants.length;
  const newStatus = newFilled >= (slot.total_spots || 0)
    ? OPEN_SLOT_STATUS.FULL
    : OPEN_SLOT_STATUS.OPEN;

  await updateDoc(ref, {
    participants: arrayUnion(user.uid),
    filled_spots: newFilled,
    status: newStatus,
    updated_at: serverTimestamp(),
  });

  // Notifica a arena
  try {
    const managerIds = await listArenaManagers(slot.arena_id);
    notifyUsers(managerIds, {
      title: `Novo inscrito em "${str(slot.arena_name).slice(0, 50)}"`,
      message: `${displayName(user, profile)} entrou no slot de ${slot.date} ${slot.start}`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: `/arenas/${slot.arena_id}/gerir/open-match`,
      actor: { uid: user.uid, displayName: displayName(user, profile) },
    });
  } catch (err) {
    logger.info('Falha ao notificar arena (não crítico)', { err: err?.code });
  }

  await createAuditLog({
    action: 'open_slot_joined',
    actor: user,
    details: { slot_id: slotId, arena_id: slot.arena_id },
  });
}

/**
 * Atleta sai de um slot.
 */
export async function leaveOpenSlot(slotId, userId) {
  if (!slotId) throw new Error('slotId é obrigatório.');
  if (!userId) throw new Error('userId é obrigatório.');

  const slot = await getOpenSlot(slotId);
  if (!slot) return;

  const wasInSlot = (slot.participants || []).includes(userId);
  if (!wasInSlot) return;

  const newParticipants = (slot.participants || []).filter((p) => p !== userId);
  const newFilled = newParticipants.length;
  const newStatus = newFilled < (slot.total_spots || 0)
    ? OPEN_SLOT_STATUS.OPEN
    : OPEN_SLOT_STATUS.FULL;

  await updateDoc(doc(db, COL, slotId), {
    participants: arrayRemove(userId),
    filled_spots: newFilled,
    status: newStatus,
    updated_at: serverTimestamp(),
  });

  await createAuditLog({
    action: 'open_slot_left',
    actor: { uid: userId },
    details: { slot_id: slotId, arena_id: slot.arena_id },
  });
}

/**
 * Deleta slot (apenas criador ou platform admin).
 */
export async function deleteOpenSlot(slotId, actor) {
  if (!slotId) throw new Error('slotId é obrigatório.');
  // Limpa waitlist relacionada
  try {
    const wlSnap = await getDocs(query(collection(db, 'arena_waitlist'), where('slot_id', '==', slotId)));
    if (!wlSnap.empty) {
      const batch = writeBatch(db);
      wlSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    logger.info('Falha ao limpar waitlist do slot', { err: err?.code });
  }
  await deleteDoc(doc(db, COL, slotId));
  await createAuditLog({
    action: 'open_slot_deleted',
    actor,
    details: { slot_id: slotId },
  });
}
