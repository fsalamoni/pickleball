/**
 * missionService — Firestore adapter para user_missions/{uid}_{date}
 *
 * - getOrCreateDailyMissions: garante que existe um doc pro dia
 * - syncMissionProgress: aplica a atividade REAL do atleta (nunca um "+1"
 *   informado pela UI)
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
import { applyRealProgress } from '@/modules/progression/domain/missionMetrics';

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

/**
 * Sincroniza o documento do dia com a ATIVIDADE REAL do atleta.
 *
 * Substitui o antigo `progressMission(uid, missionId, delta)`, em que a UI
 * mandava "+1" a cada clique do próprio usuário — ou seja, dava para concluir
 * "Jogue 3 partidas" sem jogar nenhuma, e ainda receber o XP.
 *
 * Aqui quem manda são os contadores medidos (`computeMissionMetrics`). Se
 * nada mudou, não grava — evita escrita a cada render.
 *
 * @param {string} uid
 * @param {Record<string, number>} metricas saída de `computeMissionMetrics`
 * @param {Date} [now]
 * @returns {Promise<object|null>} documento atualizado (ou o atual, se nada mudou)
 */
export async function syncMissionProgress(uid, metricas, now = new Date()) {
  if (!uid || !metricas) return null;
  const dateKey = missionDateKey(now);
  const ref = doc(db(), missionDocPath(uid, dateKey));
  const existing = await getDoc(ref);
  if (!existing.exists()) return null;
  const data = parseMissionDoc(existing.data());
  if (!Array.isArray(data.missions)) return null;

  const { missions: updatedMissions, changed } = applyRealProgress(data.missions, metricas);
  if (!changed) return data;

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
