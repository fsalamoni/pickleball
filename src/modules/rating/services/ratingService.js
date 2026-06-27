/**
 * Serviço de rating ELO (materialização e leitura).
 *
 * `recomputeAllRatings` faz um replay determinístico de TODOS os jogos
 * finalizados (em ordem cronológica) e grava o resultado em `player_ratings`.
 * É acionado pelo admin master (botão na página de Métricas). A leitura
 * pública (`listNationalRanking`) consome apenas o documento materializado.
 *
 * v1: o cálculo roda no cliente do admin. Um ranking oficial à prova de
 * manipulação exigirá Cloud Functions (evolução fora deste escopo).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { MATCH_STATUS, MODALITY_FORMAT } from '@/modules/tournament/domain/constants';
import { toMillis } from '@/modules/tournament/domain/participation';
import { LEVEL_TABLE } from '@/modules/leveling/data/levels';
import { computeRatings, seedFromLevelOrdinal } from '../domain/elo.js';

const RATINGS_COLLECTION = 'player_ratings';
const HISTORY_COLLECTION = 'rating_history';
const HISTORY_MAX_POINTS = 50;
const SAFE_BATCH_WRITE_SIZE = 450;
const FINISHED_STATUSES = [MATCH_STATUS.FINISHED, MATCH_STATUS.WALKOVER];

/** uids dos jogadores com conta de uma inscrição; `complete` indica se todos têm conta. */
function resolveRegistrationUids(reg) {
  if (!reg) return { uids: [], complete: false };
  const isDoubles = reg.format === MODALITY_FORMAT.DOUBLES;
  const a = reg.player_a_user_id || null;
  const b = reg.player_b_user_id || null;
  if (isDoubles) {
    return { uids: [a, b].filter(Boolean), complete: Boolean(a && b) };
  }
  return { uids: a ? [a] : [], complete: Boolean(a) };
}

/** Mapeia os ids de inscrição de um lado para uids; só completo se todos resolverem. */
function resolveSideUids(sideIds, regById) {
  const uids = [];
  let complete = true;
  (sideIds || []).forEach((regId) => {
    const resolved = resolveRegistrationUids(regById.get(regId));
    if (!resolved.complete) complete = false;
    uids.push(...resolved.uids);
  });
  if (uids.length === 0) complete = false;
  return { uids, complete };
}

/** Semente de rating de um atleta a partir do seu nível de nivelamento. */
function seedForProfile(profile) {
  const idx = LEVEL_TABLE.findIndex((lvl) => lvl.id === profile?.leveling_level);
  if (idx < 0) return undefined;
  return seedFromLevelOrdinal(idx, LEVEL_TABLE.length);
}

/**
 * Recalcula todos os ratings a partir dos jogos finalizados e materializa em
 * `player_ratings`. Retorna um resumo do processamento.
 * @param {object} actor usuário admin (para auditoria)
 * @returns {Promise<{ players: number, matchesUsed: number, matchesTotal: number }>}
 */
export async function recomputeAllRatings(actor) {
  if (!db) return { players: 0, matchesUsed: 0, matchesTotal: 0 };

  // 1) Jogos finalizados (status in finished/walkover); ordenação cronológica no cliente.
  const matchesSnap = await getDocs(
    query(collection(db, 'tournament_matches'), where('status', 'in', FINISHED_STATUSES)),
  );
  const finishedMatches = matchesSnap.docs.map((d) => d.data());

  // 2) Inscrições (regId → uids) e 3) perfis (uid → dados/semente).
  const [regsSnap, profilesSnap] = await Promise.all([
    getDocs(collection(db, 'tournament_registrations')),
    getDocs(collection(db, 'athlete_profiles')),
  ]);
  const regById = new Map(regsSnap.docs.map((d) => [d.id, d.data()]));
  const profileById = new Map(profilesSnap.docs.map((d) => [d.id, { uid: d.id, ...d.data() }]));

  const seeds = {};
  profileById.forEach((profile, uid) => {
    const seed = seedForProfile(profile);
    if (Number.isFinite(seed)) seeds[uid] = seed;
  });

  // 4) Normaliza os jogos para o motor (somente jogos com os dois lados completos).
  const engineMatches = [];
  finishedMatches.forEach((m) => {
    if (m.winner_side !== 'a' && m.winner_side !== 'b') return;
    const a = resolveSideUids(m.side_a_ids, regById);
    const b = resolveSideUids(m.side_b_ids, regById);
    if (!a.complete || !b.complete) return;
    engineMatches.push({
      side_a: a.uids,
      side_b: b.uids,
      winner: m.winner_side,
      at: toMillis(m.result_recorded_at) || toMillis(m.updated_at) || toMillis(m.created_at),
    });
  });

  // 5) Calcula e materializa.
  const ranking = computeRatings(engineMatches, { seeds });

  const rows = ranking.map((p, index) => {
    const profile = profileById.get(p.player_id) || {};
    return {
      uid: p.player_id,
      rating: p.rating,
      peak_rating: p.peak_rating,
      games: p.games,
      wins: p.wins,
      losses: p.losses,
      position: index + 1,
      platform_name: profile.platform_name || 'Atleta',
      photo_url: profile.photo_url || '',
      city: profile.city || null,
      state: profile.state || null,
      level: profile.level || null,
      leveling_level: profile.leveling_level || null,
      // Denormalizado para rankings segmentados (Fase ranking_filters).
      gender: profile.gender || null,
      age: Number.isFinite(profile.age) ? profile.age : null,
      club_ids: Array.isArray(profile.club_ids) ? profile.club_ids : [],
      clubs: Array.isArray(profile.clubs) ? profile.clubs : [],
    };
  });

  // Histórico de rating: lê o existente uma vez e acrescenta um ponto por jogador.
  const historySnap = await getDocs(collection(db, HISTORY_COLLECTION));
  const historyByUid = new Map(historySnap.docs.map((d) => [d.id, d.data()]));
  const snapshotAt = Date.now();

  for (let i = 0; i < rows.length; i += SAFE_BATCH_WRITE_SIZE) {
    const batch = writeBatch(db);
    rows.slice(i, i + SAFE_BATCH_WRITE_SIZE).forEach((row) => {
      batch.set(doc(db, RATINGS_COLLECTION, row.uid), { ...row, updated_at: serverTimestamp() });

      const prev = historyByUid.get(row.uid);
      const points = Array.isArray(prev?.points) ? prev.points.slice(-(HISTORY_MAX_POINTS - 1)) : [];
      points.push({ at: snapshotAt, rating: row.rating });
      batch.set(doc(db, HISTORY_COLLECTION, row.uid), {
        uid: row.uid,
        points,
        updated_at: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  await createAuditLog({
    action: 'ratings_recomputed',
    actor,
    details: { players: rows.length, matches_used: engineMatches.length, matches_total: finishedMatches.length },
  });

  return { players: rows.length, matchesUsed: engineMatches.length, matchesTotal: finishedMatches.length };
}

/** Ranking nacional materializado (ordenado por rating desc). */
export async function listNationalRanking() {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, RATINGS_COLLECTION), orderBy('rating', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Rating de um atleta específico (ou null). */
export async function getPlayerRating(uid) {
  if (!db || !uid) return null;
  const snap = await getDoc(doc(db, RATINGS_COLLECTION, uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Histórico de rating de um atleta (lista de pontos {at, rating}), ou []. */
export async function getRatingHistory(uid) {
  if (!db || !uid) return [];
  const snap = await getDoc(doc(db, HISTORY_COLLECTION, uid));
  const points = snap.exists() ? snap.data().points : null;
  return Array.isArray(points) ? points : [];
}
