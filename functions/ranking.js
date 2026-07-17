/**
 * Recálculo do ranking ELO no servidor (Cloud Functions).
 *
 * Espelha fielmente a lógica do cliente (src/modules/rating/domain/elo.js +
 * ratingService) para que cliente e servidor produzam EXATAMENTE o mesmo
 * ranking — não há divergência: ambos fazem um replay determinístico de todos
 * os jogos finalizados de torneios públicos e encerrados.
 *
 * Este módulo é intencionalmente autocontido (sem importar de ../src) porque o
 * pacote de Functions é publicado isolado.
 */

const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const RATINGS_COLLECTION = 'player_ratings';
const HISTORY_COLLECTION = 'rating_history';
const HISTORY_MAX_POINTS = 50;
const SAFE_BATCH_WRITE_SIZE = 450;
const FINISHED_STATUSES = ['finished', 'walkover'];
const DOUBLES = 'doubles';

// Níveis em ordem crescente (espelha LEVEL_TABLE do cliente) para a semente.
const LEVEL_IDS = [
  'iniciante_1', 'iniciante_2', 'iniciante_plus', 'intermediario',
  'intermediario_plus', 'avancado', 'pro', 'open',
];

const DEFAULT_SEED_RATING = 1000;
const ELO_K = 24;
const PROVISIONAL_K = 40;
const PROVISIONAL_GAMES = 10;

