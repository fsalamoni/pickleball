/**
 * Elegibilidade de torneios para o ranking nacional (lógica pura, sem I/O).
 *
 * ## A regra
 *
 * Conta para o ranking o torneio **público**, **não arquivado** e que já
 * **saiu do rascunho** sem ter sido **cancelado**. Ou seja: assim que um
 * resultado é lançado, ele vale.
 *
 * ## Por que NÃO é "só depois de encerrado"
 *
 * Era assim, e atrasava a plataforma inteira: num torneio de três dias, nada
 * do que acontecia em quadra aparecia no rating até o organizador clicar em
 * "encerrar" — às vezes dias depois, às vezes nunca. O atleta jogava, ganhava
 * e o ranking não se mexia; o organizador não tinha como saber que faltava um
 * passo, porque lançar o resultado já parecia o passo final.
 *
 * Em torneio o lançamento **não é facultativo**: o resultado é lançado porque
 * a partida aconteceu. Diferente do dia de jogo, onde publicar no ranking é
 * uma DECISÃO de quem organiza (por isso lá o gatilho é a publicação, não o
 * lançamento do placar).
 *
 * ## O que continua de fora, e por quê
 *
 * - **Rascunho**: torneio sendo montado é ambiente de teste; sorteio de
 *   ensaio não pode mexer no rating de ninguém.
 * - **Cancelado**: o que não aconteceu não conta — e cancelar TIRA do ranking
 *   o que porventura já tenha contado, porque o recálculo é sempre integral.
 * - **Privado**: torneio fechado não alimenta ranking público.
 * - **Arquivado**: saiu de circulação.
 *
 * Torneios apagados deixam de existir na base, portanto seus resultados somem
 * do ranking no recálculo seguinte automaticamente.
 *
 * ⚠️ **Esta regra existe DUAS vezes**: aqui (cliente) e em
 * `functions/ranking.js` (`isEligible`), porque o pacote de Cloud Functions é
 * publicado isolado. Mudar um lado só faz o servidor e a tela discordarem
 * sobre quem está no ranking — há teste de paridade travando as duas.
 */

import { TOURNAMENT_STATUS, TOURNAMENT_VISIBILITY } from './constants.js';

/**
 * Status em que um resultado lançado JÁ conta para o ranking.
 * É o complemento de "rascunho" e "cancelado".
 */
export const RANKING_ELIGIBLE_STATUSES = Object.freeze([
  TOURNAMENT_STATUS.REGISTRATIONS_OPEN,
  TOURNAMENT_STATUS.REGISTRATIONS_CLOSED,
  TOURNAMENT_STATUS.IN_PROGRESS,
  TOURNAMENT_STATUS.FINISHED,
]);

/**
 * @param {object} tournament
 * @returns {boolean}
 */
export function isTournamentRankingEligible(tournament) {
  if (!tournament) return false;
  return tournament.visibility === TOURNAMENT_VISIBILITY.PUBLIC
    && RANKING_ELIGIBLE_STATUSES.includes(tournament.status)
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
