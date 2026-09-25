/**
 * Tudo o que ocupa uma quadra — a leitura, num lugar só.
 *
 * O domínio (`arenaBlocks.js`) sabe COMPOR as fontes; este arquivo sabe
 * BUSCÁ-LAS. Estavam duplicados no serviço de reserva e no de vagas abertas, e
 * cada fonte nova exigia lembrar dos dois: quem ficasse para trás não dava
 * erro, dava a quadra vendida duas vezes.
 *
 * ## Nenhuma leitura pode derrubar a operação
 *
 * Cada consulta tem o próprio `catch` que devolve lista vazia. Uma falha de
 * rede na leitura das aulas não pode impedir uma reserva legítima — o pedido
 * segue com o que deu para carregar. É a mesma escolha que já valia antes.
 */

import { listArenaUnavailabilities } from './arenaService.js';
import { listArenaGameDays } from '@/modules/games/services/arenaGameDayService.js';
import { listArenaOpenSlots } from './openMatchService.js';
import { listArenaClasses } from './classesService.js';
import { listArenaTournaments } from './leaguesService.js';
import { mergeArenaBlocks } from '../domain/arenaBlocks.js';

/**
 * Os bloqueios da arena, gravados e derivados.
 *
 * @param {string} arenaId
 * @param {{ exceptSlotId?: string, exceptClassId?: string, exceptGameDayId?: string }} [opts]
 *   a entidade que está sendo criada/editada não conflita consigo mesma. O
 *   jogo aberto ligado a um dia de jogo (Onda CA) exclui os DOIS: a vaga e o
 *   dia de jogo dela — senão, ao mudar o horário, ele conflitaria com o
 *   próprio bloqueio.
 * @returns {Promise<Array<object>>} no formato de `arena_unavailabilities`
 */
export async function arenaOccupancy(arenaId, { exceptSlotId, exceptClassId, exceptGameDayId } = {}) {
  if (!arenaId) return [];
  const [gravados, diasDeJogo, vagas, aulas, torneios] = await Promise.all([
    listArenaUnavailabilities(arenaId).catch(() => []),
    listArenaGameDays(arenaId).catch(() => []),
    listArenaOpenSlots(arenaId, { limit: 500 }).catch(() => []),
    listArenaClasses(arenaId, { lim: 500 }).catch(() => []),
    listArenaTournaments(arenaId, { lim: 200 }).catch(() => []),
  ]);
  return mergeArenaBlocks({
    gravados: exceptGameDayId ? gravados.filter((g) => g.game_day_id !== exceptGameDayId) : gravados,
    diasDeJogo: exceptGameDayId ? diasDeJogo.filter((d) => d.id !== exceptGameDayId) : diasDeJogo,
    vagasAbertas: exceptSlotId ? vagas.filter((v) => v.id !== exceptSlotId) : vagas,
    aulas: exceptClassId ? aulas.filter((a) => a.id !== exceptClassId) : aulas,
    torneios,
  });
}
