/**
 * Quem pode ENTRAR SOZINHO num dia de jogo, pela página dele (lógica pura).
 *
 * O "Jogar" do início e o Procura-se jogo levam para dentro do dia de jogo, e
 * é lá que a pessoa se inscreve. O painel "Participar" vale para o dia
 * PÚBLICO (do atleta ou da arena) de outra pessoa; não vale:
 *  - para quem organiza (criador, arena, clube) — esses inserem e tiram gente
 *    pela lista de participantes;
 *  - no dia privado (só por convite);
 *  - no dia de clube (o membro marca presença na data do evento);
 *  - no dia do JOGO ABERTO (tem o painel próprio, com nível e fila);
 *  - no dia arquivado.
 */
import { isPublicGameDay } from './gameDay.js';
import { isClubGameDay } from './clubGameDay.js';

export function joinPanelApplies(gameDay, { uid, podeConfigurar = false } = {}) {
  if (!gameDay || !uid) return false;
  if (gameDay.status === 'archived') return false;
  if (!isPublicGameDay(gameDay) || isClubGameDay(gameDay)) return false;
  if (gameDay.open_slot_id) return false;
  if (gameDay.created_by === uid || podeConfigurar) return false;
  return true;
}
