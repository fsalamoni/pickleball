/**
 * Serviço de notificações — cria avisos que aparecem no sino do cabeçalho.
 *
 * A coleção `notifications` é lida em tempo real por `useNotifications`
 * (onSnapshot filtrando por `user_id`). Aqui ficam apenas as ESCRITAS.
 *
 * Decisões de robustez:
 *  - Defensivo: nunca lança erro para o chamador. Notificar é um efeito
 *    colateral e jamais deve interromper o fluxo principal (enviar mensagem,
 *    comentar, etc.). Falhas são apenas logadas.
 *  - O ator (quem gera o evento) nunca é notificado de si mesmo.
 *  - Escritas em lote (writeBatch) para vários destinatários.
 */

import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';

export const NOTIFICATION_COLLECTION = 'notifications';

/** Tipos de notificação conhecidos (para ícones/agrupamento futuro). */
export const NOTIFICATION_TYPE = Object.freeze({
  CHAT_MESSAGE: 'chat_message',
  CHAT_INVITE: 'chat_invite',
  FORUM_REPLY: 'forum_reply',
  FORUM_MENTION: 'forum_mention',
  GENERIC: 'generic',
});

function trimText(value, max) {
  const text = String(value ?? '').trim();
  return max ? text.slice(0, max) : text;
}

/** Normaliza e remove duplicados/vazios de uma lista de uids destinatários. */
function normalizeRecipients(userIds, actorId) {
  const set = new Set();
  (Array.isArray(userIds) ? userIds : [userIds]).forEach((id) => {
    const uid = String(id || '').trim();
    if (uid && uid !== actorId) set.add(uid);
  });
  return Array.from(set);
}

function buildPayload({ userId, title, message, type, link, actor }) {
  return {
    user_id: userId,
    title: trimText(title, 140) || 'Nova atividade',
    message: trimText(message, 300),
    type: type || NOTIFICATION_TYPE.GENERIC,
    link: trimText(link, 400) || null,
    actor_id: actor?.uid || null,
    actor_name: trimText(actor?.displayName || actor?.name, 140) || null,
    read: false,
    read_at: null,
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
  };
}

/**
 * Cria uma notificação para um único usuário. Best-effort.
 */
export async function createNotification({ userId, title, message, type, link, actor } = {}) {
  if (!db || !userId) return;
  if (actor?.uid && actor.uid === userId) return; // não notifica a si mesmo
  try {
    const ref = doc(collection(db, NOTIFICATION_COLLECTION));
    const batch = writeBatch(db);
    batch.set(ref, buildPayload({ userId, title, message, type, link, actor }));
    await batch.commit();
  } catch (err) {
    logger.error('Falha ao criar notificação:', err);
  }
}

/**
 * Cria a mesma notificação para vários usuários (exceto o ator). Best-effort.
 * Divide em lotes de 400 operações para respeitar o limite do Firestore (500).
 */
export async function notifyUsers(userIds, { title, message, type, link, actor } = {}) {
  if (!db) return;
  const recipients = normalizeRecipients(userIds, actor?.uid);
  if (recipients.length === 0) return;
  try {
    const CHUNK = 400;
    for (let i = 0; i < recipients.length; i += CHUNK) {
      const slice = recipients.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      slice.forEach((uid) => {
        const ref = doc(collection(db, NOTIFICATION_COLLECTION));
        batch.set(ref, buildPayload({ userId: uid, title, message, type, link, actor }));
      });
      await batch.commit();
    }
  } catch (err) {
    logger.error('Falha ao notificar usuários:', err);
  }
}
