/**
 * Recálculo do ranking INTERNO do clube no servidor (Cloud Functions).
 *
 * Materializa os rankings em duas coleções top-level:
 *  - `club_internal_ratings/{clubId_atletaUid}`            (escopo só do clube)
 *  - `club_internal_ratings_ext/{clubId_atletaUid}`       (com fontes externas)
 *  - `club_internal_doubles_ratings/{clubId_pairKey}`     (escopo só do clube)
 *  - `club_internal_doubles_ratings_ext/{clubId_pairKey}` (com fontes externas)
 *
 * Os cálculos são **automáticos**: a Cloud Function `recomputeClubInternalRankings`
 * (em `index.js`) é acionada por mudanças em `club_events/.../games`,
 * `club_event_games`, `tournament_matches` e memberships. O frontend
 * apenas LÊ o materializado.
 *
 * Estrutura idêntica a `ranking.js` (autocontido, sem importar de `../src`)
 * para garantir que cliente e servidor produzem o mesmo cálculo.
 */

const SAFE_BATCH_WRITE_SIZE = 450;

const COL_CLUBS = 'clubs';
const COL_MEMBERS = 'club_members';
const COL_EVENTS = 'club_events';
const COL_EVENT_GAMES_SUBCOL = 'games';
const COL_EVENT_PARTICIPANTS = 'participants';
const COL_CLUB_EVENT_GAMES = 'club_event_games';
const COL_TOURNAMENT_MATCHES = 'tournament_matches';
const COL_TOURNAMENT_REGISTRATIONS = 'tournament_registrations';
const COL_TOURNAMENTS = 'tournaments';
const COL_ATHLETE_PROFILES = 'athlete_profiles';

const RANKINGS_INTERNAL = 'club_internal_ratings';
const RANKINGS_EXT = 'club_internal_ratings_ext';
const RANKINGS_DOUBLES_INTERNAL = 'club_internal_doubles_ratings';
const RANKINGS_DOUBLES_EXT = 'club_internal_doubles_ratings_ext';

const FINISHED_STATUSES = ['finished', 'walkover'];
const CLUB_GAME_SOURCES = new Set(['club_event_game', 'club_game']);

/* ----------------------- ID helpers ----------------------- */

function pairKey(id1, id2) {
  return [String(id1), String(id2)].sort().join('__');
}
function ratingId(clubId, userId) {
  return `${clubId}_${userId}`;
}
function ratingExtId(clubId, userId) {
  return `${clubId}_${userId}`;
}
function doublesId(clubId, key) {
  return `${clubId}_${key}`;
}

/* --------------------- Pure normalizers --------------------- */

/**
 * Extrai uids de um lado.
 *
 * Aceita 3 formatos:
 *  1. Array de strings (uids diretos).
 *  2. Array de objetos `{ user_id, ... }` (schema novo: user_id no doc).
 *  3. Array de objetos `{ id, name }` (schema LEGADO do `GameDayOrganizer`):
 *     `id` é o **doc_id de `event_participants`**, NÃO o user_id do atleta.
 *     Para esse caso, `participantById` (mapa `eventParticipantDocId → ep`)
 *     é usado para resolver `p.id → user_id`. Convidados sem `user_id`
 *     são pulados silenciosamente.
 *
 * @param {Array} side
 * @param {Map} [participantById]  opcional, mapa doc_id → event_participant
 * @returns {string[]}
 */
function sideToUids(side, participantById) {
  if (!Array.isArray(side)) return [];
  return side
    .map((p) => {
      if (p == null) return null;
      if (typeof p === 'string') return p;
      // Caso 2: schema novo, com user_id direto.
      if (p.user_id) return p.user_id;
      // Caso 3: schema legado, id é doc_id de event_participant.
      if (p.id && participantById) {
        const ep = participantById.get(p.id);
        if (ep && ep.user_id) return ep.user_id;
      }
      return null;
    })
    .filter(Boolean);
}

