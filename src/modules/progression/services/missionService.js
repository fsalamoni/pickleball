/**
 * missionService — Firestore adapter para user_missions/{uid}_{date}
 *
 * - getOrCreateDailyMissions: garante que existe um doc pro dia
 * - syncMissionProgress: aplica a atividade REAL do atleta (nunca um "+1"
 *   informado pela UI)
 * - claimBonus: marca bonusClaimed
 */
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit as fsLimit,
  getDocs,
  getAggregateFromServer,
  sum,
  serverTimestamp,
} from 'firebase/firestore';
import { UserMissionSchema, missionDocPath } from '@/modules/progression/domain/progressionV2Schema';
import { generateMissions, MISSION_BONUS_XP } from '@/modules/progression/domain/missions';
import {
  missionDateKey, missionDaySeed, scopeKey, missionDocId,
} from '@/modules/progression/domain/missionDay';
import { applyRealProgress } from '@/modules/progression/domain/missionMetrics';
import { missionDocXp } from '@/modules/progression/domain/xpTotal';

import { gamificationDb } from './firestoreDb.js';

function db() {
  return gamificationDb();
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

/**
 * O documento de missões de um ESCOPO (dia, semana ou mês), ou null.
 * O diário segue `{uid}_{dia}` (o que já está no banco); semana e mês têm
 * marcador no id (ver `missionDocId`).
 */
export async function getScopedMissions(uid, scope, now = new Date()) {
  if (!uid) return null;
  const key = scopeKey(scope, now);
  const snap = await getDoc(doc(db(), `user_missions/${missionDocId(uid, scope, key)}`));
  if (!snap.exists()) return null;
  const parsed = parseMissionDoc(snap.data());
  return UserMissionSchema.safeParse(parsed).success ? parsed : null;
}

/**
 * Cria as missões da SEMANA ou do MÊS se ainda não existem (o diário continua
 * em `getOrCreateDailyMissions`). `modules` são os módulos ligados pelo admin:
 * missão que depende de módulo desligado não sai.
 */
export async function getOrCreateScopedMissions(uid, scope, currentTier, now = new Date(), { modules = null } = {}) {
  if (!uid) return null;
  if (scope === 'daily') return getOrCreateDailyMissions(uid, currentTier, now, { modules });
  const key = scopeKey(scope, now);
  const ref = doc(db(), `user_missions/${missionDocId(uid, scope, key)}`);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const parsed = parseMissionDoc(existing.data());
    return UserMissionSchema.safeParse(parsed).success ? parsed : null;
  }
  const seed = Number(key.replace(/-/g, '')) * 10 + (scope === 'weekly' ? 1 : 2);
  const generated = generateMissions({ uid, scope, currentTier, now, seed, modules });
  const payload = {
    uid,
    date: key,
    scope,
    missions: generated.map((m) => ({
      id: m.id, title: m.title, description: m.description, metric: m.metric,
      target: m.target, current: 0, xp: m.xpReward, bonus: MISSION_BONUS_XP[scope],
      bonusClaimed: false, seed,
    })),
    bonusClaimed: false,
    xpEarned: 0,
    completedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const validacao = UserMissionSchema.safeParse(payload);
  if (!validacao.success) {
    throw new Error(`missões (${scope}) com shape inválido: ${validacao.error.message}`);
  }
  await setDoc(ref, { ...payload, serverCreatedAt: serverTimestamp() });
  return payload;
}

/** Sincroniza o progresso REAL num escopo (nunca regride). */
export async function syncScopedProgress(uid, scope, metricas, now = new Date()) {
  if (!uid || !metricas) return null;
  const key = scopeKey(scope, now);
  const ref = doc(db(), `user_missions/${missionDocId(uid, scope, key)}`);
  const existing = await getDoc(ref);
  if (!existing.exists()) return null;
  const data = parseMissionDoc(existing.data());
  if (!Array.isArray(data.missions)) return null;
  const { missions: atualizadas, changed } = applyRealProgress(data.missions, metricas);
  if (!changed) return data;
  const todas = atualizadas.every((m) => m.current >= m.target);
  const updated = {
    ...data, missions: atualizadas,
    completedAt: todas && !data.completedAt ? Date.now() : data.completedAt,
    updatedAt: Date.now(),
  };
  updated.xpEarned = missionDocXp(updated);
  await setDoc(ref, { ...updated, serverUpdatedAt: serverTimestamp() });
  return updated;
}

/** Resgata o bônus de "todas as missões" do escopo. Só vale com todas cumpridas. */
export async function claimScopedBonus(uid, scope, now = new Date()) {
  if (!uid) return null;
  const key = scopeKey(scope, now);
  const ref = doc(db(), `user_missions/${missionDocId(uid, scope, key)}`);
  const existing = await getDoc(ref);
  if (!existing.exists()) return null;
  const data = parseMissionDoc(existing.data());
  const todas = Array.isArray(data.missions) && data.missions.length > 0
    && data.missions.every((m) => (m.current || 0) >= (m.target || 1));
  if (!todas) throw new Error('Cumpra todas as missões antes de resgatar o bônus.');
  const updated = { ...data, bonusClaimed: true, updatedAt: Date.now() };
  updated.xpEarned = missionDocXp(updated);
  await setDoc(ref, { ...updated, serverUpdatedAt: serverTimestamp() });
  return updated;
}

/** Cria o doc de missões do dia se não existir. */
export async function getOrCreateDailyMissions(uid, currentTier, now = new Date(), { modules = null } = {}) {
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
  const generated = generateMissions({ uid, scope: 'daily', currentTier, seed, modules });
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
      // o domínio chama de `xpReward`; o documento guarda `xp`. Ler o nome
      // errado gravava `undefined`, o Firestore recusava o documento inteiro
      // e NENHUMA missão chegava a existir — em silêncio.
      xp: m.xpReward,
      bonus: MISSION_BONUS_XP.daily,
      bonusClaimed: false,
      seed,
    })),
    bonusClaimed: false,
    xpEarned: 0,
    completedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Validar ANTES de gravar: o Firestore rejeita `undefined` e o erro sai
  // como falha genérica de escrita, longe da causa. Aqui a mensagem aponta o
  // campo, e o teste quebra em vez de a produção emudecer.
  const validacao = UserMissionSchema.safeParse(payload);
  if (!validacao.success) {
    throw new Error(`missões do dia com shape inválido: ${validacao.error.message}`);
  }

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
  updated.xpEarned = missionDocXp(updated);
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
  updated.xpEarned = missionDocXp(updated);
  await setDoc(ref, { ...updated, serverUpdatedAt: serverTimestamp() });
  return updated;
}

