/**
 * Serviço de rating ELO — SÓ LEITURA.
 *
 * Quem materializa `player_ratings`, `rating_history` e `doubles_rankings` é
 * exclusivamente o servidor (`functions/platformRankings.js`), a cada resultado
 * publicado e pela recuperação agendada. O cliente NÃO grava ranking — e a
 * regra do Firestore recusa, inclusive para o admin da plataforma.
 *
 * 🐞 Até 2026-09-24 havia aqui um `recomputeAllRatings` que rodava no navegador
 * do admin a cada visita. Ele era um SEGUNDO escritor das mesmas coleções e
 * gravava só o ELO e as duplas — nunca o rating 2.0–8.0. Enquanto as funções
 * do servidor estiveram apagadas (o projeto Firebase é compartilhado com outro
 * aplicativo), o navegador do admin atualizou dois rankings e o terceiro ficou
 * parado: a plataforma passou a mostrar três rankings discordando entre si, sem
 * nada na tela avisar. Ver `docs/18-RANKINGS.md` §8.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { MATCH_STATUS, MODALITY_FORMAT } from '@/modules/tournament/domain/constants';
import { toMillis } from '@/modules/tournament/domain/participation';

const RATINGS_COLLECTION = 'player_ratings';
const HISTORY_COLLECTION = 'rating_history';
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

/** Ranking nacional materializado (ordenado por rating desc). */
export async function listNationalRanking() {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, RATINGS_COLLECTION), orderBy('rating', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Estado do recálculo no servidor (`platform_settings/ranking_worker`), ou null
 * quando ele nunca registrou passada. Leitura pública, como o resto de
 * `platform_settings`. Uma consulta que FALHA lança — quem chama distingue
 * "não sei" de "não existe" (docs/27-FALHA-NAO-E-VAZIO.md).
 */
export async function getRankingWorkerStatus() {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'platform_settings', 'ranking_worker'));
  return snap.exists() ? snap.data() : null;
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
  // Torneios + dias de jogo publicados (club_event_games): a mesma base do
  // ranking individual, para que o ranking de duplas também os incorpore.
  const [matchesSnap, clubEventGamesSnap] = await Promise.all([
    getDocs(query(collection(db, 'tournament_matches'), where('status', 'in', FINISHED_STATUSES))),
    getDocs(query(collection(db, 'club_event_games'), where('status', '==', MATCH_STATUS.FINISHED))),
  ]);
  const finished = matchesSnap.docs.map((d) => d.data());
  const clubEventGames = clubEventGamesSnap.docs.map((d) => d.data());
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
    // Confrontos de equipes são espelhados por etapa em `club_event_games`.
    if (m.team_confrontation) return;
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

  // Dias de jogo (clube e atleta): `side_a_ids`/`side_b_ids` já são uids.
  clubEventGames.forEach((g) => {
    if (g.winner_side !== 'a' && g.winner_side !== 'b') return;
    const a = Array.isArray(g.side_a_ids) ? g.side_a_ids.filter(Boolean) : [];
    const b = Array.isArray(g.side_b_ids) ? g.side_b_ids.filter(Boolean) : [];
    if (a.length === 0 || b.length === 0) return;
    matches.push({
      side_a: a,
      side_b: b,
      winner: g.winner_side,
      points_a: Number(g.score_a) || 0,
      points_b: Number(g.score_b) || 0,
      tournament_id: null,
      at: toMillis(g.result_recorded_at) || toMillis(g.created_at),
    });
  });

  return { matches, nameById };
}
