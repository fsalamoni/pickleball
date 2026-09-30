/**
 * Quem pode ENTRAR SOZINHO num dia de jogo, pela página dele (lógica pura).
 *
 * O "Jogar" do início e o Procura-se jogo levam para dentro do dia de jogo, e
 * é lá que a pessoa se inscreve. O painel "Participar" vale:
 *  - no dia PÚBLICO (do atleta ou da arena) de outra pessoa;
 *  - ⭐ no dia do CLUBE, para quem é do clube — inclusive quem organiza: quem
 *    agenda a data NÃO vira jogador (um evento semanal cria dezenas de datas de
 *    uma vez), e o administrador do clube costuma jogar também. É o mesmo
 *    "Marcar presença" que o clube sempre teve na data do evento.
 *
 * Não vale:
 *  - para quem organiza o dia do atleta ou da arena (criador, administrador,
 *    arena) — esses inserem e tiram gente pela lista de participantes;
 *  - no dia privado que não é de clube (só por convite);
 *  - no dia do JOGO ABERTO (tem o painel próprio, com nível e fila);
 *  - no dia arquivado.
 */
import { isPublicGameDay } from './gameDay.js';
import { isClubGameDay } from './clubGameDay.js';

/**
 * @param {object} gameDay
 * @param {{ uid?: string|null, podeConfigurar?: boolean, souDoClube?: boolean }} opts
 *   `souDoClube`: a pessoa é membro do clube dono do dia (só importa no dia de clube).
 */
export function joinPanelApplies(gameDay, { uid, podeConfigurar = false, souDoClube = false } = {}) {
  if (!gameDay || !uid) return false;
  if (gameDay.status === 'archived') return false;
  if (gameDay.open_slot_id) return false;
  if (isClubGameDay(gameDay)) return Boolean(souDoClube);
  if (!isPublicGameDay(gameDay)) return false;
  if (gameDay.created_by === uid || podeConfigurar) return false;
  return true;
}
