/**
 * Assinatura das entradas do ranking (lógica pura, sem I/O).
 *
 * Serve para detectar, de forma barata, se algo mudou desde o último recálculo
 * automático: como o ranking oficial só considera torneios públicos e
 * encerrados, qualquer encerramento, exclusão, arquivamento ou edição de um
 * torneio elegível altera a assinatura — disparando um novo recálculo.
 *
 * A assinatura combina, por torneio elegível, o id e os marcos de tempo
 * (`updated_at`, `auto_closed_at`), em ordem estável.
 */

import { isTournamentRankingEligible } from '@/modules/tournament/domain/rankingEligibility';
import { toMillis } from '@/modules/tournament/domain/participation';

/**
 * @param {Array<object>} tournaments
 * @returns {string}
 */
export function computeRatingSignature(tournaments = []) {
  return (tournaments || [])
    .filter(isTournamentRankingEligible)
    .map((t) => `${t.id}:${toMillis(t.updated_at) || 0}:${toMillis(t.auto_closed_at) || 0}`)
    .sort()
    .join('|');
}
