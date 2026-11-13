/**
 * trophyService — busca o que a coleção de troféus precisa. Nada é gravado.
 *
 * Torneio e liga têm troféu (dia de jogo não tem medalha — docs/43 §1). A lista
 * que falhar chega como `undefined` e a estante diz o que ficou de fora —
 * nunca "nenhum troféu" por uma queda de rede (docs/27-FALHA-NAO-E-VAZIO.md).
 */
import { getAthlete } from '@/modules/athletes/services/athleteService.js';
import { listMyRegistrations, listRegistrations } from '@/modules/tournament/services/registrationService.js';
import { getTournament } from '@/modules/tournament/services/tournamentService.js';
import { getModality } from '@/modules/tournament/services/modalityService.js';
import { listAllMatchesForModality } from '@/modules/tournament/services/matchService.js';
import { TOURNAMENT_STATUS } from '@/modules/tournament/domain/constants.js';
import { listLeaguePodiumSourcesOf } from '@/modules/leagues/services/leagueService.js';
import { leagueTrophies, tournamentTrophies } from '../domain/trophies.js';

const uniq = (xs) => Array.from(new Set(xs.filter(Boolean)));

/** Os troféus de TORNEIO (lança se a leitura falhar). */
export async function listTournamentTrophies(uid) {
  const registrations = await listMyRegistrations(uid);
  if (registrations.length === 0) return [];
  const tournaments = await Promise.all(uniq(registrations.map((r) => r.tournament_id)).map((id) => getTournament(id)
    // Rascunho ou arquivado de outra pessoa: a regra recusa, e ele não tem troféu.
    // Queda de rede segue derrubando a estante (falha não é vazio).
    .catch((e) => { if (e?.code === 'permission-denied') return null; throw e; })));
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

/**
 * A coleção inteira. A lista que falhou chega `undefined` (a estante diz).
 * @returns {Promise<{ torneios?: object[], ligas?: object[], perfil: object|null }>}
 */
export async function listMyTrophies(uid) {
  if (!uid) return { torneios: [], ligas: [], perfil: null };
  const [perfil, tr, lg] = await Promise.allSettled([
    getAthlete(uid),
    listTournamentTrophies(uid),
    listLeaguePodiumSourcesOf(uid).then((fontes) => leagueTrophies(uid, fontes)),
  ]);
  return {
    torneios: tr.status === 'fulfilled' ? tr.value : undefined,
    ligas: lg.status === 'fulfilled' ? lg.value : undefined,
    perfil: perfil.status === 'fulfilled' ? perfil.value : null,
  };
}
