/**
 * Serviço do ranking "estilo DUPR" (escala 2.000–8.000) — INDEPENDENTE do
 * rating ELO existente. Materializa em `player_skill_ratings` (uma leitura
 * pública; escrita só do admin da plataforma, como em `player_ratings`).
 *
 * Reaproveita a MESMA base de jogos finalizados do ranking ELO (torneios +
 * dias de jogo) via `normalizeFinishedGames`, sem tocar em `ratingService`.
 *
 * NOTA (fase 2 / DUPR oficial): quando houver acesso de parceiro DUPR, a
 * semente/《verificação》 e o envio de partidas passam por `duprOfficial.js`
 * (hoje um espaço reservado, sem rede). Este serviço permanece o motor local.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { MATCH_STATUS } from '@/modules/tournament/domain/constants';
import { LEVEL_TABLE } from '@/modules/leveling/data/levels';
import { normalizeFinishedGames } from '../domain/gameLog.js';
import { computeDuprRatings, seedFromProfile } from '../domain/duprScale.js';

const RATINGS_COLLECTION = 'player_skill_ratings';
const HISTORY_COLLECTION = 'skill_rating_history';
const HISTORY_MAX_POINTS = 50;
const SAFE_BATCH_WRITE_SIZE = 450;
// Ao gravar rating + histórico no mesmo lote são 2 escritas por atleta;
// mantém o lote abaixo do limite do Firestore (500 ops).
const COMBINED_BATCH_ROWS = 200;
const FINISHED_STATUSES = [MATCH_STATUS.FINISHED, MATCH_STATUS.WALKOVER];

function flattenSide(side) {
  return {
    rating: side.rating,
    peak: side.peak_rating,
    games: side.games,
    wins: side.wins,
    losses: side.losses,
    balance: side.points_balance,
    tournaments: side.tournaments,
    reliability: side.reliability,
    provisional: side.provisional,
  };
}

/**
 * Recalcula o ranking "estilo DUPR" a partir de todos os jogos finalizados e
 * materializa em `player_skill_ratings`. Só o admin da plataforma escreve.
 *
 * @param {object} actor admin (auditoria)
 * @returns {Promise<{ players: number, matchesUsed: number }>}
 */
