/**
 * socialGamificationService — avaliação pós-jogo, carta ao companheiro e
 * reputação (I/O). As regras e a anonimização estão nos domínios
 * (`matchReviews.js`, `partnerLetters.js`); aqui só se lê e se grava.
 */
import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, query, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { createAuditLog } from '@/core/services/auditService';
import {
  reviewDocId, validateReview,
} from '@/modules/progression/domain/matchReviews';
import {
  letterDocId, validateLetter,
} from '@/modules/progression/domain/partnerLetters';
import { gamificationDb } from './firestoreDb.js';

const db = () => gamificationDb();

/* ---------------------------------------------------------- avaliações ---- */

/** As avaliações que a pessoa escreveu. */
export async function listMyReviews(uid) {
  if (!uid) return [];
  const snap = await getDocs(query(collection(db(), 'match_reviews'), where('fromUid', '==', uid), limit(300)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Envia as avaliações de UM jogo — uma por pessoa avaliada, num lote só (ou
 * todas ou nenhuma). Cada item é validado pelo domínio ANTES de gravar.
 *
 * @param {{ fromUid: string, matchKey: string, items: Array<{ toUid: string, rating: number, tags?: string[], issues?: string[], relation?: string }> }} p
 */
export async function submitMatchReviews({ fromUid, matchKey, items }) {
  if (!fromUid || !matchKey || !Array.isArray(items) || items.length === 0) {
    throw new Error('Escolha ao menos uma pessoa para avaliar.');
  }
  const batch = writeBatch(db());
  const agora = Date.now();
  items.forEach((it) => {
    const v = validateReview({ fromUid, toUid: it.toUid, matchKey, rating: it.rating, tags: it.tags, issues: it.issues, relation: it.relation });
    if (!v.ok) throw new Error(v.error);
    batch.set(doc(db(), 'match_reviews', reviewDocId(matchKey, fromUid, it.toUid)), { ...v.value, createdAt: agora });
  });
  await batch.commit();
  return items.length;
}

/** Retira uma avaliação que a pessoa escreveu. */
export async function retractReview(reviewId) {
  await deleteDoc(doc(db(), 'match_reviews', reviewId));
}

/** A reputação pública de alguém (agregado do servidor), ou null. */
export async function getReputation(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db(), 'user_reputation', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** O que a própria pessoa vê sobre si (as categorias de problema são só dela). */
export async function getMyPrivateReputation(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db(), 'user_reputation_private', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/* -------------------------------------------------------------- cartas ---- */

/**
 * Envia a carta. O documento do destinatário e o registro do autor vão no MESMO
 * lote — a regra exige os dois (sem o registro, a moderação não chegaria a quem
 * escreveu; e a carta anônima não carrega o autor).
 *
 * @param {{ fromUid: string, fromName?: string, toUid: string, matchKey: string, text: string, showName?: boolean }} p
 */
export async function sendPartnerLetter({ fromUid, fromName = '', toUid, matchKey, text, showName = false }) {
  const v = validateLetter({ fromUid, toUid, matchKey, text, showName });
  if (!v.ok) throw new Error(v.error);
  const id = letterDocId(matchKey, fromUid, toUid);
  const agora = Date.now();
  const batch = writeBatch(db());
  batch.set(doc(db(), 'partner_letters', id), {
    toUid,
    fromUid: v.value.showName ? fromUid : null,
    fromName: v.value.showName ? String(fromName || '').slice(0, 60) : null,
    text: v.value.text,
    showName: v.value.showName,
    matchKey,
    createdAt: agora,
    readAt: null,
    reported: false,
  });
  batch.set(doc(db(), 'partner_letter_authors', id), { fromUid, toUid, matchKey, createdAt: agora });
  await batch.commit();
  return id;
}

/** As cartas que a pessoa RECEBEU. */
export async function listReceivedLetters(uid) {
  if (!uid) return [];
  const snap = await getDocs(query(collection(db(), 'partner_letters'), where('toUid', '==', uid), limit(100)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** As cartas que a pessoa ENVIOU (pelo registro de autoria). */
export async function listSentLetters(uid) {
  if (!uid) return [];
  const snap = await getDocs(query(collection(db(), 'partner_letter_authors'), where('fromUid', '==', uid), limit(300)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function markLetterRead(letterId) {
  await updateDoc(doc(db(), 'partner_letters', letterId), { readAt: Date.now() });
}

/** Denuncia: vai para a fila de moderação do admin. */
export async function reportLetter(letterId) {
  await updateDoc(doc(db(), 'partner_letters', letterId), { reported: true });
}

export async function deleteLetter(letterId) {
  await deleteDoc(doc(db(), 'partner_letters', letterId));
}

/* ------------------------------------------------------ moderação (admin) -- */

/**
 * Cartas denunciadas, para a fila do admin. Consulta pelo campo `reported`
 * (o admin lê tudo; a regra o reconhece).
 */
export async function listReportedLetters() {
  const snap = await getDocs(query(collection(db(), 'partner_letters'), where('reported', '==', true), limit(100)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Quem escreveu uma carta (só o admin lê o registro). Audita o acesso. */
export async function revealLetterAuthor(letterId, actor) {
  const snap = await getDoc(doc(db(), 'partner_letter_authors', letterId));
  await createAuditLog({
    action: 'gamification_account_moderated',
    actor,
    details: { kind: 'letter_author_revealed', letterId },
  });
  return snap.exists() ? snap.data() : null;
}
