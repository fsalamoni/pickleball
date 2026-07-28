/**
 * Hook para o ranking interno do clube (Wave C.3) — APENAS LEITURA
 * do materializado. O cálculo é feito pelo Cloud Function
 * `recomputeClubInternalRankings` em
 * `functions/clubRanking.js`, que escreve em:
 *
 *  - `club_internal_ratings/{clubId_userId}`            (escopo só clube)
 *  - `club_internal_ratings_ext/{clubId_userId}`       (com fontes externas)
 *  - `club_internal_doubles_ratings/{clubId_pairKey}`  (duplas, escopo clube)
 *  - `club_internal_doubles_ratings_ext/{clubId_pairKey}` (duplas, com externos)
 *
 * O frontend:
 *  1. Decide qual coleção ler com base em `includeExternal`.
 *  2. Faz queries diretas no Firestore (`orderBy(wins, desc)`).
 *  3. Resolve nomes/fotos dos atletas que faltarem (defensivo).
 *
 * Sem cálculo client-side. Toggle = trocar a coleção lida.
 */

import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { useAuth } from '@/core/lib/FirebaseAuthContext';

const COL_INDIVIDUAL_INTERNAL = 'club_internal_ratings';
const COL_INDIVIDUAL_EXT = 'club_internal_ratings_ext';
const COL_DOUBLES_INTERNAL = 'club_internal_doubles_ratings';
const COL_DOUBLES_EXT = 'club_internal_doubles_ratings_ext';
const COL_ATHLETE_PROFILES = 'athlete_profiles';
const COL_CLUB_MEMBERS = 'club_members';

/** Carrega o mapa uid → profile (display_name, photo_url) para fallback. */
async function loadAthleteProfiles(neededUids) {
  if (!neededUids || neededUids.length === 0) return new Map();
  const map = new Map();
  const CHUNK = 30;
  for (let i = 0; i < neededUids.length; i += CHUNK) {
    const slice = neededUids.slice(i, i + CHUNK);
    const snap = await getDocs(query(collection(db, COL_ATHLETE_PROFILES), where('__name__', 'in', slice)));
    snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
  }
  return map;
}

/** Carrega os uids de TODOS os atletas do clube (membros + perfis com club_ids). */
async function loadClubUids(clubId) {
  const set = new Set();
  // 1) Membros
  try {
    const memSnap = await getDocs(query(collection(db, COL_CLUB_MEMBERS), where('club_id', '==', clubId)));
    memSnap.docs.forEach((d) => {
      const uid = d.data().user_id;
      if (uid) set.add(uid);
    });
  } catch (err) {
    // silencioso
  }
  // 2) Perfis que declaram o clube em club_ids
  try {
    const profSnap = await getDocs(query(collection(db, COL_ATHLETE_PROFILES), where('club_ids', 'array-contains', clubId)));
    profSnap.docs.forEach((d) => set.add(d.id));
  } catch (err) {
    // silencioso
  }
  return Array.from(set);
}

function enrichIndividual(row, profileById) {
  const profile = profileById.get(row.user_id);
  return {
    id: row.user_id,
    name: row.display_name || profile?.platform_name || profile?.full_name || row.user_id,
    photo_url: row.photo_url || profile?.photo_url || null,
    games: row.games || 0,
    wins: row.wins || 0,
    losses: row.losses || 0,
    points_for: row.points_for || 0,
    points_against: row.points_against || 0,
    points_balance: row.points_balance || 0,
    win_rate: row.win_rate || 0,
    updated_at: row.updated_at || null,
  };
}

function enrichDoubles(row, profileById) {
  const player_ids = row.player_ids || [];
  const enrichedIds = player_ids.map((uid) => {
    const profile = profileById.get(uid);
    return {
      id: uid,
      name: row.display_names?.[player_ids.indexOf(uid)]
        || profile?.platform_name
        || profile?.full_name
        || uid,
      photo_url: row.photos?.[player_ids.indexOf(uid)] || profile?.photo_url || null,
    };
  });
  return {
    pair_key: row.pair_key,
    player_ids,
    members: enrichedIds,
    games: row.games || 0,
    wins: row.wins || 0,
    losses: row.losses || 0,
    points_for: row.points_for || 0,
    points_against: row.points_against || 0,
    points_balance: row.points_balance || 0,
    win_rate: row.win_rate || 0,
    updated_at: row.updated_at || null,
  };
}

/**
 * @param {string} clubId
 * @param {{ includeExternal?: boolean }} [options]
 */
export function useClubInternalRanking(clubId, options = {}) {
  const { includeExternal = false } = options;
  const { user } = useAuth();
  return useQuery({
    queryKey: ['club-internal-ranking', clubId, includeExternal, user?.uid],
    queryFn: async () => {
      const colIndividual = includeExternal ? COL_INDIVIDUAL_EXT : COL_INDIVIDUAL_INTERNAL;
      const colDoubles = includeExternal ? COL_DOUBLES_EXT : COL_DOUBLES_INTERNAL;

      const [individualSnap, doublesSnap, clubUids] = await Promise.all([
        getDocs(query(collection(db, colIndividual), where('club_id', '==', clubId), orderBy('wins', 'desc'))),
        getDocs(query(collection(db, colDoubles), where('club_id', '==', clubId), orderBy('wins', 'desc'))),
        loadClubUids(clubId),
      ]);

      const rawIndividual = individualSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const rawDoubles = doublesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Coleta uids que faltam display_name/photo (defensivo).
      const missingIndividual = rawIndividual
        .filter((r) => !r.display_name || !r.photo_url)
        .map((r) => r.user_id);
      const missingDoubles = rawDoubles
        .flatMap((r) => (r.player_ids || []).filter((uid) => {
          const names = r.display_names || [];
          return !names.includes(uid); // heurística: missing
        }));

      const profileById = await loadAthleteProfiles(
        Array.from(new Set([...missingIndividual, ...missingDoubles])).filter(Boolean),
      );

      const individual = rawIndividual.map((r) => enrichIndividual(r, profileById));
      const doubles = rawDoubles.map((r) => enrichDoubles(r, profileById));

      // Resumo a partir do que está materializado
      const totals = { club: 0, external: 0, doubles: 0, singles: 0 };
      individual.forEach((r) => { totals.singles += 1; totals.club += r.games; });
      doubles.forEach((r) => { totals.doubles += 1; });
      totals.external = includeExternal ? 0 : 0;

      return {
        sources: totals,
        // Wave C.4: clubUids agora reflete os atletas REAIS do clube
        // (membros + perfis), não apenas os do materializado. Isso
        // mostra "16 atletas do clube" mesmo quando o materializado
        // ainda está vazio.
        clubUids,
        totalClubMembers: clubUids.length,
        individual,
        doubles,
        includeExternal,
      };
    },
    enabled: !!clubId,
    staleTime: 30_000, // refresh mais agressivo: rankings podem ter sido atualizados
  });
}
