/**
 * Serviço do Fórum dos Clubes — tópicos, comentários e enquetes.
 *
 * Decisões de robustez/segurança:
 *  - Consultas usam apenas `where` + ordenação no cliente (sem índices
 *    compostos), evitando erros de "índice ausente".
 *  - Contadores (comment_count) são cosméticos; a verdade é a contagem real
 *    dos comentários.
 *  - `participant_ids` acumula autor + quem comentou, base para notificar
 *    apenas quem realmente participa do tópico (evita spam ao clube inteiro).
 *  - Votos de enquete ficam em documento próprio por usuário
 *    (`${threadId}_${uid}`), evitando contenção de escrita no tópico.
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
  increment,
  arrayUnion,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { deleteAttachment } from '@/core/services/storageService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { CLUB_COLLECTIONS, FORUM_LIMITS } from '../domain/constants.js';
import { buildPoll, isPollClosed } from '../domain/forumPoll.js';

const COL = CLUB_COLLECTIONS;

function trimmed(value, max) {
  const text = String(value ?? '').trim();
  return max ? text.slice(0, max) : text;
}

function sanitizeAttachments(attachments) {
  return (Array.isArray(attachments) ? attachments : [])
    .filter((a) => a && a.url)
    .slice(0, FORUM_LIMITS.MAX_ATTACHMENTS)
    .map((a) => ({
      url: a.url,
      path: a.path || '',
      name: a.name || 'arquivo',
      content_type: a.content_type || a.contentType || '',
      size: a.size || 0,
      kind: a.kind || (String(a.content_type || a.contentType || '').startsWith('image/') ? 'image' : 'file'),
    }));
}

function threadLink(clubId, threadId) {
  return `/clubes/${clubId}?tab=forums&thread=${threadId}`;
}

/* -------------------------------- Threads ------------------------------- */

