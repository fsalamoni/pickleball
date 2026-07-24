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
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { MATCH_STATUS, MODALITY_FORMAT } from '@/modules/tournament/domain/constants';
import { toMillis } from '@/modules/tournament/domain/participation';
import { eligibleTournamentIdsForRanking } from '@/modules/tournament/domain/rankingEligibility';
import { LEVEL_TABLE } from '@/modules/leveling/data/levels';
import { computeRatings, seedFromLevelOrdinal } from '../domain/elo.js';
import { computeRatingSignature } from '../domain/ratingSignature.js';

const SETTINGS_COLLECTION = 'platform_settings';
const SETTINGS_DOC = 'global';

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
 *
 * @param {object} actor usuário admin (para auditoria)
 * @param {{ onlyPublicClosed?: boolean }} [options]
 *   Quando `onlyPublicClosed` é verdadeiro, considera apenas jogos de torneios
 *   PÚBLICOS e já ENCERRADOS que ainda existem — excluindo automaticamente os
 *   apagados, privados ou em andamento (ranking oficial).
 * @returns {Promise<{ players: number, matchesUsed: number, matchesTotal: number }>}
 */
export async function recomputeAllRatings(actor, options = {}) {
  if (!db) return { players: 0, matchesUsed: 0, matchesTotal: 0 };
  const { onlyPublicClosed = false } = options;

  // 1) Jogos finalizados (status in finished/walkover); ordenação cronológica no cliente.
  const matchesSnap = await getDocs(
    query(collection(db, 'tournament_matches'), where('status', 'in', FINISHED_STATUSES)),
  );
  let finishedMatches = matchesSnap.docs.map((d) => d.data());

  // Ranking oficial: restringe aos torneios públicos e encerrados existentes.
  let ratingSignature = null;
  if (onlyPublicClosed) {
    const tournamentsSnap = await getDocs(collection(db, 'tournaments'));
    const tournaments = tournamentsSnap.docs.map((d) => d.data());
    const eligibleIds = eligibleTournamentIdsForRanking(tournaments);
    finishedMatches = finishedMatches.filter((m) => eligibleIds.has(m.tournament_id));
    ratingSignature = computeRatingSignature(tournaments);
  }

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
    const games = Array.isArray(m.games) ? m.games : [];
    const pointsA = games.reduce((sum, g) => sum + (Number(g.a) || 0), 0);
    const pointsB = games.reduce((sum, g) => sum + (Number(g.b) || 0), 0);
    engineMatches.push({
      side_a: a.uids,
      side_b: b.uids,
      winner: m.winner_side,
      points_a: pointsA,
      points_b: pointsB,
      tournament_id: m.tournament_id || null,
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
      points_for: p.points_for,
      points_against: p.points_against,
      points_balance: p.points_balance,
      tournaments: p.tournaments,
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

  // Lê (uma vez) o histórico e os ratings já existentes — para acrescentar
  // pontos ao histórico e detectar ratings órfãos a remover.
  const [historySnap, existingRatingsSnap] = await Promise.all([
    getDocs(collection(db, HISTORY_COLLECTION)),
    getDocs(collection(db, RATINGS_COLLECTION)),
  ]);
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

  // Limpeza: remove ratings de jogadores que não estão mais no ranking (ex.:
  // jogos excluídos/anulados), evitando posições e ratings obsoletos no ranking
  // público. O histórico é preservado (caso o jogador volte a pontuar).
  const newUids = new Set(rows.map((r) => r.uid));
  const staleIds = existingRatingsSnap.docs.map((d) => d.id).filter((id) => !newUids.has(id));
  for (let i = 0; i < staleIds.length; i += SAFE_BATCH_WRITE_SIZE) {
    const batch = writeBatch(db);
    staleIds.slice(i, i + SAFE_BATCH_WRITE_SIZE).forEach((id) => batch.delete(doc(db, RATINGS_COLLECTION, id)));
    await batch.commit();
  }

  // Marca o estado do recálculo (assinatura das entradas + timestamp) para o
  // recálculo automático detectar staleness sem reprocessar tudo.
  if (onlyPublicClosed) {
    try {
      await setDoc(
        doc(db, SETTINGS_COLLECTION, SETTINGS_DOC),
        { ratings_signature: ratingSignature, ratings_recomputed_at: serverTimestamp() },
        { merge: true },
      );
    } catch (err) {
      logger.error('Falha ao gravar o estado do recálculo de ratings:', err);
    }
  }

  await createAuditLog({
    action: 'ratings_recomputed',
    actor,
    details: {
      players: rows.length,
      matches_used: engineMatches.length,
      matches_total: finishedMatches.length,
      stale_removed: staleIds.length,
      auto: Boolean(onlyPublicClosed && options.auto),
    },
  });

  return {
    players: rows.length,
    matchesUsed: engineMatches.length,
    matchesTotal: finishedMatches.length,
    staleRemoved: staleIds.length,
  };
}

/** Lê o estado do último recálculo (assinatura + momento). */
async function readRatingMeta() {
  try {
    const snap = await getDoc(doc(db, SETTINGS_COLLECTION, SETTINGS_DOC));
    const data = snap.exists() ? snap.data() : {};
    return {
      signature: data.ratings_signature ?? null,
      recomputedAtMs: toMillis(data.ratings_recomputed_at) || 0,
    };
  } catch {
    return { signature: null, recomputedAtMs: 0 };
  }
}

/**
 * Recálculo AUTOMÁTICO do ranking: recalcula apenas quando as entradas mudaram
 * desde a última vez (nova assinatura), respeitando um intervalo mínimo para não
 * reprocessar em excesso. Considera sempre o ranking oficial (público +
 * encerrado). Só o admin da plataforma consegue gravar (regras do Firestore).
 *
 * @param {object} actor
 * @param {{ minIntervalMs?: number, force?: boolean }} [options]
 * @returns {Promise<{ ran: boolean, reason?: string } & Record<string, unknown>>}
 */
export async function maybeAutoRecomputeRatings(actor, options = {}) {
  if (!db) return { ran: false, reason: 'no-db' };
  const { minIntervalMs = 60_000, force = false } = options;
  let currentSignature = '';
  try {
    const tournamentsSnap = await getDocs(collection(db, 'tournaments'));
    currentSignature = computeRatingSignature(tournamentsSnap.docs.map((d) => d.data()));
  } catch (err) {
    logger.error('Falha ao ler torneios para o recálculo automático:', err);
    return { ran: false, reason: 'read-failed' };
  }

  if (!force) {
    const meta = await readRatingMeta();
    if (currentSignature === meta.signature) return { ran: false, reason: 'up-to-date' };
    if (meta.recomputedAtMs && Date.now() - meta.recomputedAtMs < minIntervalMs) {
      return { ran: false, reason: 'throttled' };
    }
  }

  const result = await recomputeAllRatings(actor, { onlyPublicClosed: true, auto: true });
  return { ran: true, ...result };
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

/**
 * Lê os jogos finalizados normalizados para o motor (side_a/side_b por uid,
 * winner, pontos) junto com um mapa uid → { name, photo }. Base para rankings
 * derivados (ex.: ranking de duplas). Read-only, aditivo.
 * @returns {Promise<{ matches: Array, nameById: Map }>}
 */
export async function listFinishedEngineMatches() {
  if (!db) return { matches: [], nameById: new Map() };
  const matchesSnap = await getDocs(
    query(collection(db, 'tournament_matches'), where('status', 'in', FINISHED_STATUSES)),
  );
  const finished = matchesSnap.docs.map((d) => d.data());
  const [regsSnap, profilesSnap] = await Promise.all([
    getDocs(collection(db, 'tournament_registrations')),
    getDocs(collection(db, 'athlete_profiles')),
  ]);
  const regById = new Map(regsSnap.docs.map((d) => [d.id, d.data()]));
  const nameById = new Map();
  profilesSnap.docs.forEach((d) => {
    const p = d.data();
    nameById.set(d.id, { name: p.platform_name || p.full_name || 'Atleta', photo: p.photo_url || '' });
  });

  const matches = [];
  finished.forEach((m) => {
    if (m.winner_side !== 'a' && m.winner_side !== 'b') return;
    const a = resolveSideUids(m.side_a_ids, regById);
    const b = resolveSideUids(m.side_b_ids, regById);
    if (!a.complete || !b.complete) return;
    const games = Array.isArray(m.games) ? m.games : [];
    const pointsA = games.reduce((sum, g) => sum + (Number(g.a) || 0), 0);
    const pointsB = games.reduce((sum, g) => sum + (Number(g.b) || 0), 0);
    matches.push({
      side_a: a.uids,
      side_b: b.uids,
      winner: m.winner_side,
      points_a: pointsA,
      points_b: pointsB,
      tournament_id: m.tournament_id || null,
      at: toMillis(m.result_recorded_at) || toMillis(m.updated_at) || toMillis(m.created_at),
    });
  });
  return { matches, nameById };
}
