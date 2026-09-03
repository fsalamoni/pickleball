/**
 * socialBondService — Firestore adapter para user_rivals, crews, crew_members, mentorships
 */
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
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
  rivalPath,
  rivalPairKey,
  crewPath,
  crewMemberPath,
  mentorshipPath,
  mentorPairKey,
  validateUserRival,
  validateCrew,
  validateCrewMember,
  validateMentorship,
  CREW_VERSION,
  MENTORSHIP_VERSION,
} from '@/modules/progression/domain/gamificationV2Schema2';

function db() { return getFirestore(); }

/** Teto de membros por crew. Espelhado em `firestore.rules` (crews). */
export const CREW_MAX_MEMBERS = 50;

function parseRival(data) {
  const parsed = {
    ...data,
    lastGameAt: data.lastGameAt?.toMillis ? data.lastGameAt.toMillis() : data.lastGameAt,
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt,
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
  };
  return validateUserRival(parsed).success ? parsed : null;
}

function parseCrew(data) {
  const parsed = {
    ...data,
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt,
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
  };
  return validateCrew(parsed).success ? parsed : null;
}

function parseCrewMember(data) {
  const parsed = {
    ...data,
    joinedAt: data.joinedAt?.toMillis ? data.joinedAt.toMillis() : data.joinedAt,
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
  };
  return validateCrewMember(parsed).success ? parsed : null;
}

function parseMentorship(data) {
  const parsed = {
    ...data,
    startedAt: data.startedAt?.toMillis ? data.startedAt.toMillis() : data.startedAt,
    endedAt: data.endedAt?.toMillis ? data.endedAt.toMillis() : data.endedAt,
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
  };
  return validateMentorship(parsed).success ? parsed : null;
}

// ===== RIVALS =====

export async function getOrCreateRivalry(uidA, uidB) {
  if (!uidA || !uidB || uidA === uidB) return null;
  const pairKey = rivalPairKey(uidA, uidB);
  const ref = doc(db(), rivalPath(pairKey));
  const snap = await getDoc(ref);
  if (snap.exists()) return parseRival(snap.data());
  const now = Date.now();
  const payload = {
    pairKey, userA: uidA, userB: uidB,
    gamesA: 0, gamesB: 0, winsA: 0, winsB: 0,
    lastGameAt: null, createdAt: now, updatedAt: now,
  };
  const validation = validateUserRival(payload);
  if (!validation.success) throw new Error('rival schema inválido');
  await setDoc(ref, { ...validation.data, serverCreatedAt: serverTimestamp() });
  return validation.data;
}

export async function recordRivalGame({ uidA, uidB, winnerUid }) {
  if (!uidA || !uidB || !winnerUid) return null;
  const pairKey = rivalPairKey(uidA, uidB);
  const ref = doc(db(), rivalPath(pairKey));
  const existing = await getOrCreateRivalry(uidA, uidB);
  if (!existing) return null;
  const aWon = winnerUid === existing.userA;
  const updated = {
    ...existing,
    gamesA: existing.gamesA + 1,
    gamesB: existing.gamesB + 1,
    winsA: existing.winsA + (aWon ? 1 : 0),
    winsB: existing.winsB + (aWon ? 0 : 1),
    lastGameAt: Date.now(),
    updatedAt: Date.now(),
  };
  await setDoc(ref, { ...updated, serverUpdatedAt: serverTimestamp() });
  return updated;
}

export async function listRivalsFor(uid) {
  if (!uid) return [];
  const q1 = query(collection(db(), 'user_rivals'), where('userA', '==', uid));
  const q2 = query(collection(db(), 'user_rivals'), where('userB', '==', uid));
  const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const rivals = [...s1.docs, ...s2.docs]
    .map((d) => parseRival(d.data()))
    .filter(Boolean);
  // dedup por pairKey
  const seen = new Set();
  return rivals.filter((r) => {
    if (seen.has(r.pairKey)) return false;
    seen.add(r.pairKey);
    return true;
  });
}

