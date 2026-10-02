/**
 * challengeService — desafios, entradas e duelos (I/O).
 *
 * ⚠️ A forma das consultas é contrato: a regra de `gamification_challenges`
 * esconde o RASCUNHO, e o Firestore só aceita uma consulta se a regra for
 * provável para tudo o que ela pode devolver. Por isso a lista pública é
 * sempre por `status` (nunca a coleção inteira) e a do emissor, pelos campos
 * do emissor. Está provado no emulador (`tests/rules/gamificationV2.rules.test.js`).
 */
import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/core/services/auditService';
import { validateChallenge } from '@/modules/progression/domain/challenges';
import { gamificationDb } from './firestoreDb.js';

const db = () => gamificationDb();

/** Os desafios ATIVOS (o que a pessoa pode ver e disputar agora). */
export async function listActiveChallenges() {
  const snap = await getDocs(query(collection(db(), 'gamification_challenges'), where('status', '==', 'active'), limit(100)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Os já ENCERRADOS (resultados). */
export async function listFinishedChallenges(max = 30) {
  const snap = await getDocs(query(collection(db(), 'gamification_challenges'), where('status', '==', 'finished'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => Number(b.endsAt) - Number(a.endsAt));
}

/** Os desafios de um emissor (rascunhos e cancelados inclusos). */
export async function listChallengesByIssuer(issuerType, issuerId) {
  if (!issuerType || !issuerId) return [];
  const snap = await getDocs(query(
    collection(db(), 'gamification_challenges'),
    where('issuerType', '==', issuerType), where('issuerId', '==', issuerId), limit(100),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => Number(b.startsAt) - Number(a.startsAt));
}

export async function getChallenge(id) {
  const snap = await getDoc(doc(db(), 'gamification_challenges', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Cria o desafio (validando antes) e audita. */
export async function createChallenge(input, issuer, actor) {
  const v = validateChallenge(input, { ...issuer, uid: actor.uid });
  if (!v.ok) {
    const e = new Error(Object.values(v.errors)[0] || 'Desafio inválido.');
    e.errors = v.errors;
    throw e;
  }
  const ref = doc(collection(db(), 'gamification_challenges'));
  await setDoc(ref, { ...v.value, createdAt: Date.now() });
  await createAuditLog({ action: 'gamification_challenge_created', actor, details: { id: ref.id, issuerType: issuer.type, issuerId: issuer.id, title: v.value.title } });
  return ref.id;
}

/** Edita (campos do emissor) — revalida tudo. */
export async function updateChallenge(id, atual, patch, issuer, actor) {
  const v = validateChallenge({ ...atual, ...patch }, { ...issuer, uid: atual.createdBy });
  if (!v.ok) {
    const e = new Error(Object.values(v.errors)[0] || 'Desafio inválido.');
    e.errors = v.errors;
    throw e;
  }
  const { createdBy: _c, issuerType: _t, issuerId: _i, schemaVersion: _s, ...editavel } = v.value;
  await updateDoc(doc(db(), 'gamification_challenges', id), editavel);
  await createAuditLog({ action: 'gamification_challenge_updated', actor, details: { id } });
}

export async function cancelChallenge(id, actor) {
  await updateDoc(doc(db(), 'gamification_challenges', id), { status: 'cancelled' });
  await createAuditLog({ action: 'gamification_challenge_cancelled', actor, details: { id } });
}

export async function deleteChallenge(id) {
  await deleteDoc(doc(db(), 'gamification_challenges', id));
}

/* ---------------------------------------------------------------- entradas -- */

/** Todas as entradas de um desafio (o placar). */
export async function listEntries(challengeId) {
  if (!challengeId) return [];
  const snap = await getDocs(query(collection(db(), 'challenge_entries'), where('challengeId', '==', challengeId), limit(1000)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** As entradas da pessoa (em quais desafios ela está). */
export async function listMyEntries(uid) {
  if (!uid) return [];
  const snap = await getDocs(query(collection(db(), 'challenge_entries'), where('uid', '==', uid), limit(100)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** O atleta entra num desafio (nasce zerado — valor e posição são do servidor). */
export async function joinChallenge(challengeId, uid) {
  const id = `${challengeId}_${uid}`;
  await setDoc(doc(db(), 'challenge_entries', id), {
    challengeId, subjectType: 'athlete', subjectId: uid, uid, joinedAt: Date.now(),
    value: 0, position: null, finalized: false, prizeXp: 0,
  });
  return id;
}

/** O admin do clube inscreve o clube num desafio entre clubes. */
export async function joinChallengeAsClub(challengeId, clubId, uid) {
  const id = `${challengeId}_club_${clubId}`;
  await setDoc(doc(db(), 'challenge_entries', id), {
    challengeId, subjectType: 'club', subjectId: clubId, uid, joinedAt: Date.now(),
    value: 0, position: null, finalized: false, prizeXp: 0,
  });
  return id;
}

export async function leaveChallenge(entryId) {
  await deleteDoc(doc(db(), 'challenge_entries', entryId));
}

/* ------------------------------------------------------------------ duelos -- */

/** Os duelos da pessoa: uma consulta por lado (a regra confere cada um). */
export async function listMyDuels(uid) {
  if (!uid) return [];
  const [a, b] = await Promise.all([
    getDocs(query(collection(db(), 'duels'), where('uidA', '==', uid), limit(60))),
    getDocs(query(collection(db(), 'duels'), where('uidB', '==', uid), limit(60))),
  ]);
  const porId = new Map();
  [...a.docs, ...b.docs].forEach((d) => porId.set(d.id, { id: d.id, ...d.data() }));
  return [...porId.values()].sort((x, y) => String(y.week).localeCompare(String(x.week)));
}

/** Recusa o duelo da semana (a regra só deixa active → declined). */
export async function declineDuel(duelId, uid) {
  await updateDoc(doc(db(), 'duels', duelId), { status: 'declined', declinedBy: uid, declinedAt: Date.now() });
}
