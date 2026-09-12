/**
 * Quem pode fazer o quê num dia de jogo — lógica pura, sem I/O.
 *
 * ## Dois níveis, e a razão de serem dois
 *
 * **Configurar** é do CRIADOR e de mais ninguém: editar/arquivar o dia, decidir
 * o modo de gestão, escolher quem é administrador e publicar os resultados no
 * ranking da plataforma. São atos que mudam a identidade do dia de jogo ou saem
 * dele — o espelho no ranking, inclusive, é amarrado ao criador pela própria
 * regra do Firestore (`club_event_games`), então nem adiantaria abrir aqui.
 *
 * **Gerenciar** é a operação do dia: sortear, criar/encerrar/cancelar partidas,
 * lançar placar, substituir quem faltou, pausar participação, vincular dupla,
 * inserir e remover participante. É isto que o criador escolhe manter só para
 * si ou abrir para quem está jogando.
 *
 * ## Modo de gestão
 *
 * - `owner_only` (**padrão**) — só o criador e os administradores que ele
 *   nomear. É o comportamento que a plataforma sempre teve: um dia de jogo
 *   antigo, sem o campo gravado, continua exatamente como estava.
 * - `participants` — qualquer participante inscrito também gerencia.
 *
 * ## Administradores
 *
 * `admin_uids` é aditivo e opcional. O criador nunca precisa estar na lista:
 * ele é administrador por ser o criador, e por isso não há como se remover por
 * acidente.
 *
 * ## Dia de jogo de ARENA
 *
 * Um dia de jogo com `arena_id` pertence à arena, não à pessoa que clicou em
 * criar. Quem gerencia a arena administra o dia — inclusive quem virou gestor
 * DEPOIS de o dia ser criado, e mesmo que quem criou tenha saído da equipe.
 * Isso entra por uma opção explícita (`arenaManager`), calculada por quem
 * chama, porque este arquivo é puro e não consulta nada.
 *
 * A opção **só vale num dia de jogo de arena**: gerenciar uma arena qualquer
 * não dá poder sobre o rachão de ninguém. A conferência está aqui dentro, não
 * só em quem chama — é barata e evita que um `true` distraído vire permissão.
 * A regra do Firestore repete a mesma ideia com `isArenaManager(arena_id)`,
 * que é a barreira de verdade; isto aqui decide o que a TELA mostra.
 */

/**
 * O dia de jogo pertence a uma arena?
 *
 * Repetido aqui (em vez de importado de `arenaGameDay.js`) de propósito: aquele
 * arquivo já importa deste, e uma ida e volta entre os dois por três linhas
 * não paga o ciclo de import.
 */
function ehDeArena(gameDay) {
  return typeof gameDay?.arena_id === 'string' && gameDay.arena_id.length > 0;
}

/** Modos de gestão de um dia de jogo. */
export const GAME_DAY_MANAGE_MODE = Object.freeze({
  OWNER_ONLY: 'owner_only',
  PARTICIPANTS: 'participants',
});

export const GAME_DAY_MANAGE_MODE_LABELS = Object.freeze({
  [GAME_DAY_MANAGE_MODE.OWNER_ONLY]: 'Só eu e quem eu autorizar',
  [GAME_DAY_MANAGE_MODE.PARTICIPANTS]: 'Qualquer participante inscrito',
});

export const GAME_DAY_MANAGE_MODE_HINTS = Object.freeze({
  [GAME_DAY_MANAGE_MODE.OWNER_ONLY]:
    'Sortear, criar partidas, substituir, pausar, vincular dupla e mexer na lista de participantes ficam com você e com os administradores que você nomear.',
  [GAME_DAY_MANAGE_MODE.PARTICIPANTS]:
    'Todo mundo que está no dia de jogo pode conduzir as partidas e a lista de participantes. Bom para um Play em que várias pessoas se revezam organizando.',
});

/**
 * Modo de gestão gravado, normalizado.
 *
 * Ausente, nulo ou desconhecido ⇒ `owner_only`. Essa é a garantia de que
 * nenhum dia de jogo já existente muda de comportamento: o campo é novo, e
 * quem não o tem cai no modo restrito.
 */
export function gameDayManageMode(gameDay) {
  const raw = gameDay?.manage_mode;
  return raw === GAME_DAY_MANAGE_MODE.PARTICIPANTS
    ? GAME_DAY_MANAGE_MODE.PARTICIPANTS
    : GAME_DAY_MANAGE_MODE.OWNER_ONLY;
}

/** O dia de jogo está aberto para os participantes gerenciarem? */
export function isGameDayOpenToParticipants(gameDay) {
  return gameDayManageMode(gameDay) === GAME_DAY_MANAGE_MODE.PARTICIPANTS;
}

