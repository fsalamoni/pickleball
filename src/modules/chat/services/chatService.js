/**
 * Serviço de Chat — conversas diretas e em grupo com mensagens em tempo real.
 *
 * Decisões de robustez/segurança:
 *  - Cada mensagem replica `member_ids` da conversa, permitindo que as regras
 *    de segurança autorizem leitura/escrita sem leituras cruzadas caras.
 *  - As assinaturas (onSnapshot) usam apenas `where` e ordenam no cliente,
 *    evitando índices compostos e erros de "índice ausente" em runtime.
 *  - Conversas diretas têm id determinístico (dm_a__b) para nunca duplicar.
 *  - Notificar destinatários é best-effort e nunca interrompe o envio.
 *  - "Excluir conversa" (direta) é uma ocultação por usuário (`hidden_for`)
 *    que reaparece quando chega uma nova mensagem — comportamento padrão de
 *    apps de mensagem, sem destruir o histórico do outro participante.
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
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { deleteAttachment } from '@/core/services/storageService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { CHAT_COLLECTIONS, CONVERSATION_TYPE, CHAT_LIMITS } from '../domain/constants.js';
import {
  toMember,
  dedupeMembers,
  directConversationId,
  conversationTypeFor,
  conversationTitle,
} from '../domain/conversations.js';

const COL = CHAT_COLLECTIONS;

const noop = () => {};

function trimmed(value, max) {
  const text = String(value ?? '').trim();
  return max ? text.slice(0, max) : text;
}

function sanitizeAttachments(attachments) {
  return (Array.isArray(attachments) ? attachments : [])
    .filter((a) => a && a.url)
    .slice(0, CHAT_LIMITS.MAX_ATTACHMENTS)
    .map((a) => ({
      url: a.url,
      path: a.path || '',
      name: a.name || 'arquivo',
      content_type: a.content_type || a.contentType || '',
      size: a.size || 0,
      kind: a.kind || (String(a.content_type || a.contentType || '').startsWith('image/') ? 'image' : 'file'),
    }));
}

function messagePreview(text, attachments) {
  if (text && text.trim()) return trimmed(text, 140);
  if (attachments && attachments.length > 0) return '📎 Anexo';
  return '';
}

/* ----------------------------- Conversations ---------------------------- */

