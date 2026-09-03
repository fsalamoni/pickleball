/**
 * kudoService — Firestore adapter para user_kudos + user_kudos_index
 */
import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  limit as fsLimit,
  getDocs,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import {
  kudoPath,
  kudoIndexPath,
  validateUserKudo,
  validateUserKudoIndex,
  KUDO_INDEX_VERSION,
} from '@/modules/progression/domain/gamificationV2Schema2';
import { missionDateKey } from '@/modules/progression/domain/missionDay';
import { createAuditLog } from '@/core/services/auditService';

function db() { return getFirestore(); }

function makeEmptyIndex(uid) {
  return {
    uid, schemaVersion: KUDO_INDEX_VERSION,
    receivedCount: 0, givenCount: 0,
    receivedToday: 0, givenToday: 0,
    lastKudoDay: missionDateKey(),
    updatedAt: Date.now(),
  };
}

const RECEIVE_DAILY_CAP = 100;
const GIVE_DAILY_CAP = 50;

function parseKudo(data) {
  const parsed = {
    ...data,
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt,
    expiresAt: data.expiresAt?.toMillis ? data.expiresAt.toMillis() : data.expiresAt,
  };
  return validateUserKudo(parsed).success ? parsed : null;
}

function parseIndex(data) {
  const parsed = {
    ...data,
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
  };
  return validateUserKudoIndex(parsed).success ? parsed : null;
}

/**
 * Dá um kudo.
 * Aplica rate limiting diário (receive: 100, give: 50).
 *
 * Escrita "crua": não audita. Prefira `giveKudoAudited` nos fluxos de UI —
 * dar kudo mexe no documento de OUTRO usuário e precisa de rastro.
 */
export async function giveKudo({ fromUid, toUid, type, scope, message, contextId }) {
  if (!fromUid || !toUid) return null;
  if (fromUid === toUid) throw new Error('não pode dar kudo pra si mesmo');
  const today = missionDateKey();
  const kudoId = `k_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const kudoRef = doc(db(), kudoPath(kudoId));
  const fromIndexRef = doc(db(), kudoIndexPath(fromUid));
  const toIndexRef = doc(db(), kudoIndexPath(toUid));

  return runTransaction(db(), async (tx) => {
    const [fromDoc, toDoc] = await Promise.all([tx.get(fromIndexRef), tx.get(toIndexRef)]);

    const fromIdx = fromDoc.exists() ? parseIndex(fromDoc.data()) : makeEmptyIndex(fromUid);
    const toIdx = toDoc.exists() ? parseIndex(toDoc.data()) : makeEmptyIndex(toUid);
    if (!fromIdx || !toIdx) throw new Error('index inválido');

    // reset diário se mudou o dia
    const fromToday = fromIdx.lastKudoDay === today ? fromIdx.givenToday : 0;
    const toToday = toIdx.lastKudoDay === today ? toIdx.receivedToday : 0;
    if (fromToday >= GIVE_DAILY_CAP) {
      throw new Error(`limite diário de ${GIVE_DAILY_CAP} kudos dados atingido`);
    }
    if (toToday >= RECEIVE_DAILY_CAP) {
      throw new Error(`limite diário de ${RECEIVE_DAILY_CAP} kudos recebidos atingido`);
    }

    const now = Date.now();
    // cria o kudo
    const kudoPayload = {
      kudoId, fromUid, toUid, type, scope: scope || 'universal',
      message: message?.slice(0, 280),
      contextId,
      createdAt: now,
      expiresAt: now + 30 * 24 * 60 * 60 * 1000, // 30 dias
    };
    const validation = validateUserKudo(kudoPayload);
    if (!validation.success) throw new Error('kudo schema inválido: ' + validation.error.message);
    tx.set(kudoRef, { ...validation.data, serverCreatedAt: serverTimestamp() });

    // atualiza indexes
    tx.set(fromIndexRef, {
      ...fromIdx,
      givenCount: fromIdx.givenCount + 1,
      givenToday: fromToday + 1,
      lastKudoDay: today,
      updatedAt: now,
    }, { merge: true });

    tx.set(toIndexRef, {
      ...toIdx,
      receivedCount: toIdx.receivedCount + 1,
      receivedToday: toToday + 1,
      lastKudoDay: today,
      updatedAt: now,
    }, { merge: true });

    return validation.data;
  });
}

/** Dá um kudo e registra em `audit_logs`. */
export async function giveKudoAudited({ actor, toUid, type, scope, message, contextId }) {
  const kudo = await giveKudo({
    fromUid: actor?.uid, toUid, type, scope, message, contextId,
  });
  if (kudo) {
    await createAuditLog({
      action: 'gamification_kudo_given',
      actor,
      userId: toUid,
      details: { kudo_id: kudo.kudoId, type: kudo.type, scope: kudo.scope },
    });
  }
  return kudo;
}

export async function listKudosReceivedBy(uid, { limit: lim = 50 } = {}) {
  if (!uid) return [];
  // o limite vai na QUERY: sem ele o cliente baixava (e pagava) todos os
  // kudos do usuário só para descartar o excedente no navegador
  const q = query(
    collection(db(), 'user_kudos'),
    where('toUid', '==', uid),
    fsLimit(lim),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => parseKudo(d.data())).filter(Boolean);
}

export async function listKudosGivenBy(uid, { limit: lim = 50 } = {}) {
  if (!uid) return [];
  const q = query(
    collection(db(), 'user_kudos'),
    where('fromUid', '==', uid),
    fsLimit(lim),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => parseKudo(d.data())).filter(Boolean);
}

export async function getKudoIndex(uid) {
  if (!uid) return null;
  const ref = doc(db(), kudoIndexPath(uid));
  const snap = await getDoc(ref);
  if (!snap.exists()) return makeEmptyIndex(uid);
  return parseIndex(snap.data()) || makeEmptyIndex(uid);
}

export function watchKudoIndex(uid, onChange, onError) {
  if (!uid) return () => {};
  return onSnapshot(
    doc(db(), kudoIndexPath(uid)),
    (snap) => {
      if (!snap.exists()) { onChange(makeEmptyIndex(uid)); return; }
      onChange(parseIndex(snap.data()) || makeEmptyIndex(uid));
    },
    onError,
  );
}