/**
 * Uids dos administradores NOMEADOS (sem o criador, que é administrador por
 * definição). Sempre um array, sem nulos e sem repetição.
 */
export function gameDayAdminUids(gameDay) {
  const lista = Array.isArray(gameDay?.admin_uids) ? gameDay.admin_uids : [];
  const criador = gameDay?.created_by || null;
  return Array.from(new Set(
    lista.filter((uid) => typeof uid === 'string' && uid && uid !== criador),
  ));
}

/** É o criador do dia de jogo? */
export function isGameDayCreator(gameDay, uid) {
  return !!uid && !!gameDay && gameDay.created_by === uid;
}

/**
 * É administrador: o criador, alguém que ele nomeou, ou — num dia de jogo de
 * ARENA — quem gerencia a arena.
 *
 * @param {object} gameDay
 * @param {string} uid
 * @param {{ arenaManager?: boolean }} [options] `arenaManager` é ignorado em
 *   dia de jogo que não seja de arena.
 */
export function isGameDayAdmin(gameDay, uid, { arenaManager = false } = {}) {
  if (!uid || !gameDay) return false;
  if (isGameDayCreator(gameDay, uid)) return true;
  if (arenaManager === true && ehDeArena(gameDay)) return true;
  return gameDayAdminUids(gameDay).includes(uid);
}

/**
 * Está inscrito neste dia de jogo?
 *
 * A lista de participantes é a fonte preferida — é ela que diz quem está
 * JOGANDO. Sem ela (uma tela que ainda não carregou), cai em `member_uids`,
 * que inclui também quem foi convidado e ainda não entrou. A diferença importa:
 * na dúvida, o fallback é mais permissivo, mas nunca ultrapassa quem tem acesso
 * ao dia de jogo.
 *
 * @param {object} gameDay
 * @param {string} uid
 * @param {Array<{user_id?: string}>|null} [participants]
 */
export function isGameDayParticipant(gameDay, uid, participants = null) {
  if (!uid || !gameDay) return false;
  if (Array.isArray(participants)) {
    return participants.some((p) => p?.user_id === uid);
  }
  return Array.isArray(gameDay.member_uids) && gameDay.member_uids.includes(uid);
}

/**
 * Pode CONFIGURAR o dia de jogo (editar, arquivar, definir o modo de gestão,
 * nomear administradores, publicar no ranking)?
 *
 * Só o criador — e, num dia de jogo de ARENA, quem gerencia a arena. A arena é
 * a dona do evento: amarrar a configuração a uma pessoa deixaria o dia de jogo
 * órfão quando ela saísse da equipe.
 */
export function canConfigureGameDay(gameDay, uid, { arenaManager = false } = {}) {
  if (isGameDayCreator(gameDay, uid)) return true;
  return arenaManager === true && ehDeArena(gameDay) && !!uid;
}

/**
 * Pode GERENCIAR as partidas e os participantes?
 *
 * @param {object} gameDay
 * @param {string} uid
 * @param {{ participants?: Array|null, arenaManager?: boolean }} [options]
 */
export function canManageGameDay(gameDay, uid, { participants = null, arenaManager = false } = {}) {
  if (!uid || !gameDay) return false;
  if (isGameDayAdmin(gameDay, uid, { arenaManager })) return true;
  if (!isGameDayOpenToParticipants(gameDay)) return false;
  return isGameDayParticipant(gameDay, uid, participants);
}

/**
 * Lista de administradores para exibir: o criador em primeiro (marcado como
 * tal) e depois os nomeados, na ordem em que foram gravados.
 *
 * @param {object} gameDay
 * @param {Map<string, object>|null} [perfilPorUid] para enriquecer com nome/foto
 * @returns {Array<{ uid: string, criador: boolean, nome: string|null, foto: string|null }>}
 */
export function gameDayAdminList(gameDay, perfilPorUid = null) {
  // Os gestores da arena não entram nesta lista de propósito: eles administram
  // por serem da arena, e mostrá-los aqui daria a entender que dá para
  // removê-los pelo dia de jogo — o que tiraria o poder deles sobre a arena.
  const enriquecer = (uid, criador) => {
    const p = perfilPorUid ? perfilPorUid.get(uid) : null;
    return {
      uid,
      criador,
      nome: p?.platform_name || p?.name || null,
      foto: p?.photo_url || null,
    };
  };
  const saida = [];
  if (gameDay?.created_by) saida.push(enriquecer(gameDay.created_by, true));
  gameDayAdminUids(gameDay).forEach((uid) => saida.push(enriquecer(uid, false)));
  return saida;
}
