/**
 * Service de fontes para o ranking interno do clube (Wave C.2).
 * Coleciona (read-only) os jogos em que atletas do clube participaram:
 *
 *  1. **Jogos do próprio clube** — `club_events/{id}/dates/{dateId}/.../games`
 *     para todos os eventos do clube.
 *  2. **`club_event_games` publicados em outros clubes** (Wave C) — jogos
 *     decididos de dias de jogo de outros clubes onde um atleta do clube
 *     participou.
 *  3. **`tournament_matches`** — jogos de torneios da plataforma onde um
 *     atleta do clube participou.
 *
 * Devolve as listas materializadas (fonte A/B/C) para o domínio puro
 * `clubRankingSources.normalizeAllSources` + `filterMatchesForClub`
 * consolidarem.
 *
 * Sem recálculo. Sem gravação. Idempotente.
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
import { logger } from '@/core/lib/logger';
import { listClubMembers } from './clubService';
import { listAllAthleteProfiles } from '@/modules/athletes/services/athleteService';

/** IDs (uids) de todos os atletas que atualmente são membros do clube. */
async function listClubMemberUids(clubId) {
  const members = await listClubMembers(clubId);
  return members.map((m) => m.user_id).filter(Boolean);
}

/** IDs (uids) de todos os atletas do diretório que têm o clube em `club_ids`. */
async function listClubAthleteUidsFromProfiles(clubId) {
  try {
    const profiles = await listAllAthleteProfiles();
    return profiles
      .filter((p) => Array.isArray(p.club_ids) && p.club_ids.includes(clubId))
      .map((p) => p.id)
      .filter(Boolean);
  } catch (err) {
    logger.error('listClubAthleteUidsFromProfiles falhou:', err);
    return [];
  }
}

/** União de membros + atletas que declaram o clube no perfil. */
export async function listClubAthleteUids(clubId) {
  if (!clubId) return [];
  const [members, declared] = await Promise.all([
    listClubMemberUids(clubId),
    listClubAthleteUidsFromProfiles(clubId),
  ]);
  return Array.from(new Set([...members, ...declared]));
}

/** Lista os eventos do clube (reusa o serviço existente). */
async function listClubEventIds(clubId) {
  try {
    const { listClubEvents } = await import('./clubService');
    const events = await listClubEvents(clubId, null).catch(() => []);
    return (events || []).map((e) => e.id).filter(Boolean);
  } catch (err) {
    logger.error('listClubEventIds falhou:', err);
    return [];
  }
}

/**
 * Carrega os jogos do próprio clube (subcoleção games de cada evento).
 * Formato original do `gameDayOrganizer` (side_a/side_b como objetos).
 */
async function fetchClubGames(clubId) {
  const eventIds = await listClubEventIds(clubId);
  const all = [];
  for (const evId of eventIds) {
    try {
      const snap = await getDocs(collection(db, 'club_events', evId, 'games'));
      snap.docs.forEach((d) => {
        all.push({ id: d.id, ...d.data() });
      });
    } catch (err) {
      logger.error(`fetchClubGames falhou para evento ${evId}:`, err);
    }
  }
  return all;
}

/**
 * Carrega todos os `club_event_games` (Wave C) onde o clube é o dono.
 * Usado para alimentar o ranking **do próprio clube** — sem precisar
 * buscar em outros clubes (essa parte é feita via `tournament_matches`
 * + `club_event_games` filtrado pelos uids do clube).
 */