/**
 * Documentos de missão do atleta, do mais recente para o mais antigo.
 *
 * O limite vai na QUERY (índice composto `uid ASC, date DESC`): antes a
 * função baixava TODOS os dias de missão do usuário para descartar o
 * excedente no navegador — a conta cresce um documento por dia, para sempre.
 *
 * @param {string} uid
 * @param {number} [max] quantos dias trazer
 */
export async function listUserMissions(uid, max = 30) {
  if (!uid) return [];
  const q = query(
    collection(db(), 'user_missions'),
    where('uid', '==', uid),
    orderBy('date', 'desc'),
    fsLimit(max),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => parseMissionDoc(d.data()))
    .filter((d) => UserMissionSchema.safeParse(d).success);
}

/**
 * O XP de missões de TODA a história — uma soma feita pelo banco (agregação),
 * que não baixa os documentos: custa 1 leitura a cada 1.000 documentos.
 *
 * Lança se a agregação não estiver disponível (índice ainda sendo construído,
 * por exemplo): quem chama cai no cálculo pela lista recente.
 */
export async function sumMissionXp(uid) {
  if (!uid) return 0;
  const snap = await getAggregateFromServer(
    query(collection(db(), 'user_missions'), where('uid', '==', uid)),
    { total: sum('xpEarned') },
  );
  return Math.max(0, Math.round(Number(snap.data().total) || 0));
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