/** Normaliza um match do `club_events/{id}/.../games` (organizer). */
function normalizeClubGame(g, participantById) {
  if (!g) return null;
  const points_a = Number(g.score_a) || 0;
  const points_b = Number(g.score_b) || 0;
  const a = sideToUids(g.side_a, participantById);
  const b = sideToUids(g.side_b, participantById);
  if (a.length === 0 || b.length === 0) return null;
  if (a.length > 2 || b.length > 2) return null;
  if (a.length !== b.length) return null;
  if (points_a === points_b) return null; // só decididos
  return {
    source: 'club_event_game',
    side_a: a,
    side_b: b,
    winner: points_a > points_b ? 'a' : 'b',
    points_a,
    points_b,
  };
}

/** Normaliza um `club_event_games` document (Wave C). */
function normalizeClubEventGame(g) {
  if (!g) return null;
  if (g.status !== 'finished') return null;
  if (g.winner_side !== 'a' && g.winner_side !== 'b') return null;
  const a = sideToUids(g.side_a_ids);
  const b = sideToUids(g.side_b_ids);
  if (a.length === 0 || b.length === 0) return null;
  if (a.length > 2 || b.length > 2) return null;
  if (a.length !== b.length) return null;
  return {
    source: 'club_event_game',
    club_id: g.club_id || null,
    side_a: a,
    side_b: b,
    winner: g.winner_side,
    points_a: Number(g.score_a) || 0,
    points_b: Number(g.score_b) || 0,
  };
}

/** Normaliza um `tournament_match` (precisa resolver registration → uid). */
function normalizeTournamentMatch(m, regById) {
  if (!m) return null;
  if (FINISHED_STATUSES.indexOf(m.status) < 0) return null;
  if (m.winner_side !== 'a' && m.winner_side !== 'b') return null;
  const aIds = [];
  const bIds = [];
  (m.side_a_ids || []).forEach((rid) => {
    const r = regById.get(rid);
    if (!r) return;
    if (r.player_a_user_id) aIds.push(r.player_a_user_id);
    if (r.player_b_user_id) aIds.push(r.player_b_user_id);
  });
  (m.side_b_ids || []).forEach((rid) => {
    const r = regById.get(rid);
    if (!r) return;
    if (r.player_a_user_id) bIds.push(r.player_a_user_id);
    if (r.player_b_user_id) bIds.push(r.player_b_user_id);
  });
  if (aIds.length === 0 || bIds.length === 0) return null;
  if (aIds.length > 2 || bIds.length > 2) return null;
  if (aIds.length !== bIds.length) return null;
  return {
    source: 'tournament_match',
    side_a: aIds,
    side_b: bIds,
    winner: m.winner_side,
    points_a: Number(m.score_a) || 0,
    points_b: Number(m.score_b) || 0,
    tournament_id: m.tournament_id || null,
    club_id: m.tournament_club_id || null, // preenchido pelo caller se aplicável
  };
}

/* --------------------- Aggregations (pure) --------------------- */

/** Conjunto de uids de atletas atualmente no clube (membros + perfis). */
function collectClubUids(clubId, members, profiles) {
  const set = new Set();
  (members || []).forEach((m) => { if (m && m.user_id) set.add(m.user_id); });
  (profiles || []).forEach((p) => {
    if (p && Array.isArray(p.club_ids) && p.club_ids.includes(clubId)) {
      if (p.id) set.add(p.id);
    }
  });
  return set;
}

/** Aplica um match ao bucket individual. */
function applyToIndividual(bucket, match) {
  const a = match.side_a;
  const b = match.side_b;
  if (a.length === 0 || b.length === 0) return;
  if (match.winner !== 'a' && match.winner !== 'b') return;
  const aWon = match.winner === 'a';
  a.forEach((uid) => {
    const row = bucket.get(uid) || { user_id: uid, games: 0, wins: 0, losses: 0, points_for: 0, points_against: 0 };
    row.user_id = uid; // garante o campo, mesmo se o row veio de cache
    row.games += 1;
    row.points_for += match.points_a;
    row.points_against += match.points_b;
    if (aWon) row.wins += 1; else row.losses += 1;
    bucket.set(uid, row);
  });
  b.forEach((uid) => {
    const row = bucket.get(uid) || { user_id: uid, games: 0, wins: 0, losses: 0, points_for: 0, points_against: 0 };
    row.user_id = uid;
    row.games += 1;
    row.points_for += match.points_b;
    row.points_against += match.points_a;
    if (!aWon) row.wins += 1; else row.losses += 1;
    bucket.set(uid, row);
  });
}

