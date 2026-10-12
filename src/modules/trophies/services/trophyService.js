/**
 * trophyService — busca o que a coleção de troféus precisa. Nada é gravado.
 *
 * Duas fontes INDEPENDENTES (`Promise.allSettled`): a que falhar chega como
 * `undefined` e a estante diz o que ficou de fora — nunca "nenhum troféu"
 * por uma queda de rede (docs/27-FALHA-NAO-E-VAZIO.md).
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { getAthlete } from '@/modules/athletes/services/athleteService.js';
import { listMyRegistrations, listRegistrations } from '@/modules/tournament/services/registrationService.js';
import { getTournament } from '@/modules/tournament/services/tournamentService.js';
import { getModality } from '@/modules/tournament/services/modalityService.js';
import { listAllMatchesForModality } from '@/modules/tournament/services/matchService.js';
import { TOURNAMENT_STATUS } from '@/modules/tournament/domain/constants.js';
import { gameDayTrophies, tournamentTrophies } from '../domain/trophies.js';

const COL_RANKING = 'club_event_games';
const uniq = (xs) => Array.from(new Set(xs.filter(Boolean)));

/** Os troféus de TORNEIO (lança se a leitura falhar). */
export async function listTournamentTrophies(uid) {
  const registrations = await listMyRegistrations(uid);
  if (registrations.length === 0) return [];
  const tournaments = await Promise.all(uniq(registrations.map((r) => r.tournament_id)).map((id) => getTournament(id)));
  const tournamentById = new Map(tournaments.filter(Boolean).map((t) => [t.id, t]));
  // Só categoria de torneio ENCERRADO pode ter troféu: as outras nem são lidas.
  const encerrados = registrations.filter((r) => tournamentById.get(r.tournament_id)?.status === TOURNAMENT_STATUS.FINISHED);
  const modalityIds = uniq(encerrados.map((r) => r.modality_id));
  const [modalities, matches, regs] = await Promise.all([
    Promise.all(modalityIds.map((id) => getModality(id))),
    Promise.all(modalityIds.map((id) => listAllMatchesForModality(id))),
    Promise.all(modalityIds.map((id) => listRegistrations(id))),
  ]);
  return tournamentTrophies(uid, {
    registrations: encerrados,
    tournamentById,
    modalityById: new Map(modalities.filter(Boolean).map((m) => [m.id, m])),
    matchesByModality: new Map(modalityIds.map((id, i) => [id, matches[i] || []])),
    registrationsByModality: new Map(modalityIds.map((id, i) => [id, regs[i] || []])),
  });
}

/** Os troféus de DIA DE JOGO: os dias publicados em que jogou, com TODOS os jogos de cada dia. */
export async function listGameDayTrophies(uid, nome = 'Atleta') {
  if (!db) return [];
  const [a, b] = await Promise.all([
    getDocs(query(collection(db, COL_RANKING), where('side_a_ids', 'array-contains', uid))),
    getDocs(query(collection(db, COL_RANKING), where('side_b_ids', 'array-contains', uid))),
  ]);
  const eventIds = uniq([...a.docs, ...b.docs].map((d) => d.data().event_id));
  if (eventIds.length === 0) return [];
  const porEvento = new Map();
  await Promise.all(eventIds.map(async (eventId) => {
    const snap = await getDocs(query(collection(db, COL_RANKING), where('event_id', '==', eventId)));
    porEvento.set(eventId, snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }));
  return gameDayTrophies(uid, porEvento, new Map([[uid, nome]]));
}

/**
 * A coleção inteira. Cada fonte falha sozinha.
 * @returns {Promise<{ torneios?: object[], diasDeJogo?: object[], perfil: object|null }>}
 */
export async function listMyTrophies(uid) {
  if (!uid) return { torneios: [], diasDeJogo: [], perfil: null };
  const perfil = await getAthlete(uid).catch(() => null);
  const nome = perfil?.platform_name || perfil?.full_name || 'Atleta';
  const [t, g] = await Promise.allSettled([listTournamentTrophies(uid), listGameDayTrophies(uid, nome)]);
  if (t.status === 'rejected' && g.status === 'rejected') throw t.reason;
  const foto = perfil?.photo_url || null;
  const diasDeJogo = g.status === 'fulfilled'
    ? g.value.map((x) => ({ ...x, people: x.people.map((p) => (p.user_id === uid ? { ...p, photo_url: foto } : p)) }))
    : undefined;
  return { torneios: t.status === 'fulfilled' ? t.value : undefined, diasDeJogo, perfil };
}
