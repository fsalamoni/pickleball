/**
 * seasonRankingService — Firestore adapter para season_rankings
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
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import {
  seasonRankingPath,
  validateSeasonRanking,
  SEASON_RANKING_VERSION,
} from '@/modules/progression/domain/gamificationV2Schema2';
import { monthlySeasonRange, currentSeasonId } from '@/modules/progression/domain/seasons';

function db() { return getFirestore(); }

function parseDoc(data) {
  const parsed = {
    ...data,
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
  };
  return validateSeasonRanking(parsed).success ? parsed : null;
}

export async function upsertSeasonRanking({ seasonId, uid, xp, tier, position, deltaPosition, prizeXp }) {
  if (!seasonId || !uid) return null;
  const now = Date.now();
  const payload = {
    seasonId, uid, schemaVersion: SEASON_RANKING_VERSION,
    xp, tier, position, deltaPosition, prizeXp, updatedAt: now,
  };
  const v = validateSeasonRanking(payload);
  if (!v.success) throw new Error('seasonRanking schema inválido');
  await setDoc(doc(db(), seasonRankingPath(seasonId, uid)), {
    ...v.data,
    serverUpdatedAt: serverTimestamp(),
  });
  return v.data;
}

export async function getSeasonRanking(seasonId, uid) {
  if (!seasonId || !uid) return null;
  const snap = await getDoc(doc(db(), seasonRankingPath(seasonId, uid)));
  if (!snap.exists()) return null;
  return parseDoc(snap.data());
}

export async function getCurrentSeasonRanking(uid) {
  return getSeasonRanking(currentSeasonId(), uid);
}

export async function listSeasonTop({ seasonId, limit: lim = 50 } = {}) {
  if (!seasonId) return [];
  const q = query(
    collection(db(), 'season_rankings'),
    where('seasonId', '==', seasonId),
    orderBy('xp', 'desc'),
    limit(lim),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => parseDoc(d.data())).filter(Boolean);
}

export async function listUserSeasons(uid) {
  if (!uid) return [];
  const q = query(
    collection(db(), 'season_rankings'),
    where('uid', '==', uid),
    orderBy('xp', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => parseDoc(snap.data())).filter(Boolean);
}

export function watchSeasonRanking(seasonId, uid, onChange, onError) {
  if (!seasonId || !uid) return () => {};
  return onSnapshot(
    doc(db(), seasonRankingPath(seasonId, uid)),
    (snap) => {
      if (!snap.exists()) { onChange(null); return; }
      onChange(parseDoc(snap.data()));
    },
    onError,
  );
}

/** Calcula mês corrente. */
export function getCurrentSeason() {
  return monthlySeasonRange(new Date());
}
