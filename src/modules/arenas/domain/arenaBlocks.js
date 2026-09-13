/**
 * Tudo o que ocupa uma quadra, num lugar só.
 *
 * PURO, sem I/O.
 *
 * ## Por que este arquivo existe
 *
 * Quando algo passa a ocupar a quadra, TODA tela que calcula disponibilidade
 * precisa saber. Hoje são cinco: o calendário do atleta, o calendário da
 * arena, o diálogo do dia, o serviço de reserva e o de vagas abertas. Cada
 * fonte nova era mais uma linha de merge em cada um dos cinco — e a que
 * ficasse para trás não dava erro: dava a quadra vendida duas vezes, que só
 * aparece quando duas pessoas chegam para jogar no mesmo horário.
 *
 * Já aconteceu duas vezes. Aqui a composição é uma função só:
 *
 * ```js
 * const bloqueios = mergeArenaBlocks({
 *   gravados,        // arena_unavailabilities (inclui as cópias)
 *   diasDeJogo,      // game_days da arena          → derivado
 *   vagasAbertas,    // arena_open_slots            → derivado
 *   aulas,           // arena_classes               → derivado
 * });
 * ```
 *
 * Fonte nova entra AQUI e chega às cinco telas de uma vez.
 *
 * ## Derivado x gravado
 *
 * O derivado não tem documento no banco. Use este merge para calcular
 * **status** (calendário, grade do dia, conflito de reserva); **nunca** para
 * LISTAR bloqueios numa tela de gestão, onde um botão de apagar apontaria
 * para o nada.
 *
 * A ordem de manutenção é a exceção que confirma a regra: ela GRAVA a cópia
 * em vez de derivar, porque a ordem é privada da arena e o atleta nunca
 * conseguiria lê-la. Por isso ela não aparece aqui — já vem dentro de
 * `gravados`.
 */

import { mergeGameDayBlocks } from '@/modules/games/domain/arenaGameDay.js';
import { mergeOpenSlotBlocks } from './openMatch.js';
import { mergeClassBlocks } from './classes.js';

/**
 * Os bloqueios gravados mais todos os derivados, sem duplicar.
 *
 * Cada fonte é opcional: quem não a carregou passa `undefined` e o resultado
 * é o mesmo de antes. Isso é o que permite ir acrescentando fonte sem mexer
 * em quem chama.
 *
 * @param {{
 *   gravados?: Array<object>,
 *   diasDeJogo?: Array<object>,
 *   vagasAbertas?: Array<object>,
 *   aulas?: Array<object>,
 * }} fontes
 * @returns {Array<object>} no formato de `arena_unavailabilities`
 */
export function mergeArenaBlocks({
  gravados = [], diasDeJogo = [], vagasAbertas = [], aulas = [],
} = {}) {
  const base = Array.isArray(gravados) ? gravados : [];
  return mergeClassBlocks(
    mergeOpenSlotBlocks(mergeGameDayBlocks(base, diasDeJogo), vagasAbertas),
    aulas,
  );
}