export function watchRivalry(uidA, uidB, onChange, onError) {
  if (!uidA || !uidB) return () => {};
  const pairKey = rivalPairKey(uidA, uidB);
  return onSnapshot(
    doc(db(), rivalPath(pairKey)),
    (snap) => {
      if (!snap.exists()) { onChange(null); return; }
      onChange(parseRival(snap.data()));
    },
    onError,
  );
}

// ===== CREWS =====

export async function createCrew({ createdBy, name, description, region, isPublic = true }) {
  if (!createdBy || !name) return null;
  const crewId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const crewRef = doc(db(), crewPath(crewId));
  const memberRef = doc(db(), crewMemberPath(crewId, createdBy));
  const now = Date.now();
  const crewPayload = {
    crewId, schemaVersion: CREW_VERSION,
    name: name.slice(0, 40),
    description: description?.slice(0, 280),
    region, isPublic,
    createdBy, membersCount: 1, totalXp: 0, totalWins: 0,
    createdAt: now, updatedAt: now,
  };
  const memberPayload = {
    crewId, uid: createdBy, role: 'owner',
    joinedAt: now, contributionXp: 0, updatedAt: now,
  };
  const v1 = validateCrew(crewPayload);
  const v2 = validateCrewMember(memberPayload);
  if (!v1.success || !v2.success) throw new Error('crew schema inválido');
  await runTransaction(db(), async (tx) => {
    tx.set(crewRef, { ...v1.data, serverCreatedAt: serverTimestamp() });
    tx.set(memberRef, { ...v2.data, serverJoinedAt: serverTimestamp() });
  });
  return v1.data;
}

export async function joinCrew({ crewId, uid }) {
  if (!crewId || !uid) return null;
  const crewRef = doc(db(), crewPath(crewId));
  const memberRef = doc(db(), crewMemberPath(crewId, uid));
  const now = Date.now();
  return runTransaction(db(), async (tx) => {
    // leituras primeiro (regra das transações do Firestore)
    const [crewDoc, memberDoc] = [await tx.get(crewRef), await tx.get(memberRef)];
    if (!crewDoc.exists()) throw new Error('crew não existe');
    const crew = parseCrew(crewDoc.data());
    if (!crew) throw new Error('crew inválido');
    if (memberDoc.exists()) return parseCrewMember(memberDoc.data());
    if (crew.membersCount >= CREW_MAX_MEMBERS) throw new Error(`crew lotada (${CREW_MAX_MEMBERS} membros)`);
    const memberPayload = {
      crewId, uid, role: 'member',
      joinedAt: now, contributionXp: 0, updatedAt: now,
    };
    const v = validateCrewMember(memberPayload);
    if (!v.success) throw new Error('member schema inválido');
    tx.set(memberRef, { ...v.data, serverJoinedAt: serverTimestamp() });
    tx.update(crewRef, { membersCount: crew.membersCount + 1, updatedAt: now });
    return v.data;
  });
}

export async function leaveCrew({ crewId, uid }) {
  if (!crewId || !uid) return null;
  const crewRef = doc(db(), crewPath(crewId));
  const memberRef = doc(db(), crewMemberPath(crewId, uid));
  const now = Date.now();
  return runTransaction(db(), async (tx) => {
    // Todas as leituras ANTES de qualquer escrita — o Firestore recusa a
    // transação inteira se um `tx.get` vier depois de um `tx.delete/set`.
    const [memberDoc, crewDoc] = [await tx.get(memberRef), await tx.get(crewRef)];
    if (!memberDoc.exists()) return null;
    const member = parseCrewMember(memberDoc.data());
    if (!member) return null;
    if (member.role === 'owner') throw new Error('owner não pode sair; transfira a posse antes');

    tx.delete(memberRef);
    if (crewDoc.exists()) {
      const crew = parseCrew(crewDoc.data());
      if (crew && crew.membersCount > 1) {
        tx.update(crewRef, { membersCount: crew.membersCount - 1, updatedAt: now });
      }
    }
    return true;
  });
}

