/**
 * Histórico de participações do usuário em torneios.
 *
 * Faz a busca dos dados (inscrições, torneios, modalidades e rankings) e delega
 * a agregação à função pura `buildParticipationHistory` (domain/participation).
 */

import { listMyRegistrations } from './registrationService.js';
import { getTournament } from './tournamentService.js';
import { getModality } from './modalityService.js';
import { computeModalityRanking } from './rankingService.js';
import { buildParticipationHistory } from '../domain/participation.js';

function uniq(list) {
  return Array.from(new Set(list.filter(Boolean)));
}

/**
 * Monta o histórico de participações de um usuário (agrupado por torneio).
 * @param {string} userId
 * @returns {Promise<Array<object>>}
 */
export async function getMyTournamentHistory(userId) {
  if (!userId) return [];
  const registrations = await listMyRegistrations(userId);
  if (registrations.length === 0) return [];

  const tournamentIds = uniq(registrations.map((r) => r.tournament_id));
  const modalityIds = uniq(registrations.map((r) => r.modality_id));

  const [tournaments, modalities, rankingPairs] = await Promise.all([
    Promise.all(tournamentIds.map((id) => getTournament(id).catch(() => null))),
    Promise.all(modalityIds.map((id) => getModality(id).catch(() => null))),
    Promise.all(
      modalityIds.map(async (id) => {
        try {
          return [id, await computeModalityRanking(id)];
        } catch {
          return [id, []];
        }
      }),
    ),
  ]);

  return buildParticipationHistory(registrations, {
    userId,
    tournamentById: new Map(tournaments.filter(Boolean).map((t) => [t.id, t])),
    modalityById: new Map(modalities.filter(Boolean).map((m) => [m.id, m])),
    rankingByModality: new Map(rankingPairs),
  });
}
