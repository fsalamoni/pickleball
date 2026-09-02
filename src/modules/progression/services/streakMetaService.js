/**
 * streakMetaService — Firestore adapter para user_streak_meta/{uid}
 *
 * State do streak: grace days, freezes, vacation mode, comeback bonus.
 */
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import {
  streakMetaPath,
  UserStreakMetaSchema,
  STREAK_META_VERSION,
} from '@/modules/progression/domain/progressionV2Schema';

function db() { return getFirestore(); }

export function makeEmptyStreakMeta(uid) {
  return {
    uid,
    schemaVersion: STREAK_META_VERSION,
    lastPlayAt: null,
    graceDaysRemaining: 3,
    freezesAvailable: 3,
    freezesUsed: 0,
    vacationMode: false,
    vacationStartedAt: null,
    comebackBonus: 0,
    updatedAt: Date.now(),
  };
}

function parseDoc(data) {
  return {
    ...data,
    lastPlayAt: data.lastPlayAt?.toMillis ? data.lastPlayAt.toMillis() : data.lastPlayAt,
    vacationStartedAt: data.vacationStartedAt?.toMillis ? data.vacationStartedAt.toMillis() : data.vacationStartedAt,
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
  };
}

export async function getStreakMeta(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db(), streakMetaPath(uid)));
  if (!snap.exists()) return null;
  const parsed = parseDoc(snap.data());
  return UserStreakMetaSchema.safeParse(parsed).success ? parsed : null;
}

export async function getOrCreateStreakMeta(uid) {
  if (!uid) return null;
  const existing = await getStreakMeta(uid);
  if (existing) return existing;
  const empty = makeEmptyStreakMeta(uid);
  await setDoc(doc(db(), streakMetaPath(uid)), { ...empty, serverCreatedAt: serverTimestamp() });
  return empty;
}

export async function setStreakMeta(uid, payload) {
  if (!uid) throw new Error('uid é obrigatório');
  const validation = UserStreakMetaSchema.safeParse(payload);
  if (!validation.success) {
    throw new Error('streakMeta schema inválido: ' + validation.error.message);
  }
  await setDoc(doc(db(), streakMetaPath(uid)), {
    ...validation.data,
    serverUpdatedAt: serverTimestamp(),
  });
  return validation.data;
}

/** Ativa vacation mode (com data de início). */
export async function enableVacation(uid) {
  const meta = await getOrCreateStreakMeta(uid);
  const updated = {
    ...meta,
    vacationMode: true,
    vacationStartedAt: Date.now(),
    updatedAt: Date.now(),
  };
  return setStreakMeta(uid, updated);
}

/** Desativa vacation mode. */
export async function disableVacation(uid) {
  const meta = await getOrCreateStreakMeta(uid);
  const updated = {
    ...meta,
    vacationMode: false,
    vacationStartedAt: null,
    updatedAt: Date.now(),
  };
  return setStreakMeta(uid, updated);
}

/** Gasta 1 freeze (cap em freezesAvailable). */
export async function consumeFreeze(uid) {
  const meta = await getOrCreateStreakMeta(uid);
  if (meta.freezesAvailable <= 0) return meta;
  const updated = {
    ...meta,
    freezesAvailable: meta.freezesAvailable - 1,
    freezesUsed: meta.freezesUsed + 1,
    updatedAt: Date.now(),
  };
  return setStreakMeta(uid, updated);
}

/** Compra +1 freeze (custando XP, regra fora desse service). */
export async function addFreeze(uid) {
  const meta = await getOrCreateStreakMeta(uid);
  if (meta.freezesAvailable >= 3) return meta;
  const updated = {
    ...meta,
    freezesAvailable: Math.min(3, meta.freezesAvailable + 1),
    updatedAt: Date.now(),
  };
  return setStreakMeta(uid, updated);
}

export function watchStreakMeta(uid, onChange, onError) {
  if (!uid) return () => {};
  return onSnapshot(
    doc(db(), streakMetaPath(uid)),
    (snap) => {
      if (!snap.exists()) { onChange(null); return; }
      const parsed = parseDoc(snap.data());
      onChange(UserStreakMetaSchema.safeParse(parsed).success ? parsed : null);
    },
    onError,
  );
}