export async function getConversation(id) {
  if (!db || !id) return null;
  const snap = await getDoc(doc(db, COL.conversations, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Abre (ou cria) uma conversa direta entre o usuário atual e outra pessoa.
 * Idempotente graças ao id determinístico.
 */
export async function getOrCreateDirectConversation(user, profile, other) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const me = toMember({ uid: user.uid, name: profile?.platform_name || user.displayName || user.email, photo_url: profile?.photo_url || user.photoURL });
  const target = toMember(other);
  if (!target) throw new Error('Selecione um atleta válido.');
  if (target.uid === me.uid) throw new Error('Você não pode iniciar uma conversa consigo mesmo.');

  const id = directConversationId(me.uid, target.uid);
  const existing = await getConversation(id);
  if (existing) {
    // Reexibe a conversa caso o usuário a tenha ocultado anteriormente.
    if ((existing.hidden_for || []).includes(me.uid)) {
      await updateDoc(doc(db, COL.conversations, id), {
        hidden_for: (existing.hidden_for || []).filter((uid) => uid !== me.uid),
        updated_at: serverTimestamp(),
      }).catch(() => {});
    }
    return id;
  }

  const members = dedupeMembers([me, target]);
  await setDoc(doc(db, COL.conversations, id), {
    id,
    type: CONVERSATION_TYPE.DIRECT,
    title: '',
    member_ids: members.map((m) => m.uid),
    members,
    created_by: me.uid,
    hidden_for: [],
    last_message: null,
    last_message_at_ms: Date.now(),
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
    updated_at: serverTimestamp(),
  });
  return id;
}

/**
 * Cria uma conversa em grupo com os participantes informados (inclui o autor).
 */
export async function createGroupConversation(user, profile, people, title) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const me = toMember({ uid: user.uid, name: profile?.platform_name || user.displayName || user.email, photo_url: profile?.photo_url || user.photoURL });
  const members = dedupeMembers([me, ...(people || [])]);
  if (members.length < 2) throw new Error('Selecione pelo menos um atleta.');
  if (members.length > CHAT_LIMITS.MAX_GROUP_MEMBERS) {
    throw new Error(`Um grupo pode ter no máximo ${CHAT_LIMITS.MAX_GROUP_MEMBERS} participantes.`);
  }

  const type = conversationTypeFor(members.map((m) => m.uid));
  // Dois participantes: reaproveita a conversa direta determinística.
  if (type === CONVERSATION_TYPE.DIRECT) {
    const other = members.find((m) => m.uid !== me.uid);
    return getOrCreateDirectConversation(user, profile, other);
  }

  const id = doc(collection(db, COL.conversations)).id;
  await setDoc(doc(db, COL.conversations, id), {
    id,
    type: CONVERSATION_TYPE.GROUP,
    title: trimmed(title, CHAT_LIMITS.GROUP_TITLE_MAX),
    member_ids: members.map((m) => m.uid),
    members,
    created_by: me.uid,
    hidden_for: [],
    last_message: null,
    last_message_at_ms: Date.now(),
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
    updated_at: serverTimestamp(),
  });
  return id;
}

/**
 * A partir de uma conversa aberta, inicia uma NOVA conversa em grupo reunindo
 * os participantes atuais e os atletas recém-selecionados (requisito: "chamar
 * outros atletas inicia um novo chat com todos os selecionados").
 * Retorna o id existente caso o grupo resultante seja idêntico.
 */
export async function startGroupFromConversation(conversation, newPeople, user, profile) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const currentMembers = (conversation?.members || []);
  const union = dedupeMembers([...currentMembers, ...(newPeople || [])]);
  if (union.length <= currentMembers.length) {
    // Nada novo a adicionar — mantém a conversa atual.
    return conversation?.id || null;
  }
  // Remove o autor da lista de "people" porque createGroupConversation já o inclui.
  const others = union.filter((m) => m.uid !== user.uid);
  return createGroupConversation(user, profile, others, conversation?.type === CONVERSATION_TYPE.GROUP ? conversation.title : '');
}

/** Renomeia um grupo (qualquer membro pode ajustar o título). */
export async function renameConversation(conversationId, title) {
  if (!db || !conversationId) return;
  await updateDoc(doc(db, COL.conversations, conversationId), {
    title: trimmed(title, CHAT_LIMITS.GROUP_TITLE_MAX),
    updated_at: serverTimestamp(),
  });
}

/** Sai de um grupo. Se ficar vazio, remove a conversa. */
export async function leaveConversation(conversation, user) {
  if (!user?.uid || !conversation?.id) return;
  const remainingMembers = (conversation.members || []).filter((m) => m.uid !== user.uid);
  const ref = doc(db, COL.conversations, conversation.id);
  if (remainingMembers.length === 0) {
    await deleteDoc(ref);
    return;
  }
  await updateDoc(ref, {
    member_ids: remainingMembers.map((m) => m.uid),
    members: remainingMembers,
    updated_at: serverTimestamp(),
  });
}

/**
 * "Exclui" a conversa para o usuário atual (ocultação por usuário). Reaparece
 * automaticamente quando chega uma nova mensagem.
 */
export async function hideConversation(conversation, user) {
  if (!user?.uid || !conversation?.id) return;
  const hidden = Array.from(new Set([...(conversation.hidden_for || []), user.uid]));
  await updateDoc(doc(db, COL.conversations, conversation.id), {
    hidden_for: hidden,
    updated_at: serverTimestamp(),
  });
}

/**
 * Assina a lista de conversas do usuário em tempo real. Ordena no cliente e
 * oculta conversas marcadas como excluídas pelo próprio usuário.
 */
export function subscribeToConversations(userId, callback) {
  if (!db || !userId) {
    callback?.([]);
    return noop;
  }
  const q = query(collection(db, COL.conversations), where('member_ids', 'array-contains', userId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => !(c.hidden_for || []).includes(userId))
        .sort((a, b) => (b.last_message_at_ms || 0) - (a.last_message_at_ms || 0));
      callback?.(list);
    },
    (err) => {
      logger.error('Falha ao assinar conversas:', err);
      callback?.([]);
    },
  );
}

/* ------------------------------- Messages ------------------------------- */