export async function getCrew(crewId) {
  if (!crewId) return null;
  const snap = await getDoc(doc(db(), crewPath(crewId)));
  if (!snap.exists()) return null;
  return parseCrew(snap.data());
}

export async function listCrewMembers(crewId) {
  if (!crewId) return [];
  // crew_members são docIds = crewId_uid — sem índice por crewId nativo;
  // busca via collection + filtro de prefixo no docId não é nativo Firestore
  // então listamos toda a coleção e filtramos (não escala mas é ok p/ MVP).
  // Alternativa: indexar por campo crewId (requer composite index)
  const q = query(collection(db(), 'crew_members'), where('crewId', '==', crewId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => parseCrewMember(d.data())).filter(Boolean);
}

export async function listCrews({ isPublic = true, limit: lim = 30 } = {}) {
  // O limite vai na QUERY: baixar todas as crews públicas do país para
  // mostrar 30 é conta que só cresce.
  const q = query(
    collection(db(), 'crews'),
    where('isPublic', '==', isPublic),
    fsLimit(lim),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => parseCrew(d.data())).filter(Boolean);
}

export async function listCrewsForMember(uid) {
  if (!uid) return [];
  const q = query(collection(db(), 'crew_members'), where('uid', '==', uid));
  const snap = await getDocs(q);
  const memberships = snap.docs.map((d) => parseCrewMember(d.data())).filter(Boolean);
  const crews = await Promise.all(memberships.map((m) => getCrew(m.crewId)));
  return crews.filter(Boolean);
}

export function watchCrew(crewId, onChange, onError) {
  if (!crewId) return () => {};
  return onSnapshot(
    doc(db(), crewPath(crewId)),
    (snap) => {
      if (!snap.exists()) { onChange(null); return; }
      onChange(parseCrew(snap.data()));
    },
    onError,
  );
}

// ===== MENTORSHIPS =====

export async function startMentorship({ mentorUid, apprenticeUid }) {
  if (!mentorUid || !apprenticeUid || mentorUid === apprenticeUid) return null;
  const pairKey = mentorPairKey(mentorUid, apprenticeUid);
  const ref = doc(db(), mentorshipPath(pairKey));
  const snap = await getDoc(ref);
  if (snap.exists()) return parseMentorship(snap.data());
  const now = Date.now();
  const payload = {
    pairKey, schemaVersion: MENTORSHIP_VERSION,
    mentorUid, apprenticeUid, status: 'active',
    lessonsCompleted: 0, startedAt: now, endedAt: null, updatedAt: now,
  };
  const v = validateMentorship(payload);
  if (!v.success) throw new Error('mentorship schema inválido');
  await setDoc(ref, { ...v.data, serverStartedAt: serverTimestamp() });
  return v.data;
}

export async function recordMentorLesson(pairKey) {
  if (!pairKey) return null;
  const ref = doc(db(), mentorshipPath(pairKey));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const m = parseMentorship(snap.data());
  if (!m) return null;
  const updated = { ...m, lessonsCompleted: m.lessonsCompleted + 1, updatedAt: Date.now() };
  await setDoc(ref, { ...updated, serverUpdatedAt: serverTimestamp() });
  return updated;
}

export async function endMentorship(pairKey, status = 'completed') {
  if (!pairKey) return null;
  const ref = doc(db(), mentorshipPath(pairKey));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const m = parseMentorship(snap.data());
  if (!m) return null;
  const now = Date.now();
  const updated = { ...m, status, endedAt: now, updatedAt: now };
  await setDoc(ref, { ...updated, serverEndedAt: serverTimestamp() });
  return updated;
}

export async function listMentorshipsFor(uid) {
  if (!uid) return [];
  const q1 = query(collection(db(), 'mentorships'), where('mentorUid', '==', uid));
  const q2 = query(collection(db(), 'mentorships'), where('apprenticeUid', '==', uid));
  const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  return [...s1.docs, ...s2.docs]
    .map((d) => parseMentorship(d.data()))
    .filter(Boolean);
}