export async function recomputeDuprRatings(actor) {
  if (!db) return { players: 0, matchesUsed: 0 };

  // 1) Jogos finalizados (mesma base do ranking ELO): torneios + dias de jogo.
  const [tournamentMatchesSnap, clubEventGamesSnap] = await Promise.all([
    getDocs(query(collection(db, 'tournament_matches'), where('status', 'in', FINISHED_STATUSES))),
    getDocs(query(collection(db, 'club_event_games'), where('status', '==', MATCH_STATUS.FINISHED))),
  ]);
  const tournamentMatches = tournamentMatchesSnap.docs.map((d) => d.data());
  const clubEventMatches = clubEventGamesSnap.docs.map((d) => d.data());

  // 2) Inscrições (regId → uids) e 3) perfis (uid → dados/semente).
  const [regsSnap, profilesSnap] = await Promise.all([
    getDocs(collection(db, 'tournament_registrations')),
    getDocs(collection(db, 'athlete_profiles')),
  ]);
  const regById = new Map(regsSnap.docs.map((d) => [d.id, d.data()]));
  const profileById = new Map(profilesSnap.docs.map((d) => [d.id, { uid: d.id, ...d.data() }]));

  const seeds = {};
  profileById.forEach((profile, uid) => {
    seeds[uid] = seedFromProfile(profile, LEVEL_TABLE);
  });

  // 4) Normaliza os jogos (fonte compartilhada) e 5) calcula.
  const engineMatches = normalizeFinishedGames({ tournamentMatches, clubEventMatches, regById });
  const ranking = computeDuprRatings(engineMatches, { seeds });

  // 6) Monta as linhas materializadas (planas, para ordenar/filtrar sem índice).
  const rows = ranking.map((p) => {
    const profile = profileById.get(p.player_id) || {};
    const doubles = flattenSide(p.doubles);
    const singles = flattenSide(p.singles);
    return {
      uid: p.player_id,
      platform_name: profile.platform_name || 'Atleta',
      photo_url: profile.photo_url || '',
      city: profile.city || null,
      state: profile.state || null,
      level: profile.level || null,
      leveling_level: profile.leveling_level || null,
      gender: profile.gender || null,
      age: Number.isFinite(profile.age) ? profile.age : null,
      club_ids: Array.isArray(profile.club_ids) ? profile.club_ids : [],
      clubs: Array.isArray(profile.clubs) ? profile.clubs : [],
      // Semente/《vínculo》 informado (para transparência e futura unificação DUPR).
      dupr_id: profile.dupr_id || null,
      seed_rating: seeds[p.player_id] ?? null,
      // Blocos simples/duplas achatados.
      doubles_rating: doubles.rating,
      doubles_peak: doubles.peak,
      doubles_games: doubles.games,
      doubles_wins: doubles.wins,
      doubles_losses: doubles.losses,
      doubles_balance: doubles.balance,
      doubles_reliability: doubles.reliability,
      doubles_provisional: doubles.provisional,
      singles_rating: singles.rating,
      singles_peak: singles.peak,
      singles_games: singles.games,
      singles_wins: singles.wins,
      singles_losses: singles.losses,
      singles_balance: singles.balance,
      singles_reliability: singles.reliability,
      singles_provisional: singles.provisional,
    };
  });

  // 7) Materializa (em lotes) o rating atual + acrescenta um ponto ao histórico
  //    de evolução (skill_rating_history), e limpa órfãos.
  const [existingSnap, historySnap] = await Promise.all([
    getDocs(collection(db, RATINGS_COLLECTION)),
    getDocs(collection(db, HISTORY_COLLECTION)),
  ]);
  const historyByUid = new Map(historySnap.docs.map((d) => [d.id, d.data()]));
  const snapshotAt = Date.now();
  for (let i = 0; i < rows.length; i += COMBINED_BATCH_ROWS) {
    const batch = writeBatch(db);
    rows.slice(i, i + COMBINED_BATCH_ROWS).forEach((row) => {
      batch.set(doc(db, RATINGS_COLLECTION, row.uid), { ...row, updated_at: serverTimestamp() });
      // Ponto de evolução: guarda os dois ratings (duplas e simples) na data.
      const prev = historyByUid.get(row.uid);
      const points = Array.isArray(prev?.points) ? prev.points.slice(-(HISTORY_MAX_POINTS - 1)) : [];
      points.push({ at: snapshotAt, doubles: row.doubles_rating, singles: row.singles_rating });
      batch.set(doc(db, HISTORY_COLLECTION, row.uid), { uid: row.uid, points, updated_at: serverTimestamp() });
    });
    await batch.commit();
  }
  const newUids = new Set(rows.map((r) => r.uid));
  const staleIds = existingSnap.docs.map((d) => d.id).filter((id) => !newUids.has(id));
  for (let i = 0; i < staleIds.length; i += SAFE_BATCH_WRITE_SIZE) {
    const batch = writeBatch(db);
    staleIds.slice(i, i + SAFE_BATCH_WRITE_SIZE).forEach((id) => batch.delete(doc(db, RATINGS_COLLECTION, id)));
    await batch.commit();
  }

  await createAuditLog({
    action: 'dupr_ratings_recomputed',
    actor,
    details: { players: rows.length, matches_used: engineMatches.length, stale_removed: staleIds.length },
  });

  return { players: rows.length, matchesUsed: engineMatches.length, staleRemoved: staleIds.length };
}

/**
 * Lê o ranking "estilo DUPR" materializado. Sem ordenação no servidor (a UI
 * ordena por simples/duplas), evitando índice composto novo.
 * @returns {Promise<Array<object>>}
 */
export async function listDuprRanking() {
  if (!db) return [];
  const snap = await getDocs(collection(db, RATINGS_COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Histórico de evolução do rating "estilo DUPR" de um atleta: pontos
 * { at, doubles, singles } acrescentados a cada recálculo.
 * @returns {Promise<Array<{ at: number, doubles: number, singles: number }>>}
 */
export async function getDuprRatingHistory(uid) {
  if (!db || !uid) return [];
  const snap = await getDoc(doc(db, HISTORY_COLLECTION, uid));
  const points = snap.exists() ? snap.data().points : null;
  return Array.isArray(points) ? points : [];
}

/** Rating "estilo DUPR" de um único atleta (ou null se ainda não houver). */
export async function getDuprRatingForUid(uid) {
  if (!db || !uid) return null;
  const snap = await getDoc(doc(db, RATINGS_COLLECTION, uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
