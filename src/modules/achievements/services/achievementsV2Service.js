/**
 * achievementsV2Service — Firestore adapter para user_achievements_v2/{uid}_{achId}
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
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import {
  achievementDocPath,
  UserAchievementV2Schema,
} from '@/modules/progression/domain/progressionV2Schema';

function db() {
  return getFirestore();
}

function parseDoc(data) {
  return {
    ...data,
    unlockedAt: data.unlockedAt?.toMillis ? data.unlockedAt.toMillis() : data.unlockedAt,
  };
}

/** Lista todas as conquistas desbloqueadas de um user. */
export async function listUserAchievementsV2(uid) {
  if (!uid) return [];
  const q = query(
    collection(db(), 'user_achievements_v2'),
    where('uid', '==', uid),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => parseDoc(d.data()))
    .filter((d) => UserAchievementV2Schema.safeParse(d).success);
}

/** Unlock de uma conquista (idempotente). */
export async function unlockAchievementV2(uid, achievementId, family, rarity, now = Date.now()) {
  if (!uid || !achievementId) return null;
  const ref = doc(db(), achievementDocPath(uid, achievementId));
  const existing = await getDoc(ref);
  if (existing.exists()) {
    return parseDoc(existing.data());
  }
  const payload = {
    uid,
    achievementId,
    family,
    rarity,
    unlockedAt: now,
    progress: 1,
    shareCount: 0,
    notified: false,
  };
  const validation = UserAchievementV2Schema.safeParse(payload);
  if (!validation.success) {
    throw new Error('UserAchievementV2 inválido: ' + validation.error.message);
  }
  await setDoc(ref, { ...validation.data, serverUnlockedAt: serverTimestamp() });
  return validation.data;
}

/** Marca uma conquista como notificada (pra não mostrar toast de novo). */
export async function markAchievementNotified(uid, achievementId) {
  if (!uid || !achievementId) return;
  const ref = doc(db(), achievementDocPath(uid, achievementId));
  await setDoc(ref, { notified: true, serverNotifiedAt: serverTimestamp() }, { merge: true });
}

/** Incrementa shareCount. */
export async function incrementAchievementShare(uid, achievementId) {
  if (!uid || !achievementId) return;
  const ref = doc(db(), achievementDocPath(uid, achievementId));
  // usa getDoc + setDoc (Firestore v9 sem FieldValue.increment em alguns adapters)
  const existing = await getDoc(ref);
  if (!existing.exists()) return;
  const data = parseDoc(existing.data());
  await setDoc(ref, {
    shareCount: (data.shareCount || 0) + 1,
    serverSharedAt: serverTimestamp(),
  }, { merge: true });
}

/** Subscribe em tempo real às conquistas do user. */
export function watchUserAchievementsV2(uid, onChange, onError) {
  if (!uid) return () => {};
  const q = query(
    collection(db(), 'user_achievements_v2'),
    where('uid', '==', uid),
  );
  return onSnapshot(q, (snap) => {
    const list = snap.docs
      .map((d) => parseDoc(d.data()))
      .filter((d) => UserAchievementV2Schema.safeParse(d).success);
    onChange(list);
  }, onError);
}
