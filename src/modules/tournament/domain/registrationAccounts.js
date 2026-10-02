/**
 * Quem, numa inscrição de torneio, NÃO tem conta na plataforma — e por isso
 * tira do ranking as partidas da inscrição. Puro.
 *
 * ## Por que isto importa tanto
 *
 * A partida de torneio guarda ids de INSCRIÇÃO; o ranking descobre de quem é
 * o resultado pelo `player_a_user_id`/`player_b_user_id`. Se UM jogador da
 * partida não tem conta, a partida inteira fica fora do ranking — para os
 * outros três também (`resolveSideUids` em `functions/ranking.js`, espelhado
 * aqui). Era a causa nº 1 de "lancei vários jogos e o atleta não aparece":
 * a dupla inscrita digitando o nome do parceiro em vez de escolhê-lo na lista.
 *
 * ⚠️ A regra de "jogador obrigatório" é a MESMA do servidor: em duplas
 * (`format === 'doubles'`) os dois; senão, só o jogador A. Mudar uma sem a
 * outra faria a tela prometer o que o ranking não faz.
 */

const DOUBLES = 'doubles';

/**
 * @param {object|null|undefined} registration
 * @returns {Array<'a'|'b'>} os lados (A/B) sem conta; `[]` quando a inscrição pontua
 *   (ou quando não se aplica: equipe, vaga fictícia, inscrição inexistente).
 */
export function registrationSlotsWithoutAccount(registration) {
  if (!registration) return [];
  // Equipe pontua pelas etapas espelhadas com os uids de cada atleta; vaga
  // fictícia (`is_placeholder`) é preenchida depois — não há conta a pedir.
  if (registration.kind === 'team' || registration.is_placeholder) return [];
  const faltam = [];
  if (!registration.player_a_user_id) faltam.push('a');
  if (registration.format === DOUBLES && !registration.player_b_user_id) faltam.push('b');
  return faltam;
}

/**
 * A inscrição tem todos os jogadores com conta? (as partidas dela podem contar)
 * @param {object} registration
 */
export function registrationCountsForRanking(registration) {
  if (!registration || registration.kind === 'team' || registration.is_placeholder) return false;
  return registrationSlotsWithoutAccount(registration).length === 0;
}