function expectedScore(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}
function kFactor(gamesPlayed) {
  return gamesPlayed < PROVISIONAL_GAMES ? PROVISIONAL_K : ELO_K;
}
function seedFromLevelOrdinal(ordinal, totalLevels) {
  if (!Number.isInteger(ordinal) || ordinal < 0 || !Number.isInteger(totalLevels) || totalLevels <= 1) {
    return DEFAULT_SEED_RATING;
  }
  const min = 800;
  const max = 1600;
  const step = (max - min) / (totalLevels - 1);
  return Math.round(min + Math.min(ordinal, totalLevels - 1) * step);
}
function mean(values) {
  if (values.length === 0) return DEFAULT_SEED_RATING;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
function ensurePlayer(state, id, seeds) {
  let player = state.get(id);
  if (!player) {
    const seed = Number.isFinite(seeds[id]) ? seeds[id] : DEFAULT_SEED_RATING;
    player = {
      player_id: id, rating: seed, games: 0, wins: 0, losses: 0, peak_rating: seed,
      points_for: 0, points_against: 0, tournaments: new Set(),
    };
    state.set(id, player);
  }
  return player;
}
function applyMatch(state, match, seeds) {
  const idsA = (match.side_a || []).filter(Boolean);
  const idsB = (match.side_b || []).filter(Boolean);
  if (idsA.length === 0 || idsB.length === 0) return;
  if (match.winner !== 'a' && match.winner !== 'b') return;
  const playersA = idsA.map((id) => ensurePlayer(state, id, seeds));
  const playersB = idsB.map((id) => ensurePlayer(state, id, seeds));
  const teamA = mean(playersA.map((p) => p.rating));
  const teamB = mean(playersB.map((p) => p.rating));
  const expA = expectedScore(teamA, teamB);
  const scoreA = match.winner === 'a' ? 1 : 0;
  const pointsA = Number(match.points_a) || 0;
  const pointsB = Number(match.points_b) || 0;
  const tId = match.tournament_id || null;
  playersA.forEach((p) => {
    p.rating += kFactor(p.games) * (scoreA - expA);
    p.games += 1;
    if (scoreA === 1) p.wins += 1; else p.losses += 1;
    if (p.rating > p.peak_rating) p.peak_rating = p.rating;
    p.points_for += pointsA; p.points_against += pointsB;
    if (tId) p.tournaments.add(tId);
  });
  playersB.forEach((p) => {
    p.rating += kFactor(p.games) * ((1 - scoreA) - (1 - expA));
    p.games += 1;
    if (scoreA === 0) p.wins += 1; else p.losses += 1;
    if (p.rating > p.peak_rating) p.peak_rating = p.rating;
    p.points_for += pointsB; p.points_against += pointsA;
    if (tId) p.tournaments.add(tId);
  });
}
function computeRatings(matches, seeds) {
  const ordered = (matches || []).slice();
  if (ordered.some((m) => Number.isFinite(m.at))) {
    ordered.sort((a, b) => (a.at || 0) - (b.at || 0));
  }
  const state = new Map();
  ordered.forEach((m) => applyMatch(state, m, seeds));
  return Array.from(state.values())
    .map((p) => ({
      player_id: p.player_id,
      rating: Math.round(p.rating),
      peak_rating: Math.round(p.peak_rating),
      games: p.games, wins: p.wins, losses: p.losses,
      points_for: p.points_for, points_against: p.points_against,
      points_balance: p.points_for - p.points_against,
      tournaments: p.tournaments.size,
    }))
    .sort((a, b) => b.rating - a.rating || b.games - a.games);
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'object' && typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value === 'object' && typeof value.seconds === 'number') return value.seconds * 1000;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function isEligible(t) {
  return Boolean(t) && t.visibility === 'public' && t.status === 'finished' && t.archived !== true;
}
function computeSignature(tournaments) {
  return (tournaments || [])
    .filter(isEligible)
    .map((t) => `${t.id}:${toMillis(t.updated_at) || 0}:${toMillis(t.auto_closed_at) || 0}`)
    .sort()
    .join('|');
}

function resolveRegistrationUids(reg) {
  if (!reg) return { uids: [], complete: false };
  const isDoubles = reg.format === DOUBLES;
  const a = reg.player_a_user_id || null;
  const b = reg.player_b_user_id || null;
  if (isDoubles) return { uids: [a, b].filter(Boolean), complete: Boolean(a && b) };
  return { uids: a ? [a] : [], complete: Boolean(a) };
}
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

/**
 * Recalcula todos os ratings (torneios públicos e encerrados) e materializa.
 * @param {import('firebase-admin/firestore').Firestore} db
 * @returns {Promise<{ players: number, matchesUsed: number }>}
 */
async function recomputeAllRatings(db) {
  const [matchesSnap, regsSnap, profilesSnap, tournamentsSnap] = await Promise.all([
    db.collection('tournament_matches').where('status', 'in', FINISHED_STATUSES).get(),
    db.collection('tournament_registrations').get(),
    db.collection('athlete_profiles').get(),
    db.collection('tournaments').get(),
  ]);

  const tournaments = tournamentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const eligibleIds = new Set(tournaments.filter(isEligible).map((t) => t.id));
  const ratingSignature = computeSignature(tournaments);

  const regById = new Map(regsSnap.docs.map((d) => [d.id, d.data()]));
  const profileById = new Map(profilesSnap.docs.map((d) => [d.id, { uid: d.id, ...d.data() }]));

  const seeds = {};
  profileById.forEach((profile, uid) => {
    const idx = LEVEL_IDS.indexOf(profile.leveling_level);
    if (idx >= 0) seeds[uid] = seedFromLevelOrdinal(idx, LEVEL_IDS.length);
  });

  const engineMatches = [];
  matchesSnap.docs.forEach((docSnap) => {
    const m = docSnap.data();
    if (m.winner_side !== 'a' && m.winner_side !== 'b') return;
    if (!eligibleIds.has(m.tournament_id)) return;
    const a = resolveSideUids(m.side_a_ids, regById);
    const b = resolveSideUids(m.side_b_ids, regById);
    if (!a.complete || !b.complete) return;
    const games = Array.isArray(m.games) ? m.games : [];
    engineMatches.push({
      side_a: a.uids,
      side_b: b.uids,
      winner: m.winner_side,
      points_a: games.reduce((s, g) => s + (Number(g.a) || 0), 0),
      points_b: games.reduce((s, g) => s + (Number(g.b) || 0), 0),
      tournament_id: m.tournament_id || null,
      at: toMillis(m.result_recorded_at) || toMillis(m.updated_at) || toMillis(m.created_at),
    });
  });

  const ranking = computeRatings(engineMatches, seeds);
  const rows = ranking.map((p, index) => {
    const profile = profileById.get(p.player_id) || {};
    return {
      uid: p.player_id,
      rating: p.rating, peak_rating: p.peak_rating,
      games: p.games, wins: p.wins, losses: p.losses,
      points_for: p.points_for, points_against: p.points_against,
      points_balance: p.points_balance, tournaments: p.tournaments,
      position: index + 1,
      platform_name: profile.platform_name || 'Atleta',
      photo_url: profile.photo_url || '',
      city: profile.city || null, state: profile.state || null,
      level: profile.level || null, leveling_level: profile.leveling_level || null,
      gender: profile.gender || null,
      age: Number.isFinite(profile.age) ? profile.age : null,
      club_ids: Array.isArray(profile.club_ids) ? profile.club_ids : [],
      clubs: Array.isArray(profile.clubs) ? profile.clubs : [],
    };
  });

  const [historySnap, existingRatingsSnap] = await Promise.all([
    db.collection(HISTORY_COLLECTION).get(),
    db.collection(RATINGS_COLLECTION).get(),
  ]);
  const historyByUid = new Map(historySnap.docs.map((d) => [d.id, d.data()]));
  const snapshotAt = Date.now();

  for (let i = 0; i < rows.length; i += SAFE_BATCH_WRITE_SIZE) {
    const batch = db.batch();
    rows.slice(i, i + SAFE_BATCH_WRITE_SIZE).forEach((row) => {
      batch.set(db.collection(RATINGS_COLLECTION).doc(row.uid), { ...row, updated_at: FieldValue.serverTimestamp() });
      const prev = historyByUid.get(row.uid);
      const points = Array.isArray(prev?.points) ? prev.points.slice(-(HISTORY_MAX_POINTS - 1)) : [];
      points.push({ at: snapshotAt, rating: row.rating });
      batch.set(db.collection(HISTORY_COLLECTION).doc(row.uid), {
        uid: row.uid, points, updated_at: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  const newUids = new Set(rows.map((r) => r.uid));
  const staleIds = existingRatingsSnap.docs.map((d) => d.id).filter((id) => !newUids.has(id));
  for (let i = 0; i < staleIds.length; i += SAFE_BATCH_WRITE_SIZE) {
    const batch = db.batch();
    staleIds.slice(i, i + SAFE_BATCH_WRITE_SIZE).forEach((id) => batch.delete(db.collection(RATINGS_COLLECTION).doc(id)));
    await batch.commit();
  }

  await db.collection('platform_settings').doc('global').set(
    { ratings_signature: ratingSignature, ratings_recomputed_at: FieldValue.serverTimestamp() },
    { merge: true },
  );

  return { players: rows.length, matchesUsed: engineMatches.length };
}

module.exports = { recomputeAllRatings, isEligible, getFirestore };