/** Aplica um match ao bucket de duplas (só 2×2). */
function applyToDoubles(bucket, match) {
  if (match.side_a.length !== 2 || match.side_b.length !== 2) return;
  if (match.winner !== 'a' && match.winner !== 'b') return;
  const aWon = match.winner === 'a';
  const keyA = pairKey(match.side_a[0], match.side_a[1]);
  const keyB = pairKey(match.side_b[0], match.side_b[1]);
  const rowA = bucket.get(keyA) || { pair_key: keyA, player_ids: [match.side_a[0], match.side_a[1]].slice().sort(), games: 0, wins: 0, losses: 0, points_for: 0, points_against: 0 };
  const rowB = bucket.get(keyB) || { pair_key: keyB, player_ids: [match.side_b[0], match.side_b[1]].slice().sort(), games: 0, wins: 0, losses: 0, points_for: 0, points_against: 0 };
  rowA.games += 1; rowB.games += 1;
  rowA.points_for += match.points_a; rowA.points_against += match.points_b;
  rowB.points_for += match.points_b; rowB.points_against += match.points_a;
  if (aWon) { rowA.wins += 1; rowB.losses += 1; } else { rowB.wins += 1; rowA.losses += 1; }
  bucket.set(keyA, rowA);
  bucket.set(keyB, rowB);
}

/**
 * Filtra matches pelos uids do clube e, opcionalmente, só os do próprio clube.
 *
 * Critérios:
 *  - O match precisa envolver pelo menos 1 uid do clube (caso contrário
 *    não nos diz respeito).
 *  - Se for "do clube" (club_event_game / club_game) sempre entra.
 *  - Se for externo (tournament_match), só entra quando `includeExternal`.
 */
function filterMatchesForClub(matches, clubUids, includeExternal) {
  const out = [];
  (matches || []).forEach((m) => {
    let involves = false;
    for (const uid of m.side_a) if (clubUids.has(uid)) { involves = true; break; }
    if (!involves) for (const uid of m.side_b) if (clubUids.has(uid)) { involves = true; break; }
    if (!involves) return;
    if (CLUB_GAME_SOURCES.has(m.source)) {
      out.push(m);
    } else if (includeExternal) {
      out.push(m);
    }
  });
  return out;
}

/** Enriquece bucket com display_name/photo_url via profiles. */
function enrichWithProfiles(individualBucket, doublesBucket, profileById) {
  (individualBucket || new Map()).forEach((row, uid) => {
    const p = profileById.get(uid);
    if (p) {
      row.display_name = p.platform_name || p.full_name || null;
      row.photo_url = p.photo_url || null;
    } else {
      row.display_name = null;
      row.photo_url = null;
    }
  });
  (doublesBucket || new Map()).forEach((row) => {
    row.display_names = (row.player_ids || []).map((uid) => {
      const p = profileById.get(uid);
      return p ? (p.platform_name || p.full_name) : null;
    });
    row.photos = (row.player_ids || []).map((uid) => {
      const p = profileById.get(uid);
      return p ? (p.photo_url || null) : null;
    });
  });
}

/** Ordena bucket individual por wins, win_rate, points_balance, games. */
function sortIndividual(map) {
  return Array.from(map.values())
    .map((r) => ({
      ...r,
      win_rate: r.games > 0 ? r.wins / r.games : 0,
      points_balance: r.points_for - r.points_against,
    }))
    .sort((x, y) => (
      (y.wins - x.wins)
      || (y.win_rate - x.win_rate)
      || (y.points_balance - x.points_balance)
      || (y.games - x.games)
    ));
}

/** Ordena bucket de duplas pelo mesmo critério. */
function sortDoubles(map) {
  return Array.from(map.values())
    .map((r) => ({
      ...r,
      win_rate: r.games > 0 ? r.wins / r.games : 0,
      points_balance: r.points_for - r.points_against,
    }))
    .sort((x, y) => (
      (y.wins - x.wins)
      || (y.win_rate - x.win_rate)
      || (y.points_balance - x.points_balance)
      || (y.games - x.games)
    ));
}

