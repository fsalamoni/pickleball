/**
 * missionService — Firestore adapter para user_missions/{uid}_{date}
 *
 * - getOrCreateDailyMissions: garante que existe um doc pro dia
 * - progressMission: atualiza current + valida
 * - claimBonus: marca bonusClaimed
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
import { UserMissionSchema, missionDocPath } from '@/modules/progression/domain/progressionV2Schema';
import { generateMissions, MISSION_BONUS_XP } from '@/modules/progression/domain/missions';
import { missionDateKey, missionDaySeed } from '@/modules/progression/domain/missionDay';

function db() {
  return getFirestore();
}

/** Lê missões de um dia (ou null). */
export async function getMissionsForDate(uid, date) {
  if (!uid) return null;
  const dateKey = missionDateKey(date);
  const snap = await getDoc(doc(db(), missionDocPath(uid, dateKey)));
  if (!snap.exists()) return null;
  const parsed = parseMissionDoc(snap.data());
  return UserMissionSchema.safeParse(parsed).success ? parsed : null;
}

/** Cria o doc de missões do dia se não existir. */
export async function getOrCreateDailyMissions(uid, currentTier, now = new Date()) {
  if (!uid) return null;
  const dateKey = missionDateKey(now);
  const ref = doc(db(), missionDocPath(uid, dateKey));
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const parsed = parseMissionDoc(existing.data());
    return UserMissionSchema.safeParse(parsed).success ? parsed : null;
  }
  // seed determinístico do dia (não muta a Date recebida)
  const seed = missionDaySeed(now);
  const generated = generateMissions({ uid, scope: 'daily', currentTier, seed });
  const payload = {
    uid,
    date: dateKey,
    scope: 'daily',
    missions: generated.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      metric: m.metric,
      target: m.target,
      current: 0,
      xp: m.xp,
      bonus: m.bonus || MISSION_BONUS_XP.daily,
      bonusClaimed: false,
      seed,
    })),
    bonusClaimed: false,
    completedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await setDoc(ref, { ...payload, serverCreatedAt: serverTimestamp() });
  return payload;
}

/** Atualiza current de uma missão. Se completar, marca completedAt. */
export async function progressMission(uid, missionId, delta, now = new Date()) {
  if (!uid || !missionId) return null;
  const dateKey = missionDateKey(now);
  const ref = doc(db(), missionDocPath(uid, dateKey));
  const existing = await getDoc(ref);
  if (!existing.exists()) return null;
  const data = parseMissionDoc(existing.data());
  const idx = data.missions.findIndex((m) => m.id === missionId);
  if (idx < 0) return null;
  const mission = data.missions[idx];
  const newCurrent = Math.min(mission.current + delta, mission.target);
  const updatedMission = { ...mission, current: newCurrent };
  const updatedMissions = [...data.missions];
  updatedMissions[idx] = updatedMission;
  const allDone = updatedMissions.every((m) => m.current >= m.target);
  const updated = {
    ...data,
    missions: updatedMissions,
    completedAt: allDone && !data.completedAt ? Date.now() : data.completedAt,
    updatedAt: Date.now(),
  };
  await setDoc(ref, { ...updated, serverUpdatedAt: serverTimestamp() });
  return updated;
}

/** Marca o bonus do dia como claim. */
export async function claimDailyBonus(uid, now = new Date()) {
  if (!uid) return null;
  const dateKey = missionDateKey(now);
  const ref = doc(db(), missionDocPath(uid, dateKey));
  const existing = await getDoc(ref);
  if (!existing.exists()) return null;
  const data = parseMissionDoc(existing.data());
  const updated = { ...data, bonusClaimed: true, updatedAt: Date.now() };
  await setDoc(ref, { ...updated, serverUpdatedAt: serverTimestamp() });
  return updated;
}

/** Listar missões do usuário num range (pra histórico). */
export async function listUserMissions(uid, limit = 30) {
  if (!uid) return [];
  // firestore não permite query por uid+date sem composite index — busca por prefixo
  // caminho é user_missions/{uid}_{date}, então usamos collection + filter
  const q = query(
    collection(db(), 'user_missions'),
    where('uid', '==', uid),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => parseMissionDoc(d.data()))
    .filter((d) => UserMissionSchema.safeParse(d).success)
    .slice(0, limit);
}

/** Subscribe em tempo real. */
export function watchDailyMissions(uid, onChange, onError) {
  if (!uid) return () => {};
  const dateKey = missionDateKey(new Date());
  return onSnapshot(
    doc(db(), missionDocPath(uid, dateKey)),
    (snap) => {
      if (!snap.exists()) { onChange(null); return; }
      const parsed = parseMissionDoc(snap.data());
      onChange(UserMissionSchema.safeParse(parsed).success ? parsed : null);
    },
    onError,
  );
}

function parseMissionDoc(data) {
  return {
    ...data,
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt,
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
    completedAt: data.completedAt?.toMillis ? data.completedAt.toMillis() : data.completedAt,
  };
}