/** Coleção de mensagens (subcoleção da conversa). */
function messagesCol(conversationId) {
  return collection(db, COL.conversations, conversationId, COL.messages);
}

/** Assina as mensagens de uma conversa em tempo real (ordem crescente). */
export function subscribeToMessages(conversationId, callback) {
  if (!db || !conversationId) {
    callback?.([]);
    return noop;
  }
  const q = query(messagesCol(conversationId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.created_at_ms || 0) - (b.created_at_ms || 0));
      callback?.(list);
    },
    (err) => {
      logger.error('Falha ao assinar mensagens:', err);
      callback?.([]);
    },
  );
}

/**
 * Envia uma mensagem (texto e/ou anexos), atualiza o resumo da conversa e
 * notifica os demais participantes.
 */
export async function sendMessage(conversation, { text, attachments } = {}, user, profile) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  if (!conversation?.id) throw new Error('Conversa inválida.');
  const cleanText = trimmed(text, CHAT_LIMITS.MESSAGE_MAX_CHARS);
  const cleanAttachments = sanitizeAttachments(attachments);
  if (!cleanText && cleanAttachments.length === 0) return null;

  const memberIds = conversation.member_ids || [];
  const senderName = profile?.platform_name || user.displayName || user.email || 'Atleta';
  const senderPhoto = profile?.photo_url || user.photoURL || '';
  const nowMs = Date.now();

  const ref = doc(messagesCol(conversation.id));
  await setDoc(ref, {
    id: ref.id,
    conversation_id: conversation.id,
    sender_id: user.uid,
    sender_name: senderName,
    sender_photo: senderPhoto,
    text: cleanText,
    attachments: cleanAttachments,
    edited: false,
    edited_at: null,
    created_at: serverTimestamp(),
    created_at_ms: nowMs,
  });

  // Atualiza o resumo e reexibe a conversa para quem a havia ocultado.
  await updateDoc(doc(db, COL.conversations, conversation.id), {
    last_message: {
      text: messagePreview(cleanText, cleanAttachments),
      sender_id: user.uid,
      sender_name: senderName,
      at_ms: nowMs,
      has_attachments: cleanAttachments.length > 0,
    },
    last_message_at_ms: nowMs,
    hidden_for: [],
    updated_at: serverTimestamp(),
  }).catch((err) => logger.error('Falha ao atualizar resumo da conversa:', err));

  // Notificações (best-effort).
  const title = conversation.type === CONVERSATION_TYPE.GROUP
    ? `${senderName} · ${conversationTitle(conversation, user.uid)}`
    : senderName;
  notifyUsers(memberIds, {
    title,
    message: messagePreview(cleanText, cleanAttachments) || 'Nova mensagem',
    type: NOTIFICATION_TYPE.CHAT_MESSAGE,
    link: `/chat?c=${conversation.id}`,
    actor: { uid: user.uid, displayName: senderName },
  });

  return ref.id;
}

/** Edita o texto de uma mensagem própria. */
export async function editMessage(conversationId, messageId, newText, user) {
  if (!user?.uid || !conversationId || !messageId) return;
  await updateDoc(doc(db, COL.conversations, conversationId, COL.messages, messageId), {
    text: trimmed(newText, CHAT_LIMITS.MESSAGE_MAX_CHARS),
    edited: true,
    edited_at: serverTimestamp(),
  });
}

/** Exclui uma mensagem própria e seus anexos (best-effort no Storage). */
export async function deleteMessage(message, user) {
  if (!user?.uid || !message?.id || !message?.conversation_id) return;
  await deleteDoc(doc(db, COL.conversations, message.conversation_id, COL.messages, message.id));
  (message.attachments || []).forEach((a) => a.path && deleteAttachment(a.path));
}

/**
 * Carrega membros de um clube como candidatos a iniciar conversas (não usado
 * diretamente, mas exportado para reuso futuro).
 */
export async function listConversationsOnce(userId) {
  if (!db || !userId) return [];
  const snap = await getDocs(query(collection(db, COL.conversations), where('member_ids', 'array-contains', userId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => !(c.hidden_for || []).includes(userId))
    .sort((a, b) => (b.last_message_at_ms || 0) - (a.last_message_at_ms || 0));
}