/* --------------------- IO-bound orchestration --------------------- */

/** Carrega os membros do clube. */
async function loadClubMembers(db, clubId) {
  const snap = await db.collection(COL_MEMBERS).where('club_id', '==', clubId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Carrega atletas com `club_ids` incluindo este clube. */
async function loadClubAthletesFromProfiles(db, clubId) {
  const snap = await db.collection(COL_ATHLETE_PROFILES).where('club_ids', 'array-contains', clubId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Carrega eventos do clube. */
async function loadClubEvents(db, clubId) {
  const snap = await db.collection(COL_EVENTS).where('club_id', '==', clubId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Carrega os jogos (subcoleção `games`) de cada evento do clube. */
async function loadClubEventGames(db, events) {
  const all = [];
  for (const ev of events) {
    const sub = await db.collection(COL_EVENTS).doc(ev.id).collection(COL_EVENT_GAMES_SUBCOL).get();
    sub.docs.forEach((d) => all.push({ id: d.id, ...d.data(), event_id: ev.id }));
  }
  return all;
}

/**
 * Carrega os `event_participants` de cada evento do clube e constrói um
 * mapa `eventParticipantDocId → event_participant` (que tem `user_id`).
 *
 * Necessário para que o normalizador de `club_events/.../games` resolva
 * corretamente o schema legado do `GameDayOrganizer` (que salva `id`
 * = doc_id de event_participant, não user_id).
 */
async function loadEventParticipantsMap(db, events) {
  const map = new Map();
  for (const ev of events) {
    const sub = await db.collection(COL_EVENTS).doc(ev.id).collection(COL_EVENT_PARTICIPANTS).get();
    sub.docs.forEach((d) => {
      const data = { id: d.id, ...d.data() };
      map.set(d.id, data);
    });
  }
  return map;
}

/** Carrega os `club_event_games` do próprio clube. */
async function loadClubOwnClubEventGames(db, clubId) {
  const snap = await db.collection(COL_CLUB_EVENT_GAMES).where('club_id', '==', clubId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Carrega todos os `club_event_games` onde uids do clube aparecem (outros clubes). */
async function loadExternalClubEventGames(db, clubUids) {
  if (!clubUids || clubUids.length === 0) return [];
  const CHUNK = 30;
  const all = [];
  const seen = new Set();
  for (let i = 0; i < clubUids.length; i += CHUNK) {
    const slice = Array.from(clubUids).slice(i, i + CHUNK);
    const [a, b] = await Promise.all([
      db.collection(COL_CLUB_EVENT_GAMES).where('side_a_ids', 'array-contains-any', slice).get(),
      db.collection(COL_CLUB_EVENT_GAMES).where('side_b_ids', 'array-contains-any', slice).get(),
    ]);
    const merge = (snap) => snap.docs.forEach((d) => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      all.push({ id: d.id, ...d.data() });
    });
    merge(a);
    merge(b);
  }
  return all;
}

/** Carrega todos os `tournament_matches` finalizados onde uids do clube aparecem. */
async function loadExternalTournamentMatches(db, clubUids) {
  if (!clubUids || clubUids.length === 0) return [];
  const CHUNK = 30;
  const all = [];
  const seen = new Set();
  for (let i = 0; i < clubUids.length; i += CHUNK) {
    const slice = Array.from(clubUids).slice(i, i + CHUNK);
    const [a, b] = await Promise.all([
      db.collection(COL_TOURNAMENT_MATCHES)
        .where('status', 'in', FINISHED_STATUSES)
        .where('side_a_ids', 'array-contains-any', slice).get(),
      db.collection(COL_TOURNAMENT_MATCHES)
        .where('status', 'in', FINISHED_STATUSES)
        .where('side_b_ids', 'array-contains-any', slice).get(),
    ]);
    const merge = (snap) => snap.docs.forEach((d) => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      all.push({ id: d.id, ...d.data() });
    });
    merge(a);
    merge(b);
  }
  return all;
}

/** Carrega registrations (necessário para resolver tournament_matches). */
async function loadTournamentRegistrations(db, regIds) {
  if (!regIds || regIds.length === 0) return new Map();
  const CHUNK = 30; // `in` aceita até 30
  const map = new Map();
  for (let i = 0; i < regIds.length; i += CHUNK) {
    const slice = regIds.slice(i, i + CHUNK);
    const snap = await db.collection(COL_TOURNAMENT_REGISTRATIONS).where('__name__', 'in', slice).get();
    snap.docs.forEach((d) => map.set(d.id, d.data()));
  }
  return map;
}

/** Carrega os torneios (precisamos do club_id do torneio). */
async function loadTournaments(db, tournamentIds) {
  if (!tournamentIds || tournamentIds.length === 0) return new Map();
  const CHUNK = 30;
  const map = new Map();
  for (let i = 0; i < tournamentIds.length; i += CHUNK) {
    const slice = tournamentIds.slice(i, i + CHUNK);
    const snap = await db.collection(COL_TOURNAMENTS).where('__name__', 'in', slice).get();
    snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
  }
  return map;
}

/* --------------------- Public API --------------------- */

/** Pipeline principal: recalcula e MATERIALIZA o ranking interno do clube. */
async function recomputeClubInternalRankings(db, clubId) {
  if (!clubId) throw new Error('clubId obrigatório');
  // eslint-disable-next-line global-require
  const logger = require('firebase-functions/logger');
  logger.info(`recomputeClubInternalRankings START: clubId=${clubId}`);

  // 1) Carrega fontes
  const [members, profileDocs, events] = await Promise.all([
    loadClubMembers(db, clubId),
    loadClubAthletesFromProfiles(db, clubId),
    loadClubEvents(db, clubId),
  ]);
  const clubUids = new Set();
  members.forEach((m) => { if (m && m.user_id) clubUids.add(m.user_id); });
  profileDocs.forEach((p) => { if (p && p.id) clubUids.add(p.id); });
  logger.info(`recomputeClubInternalRankings STEP 1: members=${members.length}, profiles=${profileDocs.length}, events=${events.length}, clubUids=${clubUids.size}`);

  // 2) Jogos do clube + mapa de event_participants (necessário para
  //    resolver o schema legado do `GameDayOrganizer`, que salva `id`
  //    = doc_id de event_participant, não user_id).
  const [ownClubGamesRaw, ownClubEventGamesRaw, extClubEventGames, tournamentMatches, participantById] = await Promise.all([
    loadClubEventGames(db, events),
    loadClubOwnClubEventGames(db, clubId),
    loadExternalClubEventGames(db, clubUids),
    loadExternalTournamentMatches(db, clubUids),
    loadEventParticipantsMap(db, events),
  ]);
  logger.info(`recomputeClubInternalRankings STEP 2: ownClubGames=${ownClubGamesRaw.length}, ownClubEventGames=${ownClubEventGamesRaw.length}, extGames=${extClubEventGames.length}, tournaments=${tournamentMatches.length}, participants=${participantById.size}`);

  // 3) Para `tournament_matches`, precisamos resolver registration → uids
  //    e descobrir o club_id do torneio (para diferenciar "do clube" de "externo").
  const regIds = new Set();
  const tournamentClubIdById = new Map();
  tournamentMatches.forEach((m) => {
    (m.side_a_ids || []).forEach((rid) => regIds.add(rid));
    (m.side_b_ids || []).forEach((rid) => regIds.add(rid));
    if (m.tournament_id) tournamentClubIdById.set(m.tournament_id, m.tournament_id);
  });
  const [regById, tournamentById] = await Promise.all([
    loadTournamentRegistrations(db, Array.from(regIds)),
    loadTournaments(db, Array.from(tournamentClubIdById.keys())),
  ]);

  // 4) Normaliza todos os jogos
  const profileById = new Map(profileDocs.map((p) => [p.id, p]));
  const allMatches = [];
  ownClubGamesRaw.forEach((g) => {
    // `participantById` resolve o schema legado do GameDayOrganizer.
    const n = normalizeClubGame(g, participantById);
    if (n) n.is_club = true, n.club_id = clubId, allMatches.push(n);
  });
  ownClubEventGamesRaw.forEach((g) => {
    const n = normalizeClubEventGame(g);
    if (n) n.is_club = true, n.club_id = g.club_id, allMatches.push(n);
  });
  extClubEventGames.forEach((g) => {
    const n = normalizeClubEventGame(g);
    if (n) n.is_club = false, n.club_id = g.club_id, allMatches.push(n);
  });
  tournamentMatches.forEach((g) => {
    // Enriquece o match com o club_id do torneio (se houver) ANTES de normalizar.
    const t = g.tournament_id ? tournamentById.get(g.tournament_id) : null;
    const enriched = { ...g, tournament_club_id: t ? t.club_id || null : null };
    const n = normalizeTournamentMatch(enriched, regById);
    if (!n) return;
    // Regra: o match é "do clube" quando o torneio pertence a este clube
    // (torneios privados do clube contam no interno mesmo se jogados por
    // um atleta do clube contra um externo). Caso contrário é externo.
    const isClubTournament = !!(t && t.club_id === clubId);
    n.is_club = isClubTournament;
    n.club_id = isClubTournament ? clubId : null;
    allMatches.push(n);
  });

  // 5) Separa em "interno" (só do clube) e "ext" (interno + externo)
  const internal = allMatches.filter((m) => m.is_club === true);
  const ext = allMatches;

  // 6) Calcula os 2 rankings × 2 escopos (individual e duplas)
  const out = {};
  for (const [scope, matches] of [['internal', internal], ['ext', ext]]) {
    const ib = new Map();
    const db_ = new Map();
    matches.forEach((m) => {
      applyToIndividual(ib, m);
      applyToDoubles(db_, m);
    });
    enrichWithProfiles(ib, db_, profileById);
    out[`individual_${scope}`] = sortIndividual(ib);
    out[`doubles_${scope}`] = sortDoubles(db_);
  }
  logger.info(`recomputeClubInternalRankings STEP 6: matches_internal=${internal.length}, matches_ext=${ext.length}, athletes_internal=${out.individual_internal.length}, athletes_ext=${out.individual_ext.length}`);

  // 7) Materializa nas 4 coleções
  await writeClubInternalRankings(db, clubId, {
    individual_internal: out.individual_internal,
    doubles_internal: out.doubles_internal,
    individual_ext: out.individual_ext,
    doubles_ext: out.doubles_ext,
  });

  return {
    clubId,
    counts: {
      members: members.length,
      athletesFromProfiles: profileDocs.length,
      ownClubGames: ownClubGamesRaw.length,
      ownClubEventGames: ownClubEventGamesRaw.length,
      externalClubEventGames: extClubEventGames.length,
      externalTournamentMatches: tournamentMatches.length,
    },
    internal: {
      individual: out.individual_internal.length,
      doubles: out.doubles_internal.length,
    },
    ext: {
      individual: out.individual_ext.length,
      doubles: out.doubles_ext.length,
    },
  };
}

/** Escreve os 4 rankings nas coleções materializadas (substitui o anterior). */
async function writeClubInternalRankings(db, clubId, rankings) {
  const now = new Date();

  // Lê os documentos existentes para saber o que apagar (cobre o caso
  // de o conjunto de atletas mudar — atleta que saiu não pode ficar
  // materializado).
  const existingInternal = await db.collection(RANKINGS_INTERNAL).where('club_id', '==', clubId).get();
  const existingExt = await db.collection(RANKINGS_EXT).where('club_id', '==', clubId).get();
  const existingDoublesInternal = await db.collection(RANKINGS_DOUBLES_INTERNAL).where('club_id', '==', clubId).get();
  const existingDoublesExt = await db.collection(RANKINGS_DOUBLES_EXT).where('club_id', '==', clubId).get();

  const ops = [];
  // Limpa
  existingInternal.docs.forEach((d) => ops.push({ type: 'delete', ref: d.ref }));
  existingExt.docs.forEach((d) => ops.push({ type: 'delete', ref: d.ref }));
  existingDoublesInternal.docs.forEach((d) => ops.push({ type: 'delete', ref: d.ref }));
  existingDoublesExt.docs.forEach((d) => ops.push({ type: 'delete', ref: d.ref }));

  // Individual
  (rankings.individual_internal || []).forEach((row) => {
    const ref = db.collection(RANKINGS_INTERNAL).doc(ratingId(clubId, row.user_id || row.id));
    ops.push({
      type: 'set',
      ref,
      data: {
        id: ref.id,
        club_id: clubId,
        user_id: row.user_id || row.id,
        display_name: row.display_name || null,
        photo_url: row.photo_url || null,
        games: row.games || 0,
        wins: row.wins || 0,
        losses: row.losses || 0,
        points_for: row.points_for || 0,
        points_against: row.points_against || 0,
        points_balance: row.points_balance || 0,
        win_rate: row.win_rate || 0,
        scope: 'internal',
        updated_at: now,
      },
    });
  });
  (rankings.individual_ext || []).forEach((row) => {
    const ref = db.collection(RANKINGS_EXT).doc(ratingExtId(clubId, row.user_id || row.id));
    ops.push({
      type: 'set',
      ref,
      data: {
        id: ref.id,
        club_id: clubId,
        user_id: row.user_id || row.id,
        display_name: row.display_name || null,
        photo_url: row.photo_url || null,
        games: row.games || 0,
        wins: row.wins || 0,
        losses: row.losses || 0,
        points_for: row.points_for || 0,
        points_against: row.points_against || 0,
        points_balance: row.points_balance || 0,
        win_rate: row.win_rate || 0,
        scope: 'ext',
        updated_at: now,
      },
    });
  });

  // Doubles
  (rankings.doubles_internal || []).forEach((row) => {
    const ref = db.collection(RANKINGS_DOUBLES_INTERNAL).doc(doublesId(clubId, row.pair_key));
    ops.push({
      type: 'set',
      ref,
      data: {
        id: ref.id,
        club_id: clubId,
        pair_key: row.pair_key,
        player_ids: row.player_ids || [],
        display_names: row.display_names || [],
        photos: row.photos || [],
        games: row.games || 0,
        wins: row.wins || 0,
        losses: row.losses || 0,
        points_for: row.points_for || 0,
        points_against: row.points_against || 0,
        points_balance: row.points_balance || 0,
        win_rate: row.win_rate || 0,
        scope: 'internal',
        updated_at: now,
      },
    });
  });
  (rankings.doubles_ext || []).forEach((row) => {
    const ref = db.collection(RANKINGS_DOUBLES_EXT).doc(doublesId(clubId, row.pair_key));
    ops.push({
      type: 'set',
      ref,
      data: {
        id: ref.id,
        club_id: clubId,
        pair_key: row.pair_key,
        player_ids: row.player_ids || [],
        display_names: row.display_names || [],
        photos: row.photos || [],
        games: row.games || 0,
        wins: row.wins || 0,
        losses: row.losses || 0,
        points_for: row.points_for || 0,
        points_against: row.points_against || 0,
        points_balance: row.points_balance || 0,
        win_rate: row.win_rate || 0,
        scope: 'ext',
        updated_at: now,
      },
    });
  });

  // Aplica em chunks
  for (let i = 0; i < ops.length; i += SAFE_BATCH_WRITE_SIZE) {
    const batch = db.batch();
    ops.slice(i, i + SAFE_BATCH_WRITE_SIZE).forEach((op) => {
      if (op.type === 'delete') batch.delete(op.ref);
      else batch.set(op.ref, op.data);
    });
    await batch.commit();
  }
}

module.exports = {
  recomputeClubInternalRankings,
  writeClubInternalRankings,
  // exposed for tests
  __test: {
    pairKey,
    normalizeClubGame,
    normalizeClubEventGame,
    normalizeTournamentMatch,
    sideToUids,
    applyToIndividual,
    applyToDoubles,
    filterMatchesForClub,
    sortIndividual,
    sortDoubles,
    enrichWithProfiles,
  },
};
