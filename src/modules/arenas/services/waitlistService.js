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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { formatSlotLabel } from '../domain/calendar.js';
import {
  canJoinWaitlist,
  getNextInLine,
  isPromotionExpired,
  getNextPosition,
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
  // Quem recusou/expirou e volta entra DE NOVO, no fim da fila: a entrada
  // antiga sai antes (reescrevê-la seria uma atualização, e a regra só deixa
  // o atleta responder à própria chamada — não se reinscrever por cima).
  if (existing) await deleteDoc(doc(db, COL, existing.id));

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
  // Sem "reordenar": a fila anda pela MENOR posição entre quem espera, e um
  // buraco na numeração não muda quem é o próximo. Reordenar era reescrever
  // a entrada dos OUTROS — escrita que o navegador de quem sai não pode
  // fazer (a regra recusava, e a saída quebrava no meio).
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
  // 🐞 Sem `orderBy` no servidor: `slot_id ==` + `orderBy('position')` exige
  // índice composto, e o único índice de `arena_waitlist` é
  // [arena_id, created_at]. A consulta falhava SEMPRE — e como quem chamava
  // tratava erro como lista vazia, a fila de espera simplesmente não existia.
  const snap = await getDocs(query(collection(db, COL), where('slot_id', '==', slotId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
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
  // Mesmo motivo de `listSlotWaitlist`: a ordenação vai para a memória.
  const snap = await getDocs(query(collection(db, COL), where('athlete_id', '==', userId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.joined_at?.seconds ?? b.joined_at ?? '')
      .localeCompare(String(a.joined_at?.seconds ?? a.joined_at ?? '')));
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

  // Notifica o atleta.
  //
  // 🐞 O link apontava para `/minha-fila`, uma rota que NUNCA existiu: quem
  // era chamado clicava e caía em lugar nenhum — justamente na notificação
  // com prazo. Agora vai para os jogos abertos da arena, que é onde se aceita.
  // E a data sai em português: `2026-07-23 19:00` não se lê no Brasil.
  try {
    const slot = await getOpenSlot(slotId);
    notifyUsers([next.athlete_id], {
      title: `Vagou um lugar em "${str(slot?.arena_name || '').slice(0, 50)}"`,
      message: `${formatSlotLabel(slot) || 'Jogo aberto'} — você tem `
        + `${DEFAULT_PROMOTION_WINDOW_MINUTES} minutos para confirmar.`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: slot?.arena_id ? `/arenas/${slot.arena_id}/open-match` : '/arenas',
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

  await createAuditLog({
    action: 'waitlist_accepted',
    actor: user,
    details: { slot_id: slotId, position: entry.position },
  });
}

/**
 * Atleta recusa promoção.
 */
export async function declineWaitlistPromotion(slotId, user, _actor) {
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

  // Chamar o próximo é do SERVIDOR (`promoteOpenSlotWaitlistOnEntry`): é
  // escrita na entrada de outra pessoa, que o navegador de quem recusou não
  // pode fazer. O gatilho roda na hora em que esta recusa é gravada.

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

