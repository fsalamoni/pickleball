/**
 * Elegibilidade de torneios para o ranking nacional (lógica pura, sem I/O).
 *
 * Regra: só contam para o ranking os torneios PÚBLICOS e já ENCERRADOS
 * (concluídos), que ainda existam (não apagados) e não estejam arquivados.
 * Torneios apagados deixam de existir na base, portanto seus resultados somem
 * do ranking no recálculo seguinte automaticamente.
 */

import { TOURNAMENT_STATUS, TOURNAMENT_VISIBILITY } from './constants.js';

/**
 * @param {object} tournament
 * @returns {boolean}
 */
export function isTournamentRankingEligible(tournament) {
  if (!tournament) return false;
  return tournament.visibility === TOURNAMENT_VISIBILITY.PUBLIC
    && tournament.status === TOURNAMENT_STATUS.FINISHED
    && tournament.archived !== true;
}

/**
 * Conjunto de ids de torneios elegíveis para o ranking.
 * @param {Array<object>} tournaments
 * @returns {Set<string>}
 */
export function eligibleTournamentIdsForRanking(tournaments = []) {
  const set = new Set();
  (tournaments || []).forEach((t) => {
    if (isTournamentRankingEligible(t) && t.id) set.add(t.id);
  });
  return set;
}
