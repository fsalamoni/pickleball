/**
 * O sorteio não apaga o que a tela não sabe que existe (lógica pura).
 *
 * ## O defeito
 *
 * `persistMatches` apaga TODOS os jogos da fase antes de gravar os novos — é o
 * que faz "re-sortear" funcionar, e a tela avisa disso no diálogo. Só que o
 * aviso era decidido por `matches.length`, que vem de uma consulta:
 *
 *   a consulta FALHA → `matches = []` → o botão vira "Sortear" em vez de
 *   "Re-sortear", o diálogo diz que vai GERAR e não menciona apagar nada, o
 *   organizador confirma — e o sorteio apaga jogos já DISPUTADOS.
 *
 * Um resultado de torneio destruído por uma queda de rede, sem que ninguém
 * tivesse como perceber. A tela deixou de oferecer comando sobre estado que
 * não conhece; isto aqui é a segunda tranca.
 *
 * ## A regra
 *
 * Só é protegido o jogo com RESULTADO. Re-sortear uma fase que ainda não
 * começou não perde nada, e exigir confirmação ali treinaria a pessoa a clicar
 * em "sim" sem ler — o que faria a confirmação que IMPORTA passar despercebida.
 */

import { MATCH_STATUS } from './constants.js';

/** Um jogo com resultado: disputado ou W.O. */
export function isDecidedMatch(match) {
  return match?.status === MATCH_STATUS.FINISHED || match?.status === MATCH_STATUS.WALKOVER;
}

/**
 * Quantos jogos COM RESULTADO seriam perdidos se a fase fosse sorteada de novo.
 * @param {Array<object>} matches
 * @returns {number}
 */
export function decidedMatchCount(matches = []) {
  return (matches || []).filter(isDecidedMatch).length;
}

/**
 * A operação pode seguir?
 *
 * @param {Array<object>} matches jogos que a fase tem HOJE, lidos do banco
 * @param {{ acknowledged?: boolean }} [options] `acknowledged` só é verdadeiro
 *   quando a TELA sabia que havia jogos e avisou que seriam apagados.
 * @returns {{ allowed: boolean, decided: number, reason: string|null }}
 */
export function canDiscardStageMatches(matches = [], options = {}) {
  const decided = decidedMatchCount(matches);
  if (options.acknowledged === true || decided === 0) {
    return { allowed: true, decided, reason: null };
  }
  return {
    allowed: false,
    decided,
    reason: `Esta fase já tem ${decided} jogo(s) com resultado, e sortear apagaria todos. `
      + 'Recarregue a página para ver o que está lançado antes de decidir — '
      + 'se a intenção é mesmo refazer a fase, o botão passa a ser "Re-sortear".',
  };
}