async function fetchClubEventGamesForClub(clubId) {
  if (!db || !clubId) return [];
  try {
    const snap = await getDocs(
      query(collection(db, 'club_event_games'), where('club_id', '==', clubId)),
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    logger.error('fetchClubEventGamesForClub falhou:', err);
    return [];
  }
}

/**
 * Carrega todos os `club_event_games` (Wave C) onde os uids do clube
 * aparecem. Para o ranking "incluir externos".
 */
async function fetchExternalClubEventGames(clubUids) {
  if (!db || !clubUids || clubUids.length === 0) return [];
  try {
    // Firestore `in` suporta até 30 uids por consulta; particionamos se
    // preciso.
    const CHUNK = 30;
    const all = [];
    for (let i = 0; i < clubUids.length; i += CHUNK) {
      const slice = clubUids.slice(i, i + CHUNK);
      // Não há índice composto para uids em array, então fazemos 2
      // consultas (side_a_ids + side_b_ids) por chunk e deduplicamos
      // depois.
      const seen = new Set();
      const merge = (snap) => snap.docs.forEach((d) => {
        if (seen.has(d.id)) return;
        seen.add(d.id);
        all.push({ id: d.id, ...d.data() });
      });
      const [a, b] = await Promise.all([
        getDocs(query(collection(db, 'club_event_games'), where('side_a_ids', 'array-contains-any', slice))),
        getDocs(query(collection(db, 'club_event_games'), where('side_b_ids', 'array-contains-any', slice))),
      ]);
      merge(a);
      merge(b);
    }
    return all;
  } catch (err) {
    logger.error('fetchExternalClubEventGames falhou:', err);
    return [];
  }
}

/**
 * Carrega todos os `tournament_matches` finalizados onde os uids do
 * clube aparecem. Mesma estratégia de particionamento (até 30 uids
 * por consulta `in`/`array-contains-any`).
 */
async function fetchExternalTournamentMatches(clubUids) {
  if (!db || !clubUids || clubUids.length === 0) return [];
  try {
    const FINISHED = ['finished', 'walkover'];
    const CHUNK = 30;
    const all = [];
    const seen = new Set();
    for (let i = 0; i < clubUids.length; i += CHUNK) {
      const slice = clubUids.slice(i, i + CHUNK);
      const [a, b] = await Promise.all([
        getDocs(query(
          collection(db, 'tournament_matches'),
          where('status', 'in', FINISHED),
          where('side_a_ids', 'array-contains-any', slice),
        )),
        getDocs(query(
          collection(db, 'tournament_matches'),
          where('status', 'in', FINISHED),
          where('side_b_ids', 'array-contains-any', slice),
        )),
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
  } catch (err) {
    logger.error('fetchExternalTournamentMatches falhou:', err);
    return [];
  }
}

/**
 * Coleta as três fontes de jogos em paralelo.
 *
 * @param {string} clubId
 * @param {object} [opts]
 * @param {boolean} [opts.includeExternal=true] inclui tournament_matches + club_event_games de outros clubes
 * @returns {Promise<{ clubGames: Array, clubEventGames: Array, tournamentMatches: Array, clubUids: string[] }>}
 */
export async function fetchClubInternalRankingSources(clubId, opts = {}) {
  const { includeExternal = true } = opts;
  if (!clubId) {
    return { clubGames: [], clubEventGames: [], tournamentMatches: [], clubUids: [] };
  }
  const clubUids = await listClubAthleteUids(clubId);
  const [clubGames, clubEventGames, extClubEventGames, tournamentMatches] = await Promise.all([
    fetchClubGames(clubId),
    fetchClubEventGamesForClub(clubId),
    includeExternal ? fetchExternalClubEventGames(clubUids) : Promise.resolve([]),
    includeExternal ? fetchExternalTournamentMatches(clubUids) : Promise.resolve([]),
  ]);
  // Para a fonte "club_event_games" do clube, mantemos só os do próprio
  // clube; os de outros clubes vão em tournamentMatches+clubEventGames
  // externos.
  return {
    clubGames,
    clubEventGames,
    // Externos: club_event_games (outros clubes) + tournament_matches.
    tournamentMatches: [...extClubEventGames, ...tournamentMatches],
    clubUids,
  };
}

/** Versão exposta para testes. */
export const __test = {
  listClubMemberUids,
  listClubAthleteUidsFromProfiles,
  fetchClubGames,
  fetchClubEventGamesForClub,
  fetchExternalClubEventGames,
  fetchExternalTournamentMatches,
};