export async function listThreads(clubId) {
  if (!db || !clubId) return [];
  const snap = await getDocs(query(collection(db, COL.forumThreads), where('club_id', '==', clubId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      // Fixados primeiro, depois por atividade mais recente.
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return (b.last_activity_ms || 0) - (a.last_activity_ms || 0);
    });
}

export async function getThread(threadId) {
  if (!db || !threadId) return null;
  const snap = await getDoc(doc(db, COL.forumThreads, threadId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createThread(clubId, input, user, profile) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const title = trimmed(input.title, FORUM_LIMITS.TITLE_MAX);
  const body = trimmed(input.body, FORUM_LIMITS.BODY_MAX);
  if (!title) throw new Error('Informe um título para o tópico.');

  const poll = input.poll ? buildPoll(input.poll) : null; // valida e normaliza
  const attachments = sanitizeAttachments(input.attachments);
  const nowMs = Date.now();
  const id = doc(collection(db, COL.forumThreads)).id;

  await setDoc(doc(db, COL.forumThreads, id), {
    id,
    club_id: clubId,
    title,
    body,
    attachments,
    poll,
    author_id: user.uid,
    author_name: profile?.platform_name || user.displayName || user.email || 'Atleta',
    author_photo: profile?.photo_url || user.photoURL || '',
    pinned: false,
    comment_count: 0,
    participant_ids: [user.uid],
    last_activity_ms: nowMs,
    created_at: serverTimestamp(),
    created_at_ms: nowMs,
    updated_at: serverTimestamp(),
  });

  await createAuditLog({ action: 'club_forum_thread_created', actor: user, details: { club_id: clubId, thread_id: id } });
  return id;
}

export async function updateThread(threadId, updates, actor) {
  const sanitized = {};
  if (updates.title !== undefined) sanitized.title = trimmed(updates.title, FORUM_LIMITS.TITLE_MAX);
  if (updates.body !== undefined) sanitized.body = trimmed(updates.body, FORUM_LIMITS.BODY_MAX);
  if (updates.attachments !== undefined) sanitized.attachments = sanitizeAttachments(updates.attachments);
  if (updates.pinned !== undefined) sanitized.pinned = !!updates.pinned;
  if (Object.keys(sanitized).length === 0) return;
  sanitized.edited = true;
  sanitized.updated_at = serverTimestamp();
  await updateDoc(doc(db, COL.forumThreads, threadId), sanitized);
  await createAuditLog({ action: 'club_forum_thread_updated', actor, details: { thread_id: threadId, fields: Object.keys(sanitized) } });
}

export async function setThreadPinned(threadId, pinned, actor) {
  await updateDoc(doc(db, COL.forumThreads, threadId), { pinned: !!pinned, updated_at: serverTimestamp() });
  await createAuditLog({ action: pinned ? 'club_forum_thread_pinned' : 'club_forum_thread_unpinned', actor, details: { thread_id: threadId } });
}

export async function deleteThread(thread, actor) {
  if (!thread?.id) return;
  // Remove comentários e votos (best-effort; pode falhar para comentários de
  // terceiros quando o ator não é admin — nesse caso ficam órfãos inofensivos).
  for (const sub of [COL.forumComments, COL.forumPollVotes]) {
    try {
      const snap = await getDocs(collection(db, COL.forumThreads, thread.id, sub));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (err) {
      logger.error(`Falha ao limpar ${sub} do tópico ${thread.id}:`, err);
    }
  }
  await deleteDoc(doc(db, COL.forumThreads, thread.id));
  // Remove anexos do tópico do Storage (best-effort).
  (thread.attachments || []).forEach((a) => a.path && deleteAttachment(a.path));
  await createAuditLog({ action: 'club_forum_thread_deleted', actor, details: { thread_id: thread.id } });
}

/* ------------------------------- Comments ------------------------------- */

export async function listComments(threadId) {
  if (!db || !threadId) return [];
  const snap = await getDocs(collection(db, COL.forumThreads, threadId, COL.forumComments));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.created_at_ms || 0) - (b.created_at_ms || 0));
}

export async function addComment(thread, input, user, profile) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  if (!thread?.id) throw new Error('Tópico inválido.');
  const body = trimmed(input.body, FORUM_LIMITS.COMMENT_MAX);
  const attachments = sanitizeAttachments(input.attachments);
  if (!body && attachments.length === 0) throw new Error('Escreva um comentário ou anexe um arquivo.');

  const nowMs = Date.now();
  const ref = doc(collection(db, COL.forumThreads, thread.id, COL.forumComments));
  const authorName = profile?.platform_name || user.displayName || user.email || 'Atleta';

  await setDoc(ref, {
    id: ref.id,
    thread_id: thread.id,
    club_id: thread.club_id,
    body,
    attachments,
    author_id: user.uid,
    author_name: authorName,
    author_photo: profile?.photo_url || user.photoURL || '',
    edited: false,
    edited_at: null,
    created_at: serverTimestamp(),
    created_at_ms: nowMs,
  });

  // Atualiza o tópico (contador cosmético + atividade + participantes).
  await updateDoc(doc(db, COL.forumThreads, thread.id), {
    comment_count: increment(1),
    last_activity_ms: nowMs,
    participant_ids: arrayUnion(user.uid),
    updated_at: serverTimestamp(),
  }).catch((err) => logger.error('Falha ao atualizar tópico após comentário:', err));

  // Notifica os participantes do tópico (exceto o autor do comentário).
  notifyUsers(thread.participant_ids || [thread.author_id], {
    title: `${authorName} comentou em "${trimmed(thread.title, 60)}"`,
    message: body ? trimmed(body, 140) : '📎 Anexo',
    type: NOTIFICATION_TYPE.FORUM_REPLY,
    link: threadLink(thread.club_id, thread.id),
    actor: { uid: user.uid, displayName: authorName },
  });

  return ref.id;
}

export async function updateComment(threadId, commentId, body, actor) {
  if (!threadId || !commentId) return;
  await updateDoc(doc(db, COL.forumThreads, threadId, COL.forumComments, commentId), {
    body: trimmed(body, FORUM_LIMITS.COMMENT_MAX),
    edited: true,
    edited_at: serverTimestamp(),
  });
}

export async function deleteComment(comment, actor) {
  if (!comment?.id || !comment?.thread_id) return;
  await deleteDoc(doc(db, COL.forumThreads, comment.thread_id, COL.forumComments, comment.id));
  (comment.attachments || []).forEach((a) => a.path && deleteAttachment(a.path));
  // Decrementa o contador cosmético (best-effort).
  updateDoc(doc(db, COL.forumThreads, comment.thread_id), {
    comment_count: increment(-1),
    updated_at: serverTimestamp(),
  }).catch(() => {});
}

/* -------------------------------- Polls --------------------------------- */

export async function listPollVotes(threadId) {
  if (!db || !threadId) return [];
  const snap = await getDocs(collection(db, COL.forumThreads, threadId, COL.forumPollVotes));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getMyPollVote(threadId, userId) {
  if (!db || !threadId || !userId) return null;
  const snap = await getDoc(doc(db, COL.forumThreads, threadId, COL.forumPollVotes, userId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function setPollVote(thread, optionIds, user) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  if (!thread?.id || !thread.poll) throw new Error('Enquete indisponível.');
  if (isPollClosed(thread.poll)) throw new Error('Esta enquete está encerrada.');

  const valid = new Set((thread.poll.options || []).map((o) => o.id));
  const ids = Array.from(new Set((optionIds || []).filter((id) => valid.has(id))));
  // Voto único: garante no máximo uma opção.
  const finalIds = thread.poll.multiple ? ids : ids.slice(0, 1);

  const ref = doc(db, COL.forumThreads, thread.id, COL.forumPollVotes, user.uid);
  if (finalIds.length === 0) {
    // Sem opção selecionada: remove o voto.
    await deleteDoc(ref).catch(() => {});
    return;
  }
  await setDoc(ref, {
    thread_id: thread.id,
    club_id: thread.club_id,
    user_id: user.uid,
    option_ids: finalIds,
    updated_at: serverTimestamp(),
  });
}
