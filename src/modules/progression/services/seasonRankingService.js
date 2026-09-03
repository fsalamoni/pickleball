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
import { monthlySeasonRange } from '@/modules/progression/domain/seasons';
import { platformMonthKey } from '@/modules/progression/domain/missionDay';

/**
 * Id da temporada corrente: 'YYYY-MM' no fuso da plataforma.
 *
 * Era montado a partir de `getSeason()`, que NÃO devolve `month` — o
 * resultado era literalmente `'2026-undefined'`, e todo o ranking sazonal
 * (leitura, escrita e consulta) apontava para essa chave inexistente.
 */
export function currentSeasonId() {
  return platformMonthKey();
}

function db() { return getFirestore(); }

function parseDoc(data) {
  const parsed = {
    ...data,
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
  };
  return validateSeasonRanking(parsed).success ? parsed : null;
}

/**
 * Grava a linha do ranking sazonal.
 *
 * ATENÇÃO: `firestore.rules` só permite escrita em `season_rankings` para
 * platform_admin (a posição no ranking não pode ser decidida pelo cliente —
 * senão qualquer um se declara #1). Chamar isto como usuário comum resulta em
 * permission-denied, e é assim que deve ser: o cálculo sazonal é trabalho de
 * Cloud Function / painel admin.
 */
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
  return snap.docs.map((d) => parseDoc(d.data())).filter(Boolean);
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

/**
 * Janela (início/fim em ms) do mês corrente.
 * `monthlySeasonRange` recebe (year, month) — passar um `Date` fazia a função
 * produzir datas inválidas.
 */
export function getCurrentSeason() {
  const now = new Date();
  return monthlySeasonRange(now.getFullYear(), now.getMonth());
}
