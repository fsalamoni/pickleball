/**
 * Domínio: o JOGO ABERTO que é um DIA DE JOGO (Onda CA). PURO, sem I/O.
 *
 * ## O pedido
 *
 * *"O jogo aberto, além do que ele já contempla, deve gerar um 'dia de jogo'.
 * Então, na configuração do jogo aberto, é preciso contemplar outros detalhes
 * de configuração do dia de jogo. Os usuários, dentro da página da arena,
 * podem dizer que vão no jogo aberto (dia de jogo) e devem poder visualizar as
 * configurações do dia de jogo, os participantes inscritos e tudo mais."*
 *
 * ## A forma: dois documentos, UMA lista de inscritos
 *
 * O jogo aberto (`arena_open_slots`) continua sendo a VITRINE: faixa de nível,
 * valor, vagas, fila de espera — e é ele que aparece na página da arena, em
 * Minhas reservas e em Procura-se jogo. O dia de jogo (`game_days`, com
 * `arena_id`) passa a ser o JOGO: formato, quem conduz, quadras, sorteio,
 * placar, ranking do dia, telão. Os dois se apontam:
 *
 *   arena_open_slots.game_day_id  ⇄  game_days.open_slot_id
 *
 * Ausentes os dois campos, nada muda: a vaga antiga segue como sempre foi.
 *
 * A tentação era copiar formato, sorteio e placar para dentro do jogo aberto.
 * Seria o erro que a plataforma já pagou duas vezes (o clube meses sem Play e
 * sem telão; o torneio interno que não gerava partida): a máquina do dia de
 * jogo existe, é testada e é a mesma no atleta, na arena e no clube.
 *
 * ## Quem manda em quê
 *
 * | O quê | Mora em | Por quê |
 * |---|---|---|
 * | nível, valor, fila | vaga | é o que decide QUEM entra |
 * | formato, quem conduz, partidas | dia de jogo | é o que decide COMO se joga |
 * | data, horário, quadras, vagas | os DOIS | a vaga para a vitrine; o dia para fechar a quadra |
 * | inscritos | os DOIS, gravados JUNTOS | ver abaixo |
 *
 * Entrar e sair gravam a vaga e o dia de jogo num LOTE ÚNICO (tudo ou nada):
 * lista que diverge não dá erro, dá a arena vendo 4 inscritos numa tela e 3
 * na outra, sem saber qual está certa.
 *
 * ## A quadra
 *
 * Quem fecha a quadra no calendário é o DIA DE JOGO (`gameDayBlocks`). A vaga
 * ligada deixa de derivar bloqueio próprio (`openSlotBlocks` a pula) — contar
 * duas vezes mostraria dois bloqueios no mesmo horário.
 */

import { GAME_DAY_FORMAT, GAME_DAY_FORMAT_LABELS } from '@/modules/clubs/domain/gameDayFormats.js';
import { GAME_DAY_MANAGE_MODE } from '@/modules/games/domain/gameDayRoles.js';
import { ARENA_SIGNUP_MODE } from '@/modules/games/domain/arenaGameDay.js';
import { normalizeOpenSlotInput, getAvailableSpots } from './openMatch.js';

export const OPEN_MATCH_DEFAULT_TITLE = 'Jogo aberto';

/** Formatos oferecidos ao publicar (o Americano aprimorado depende de flag). */
export const OPEN_MATCH_GAME_FORMATS = Object.freeze([
  GAME_DAY_FORMAT.AMERICANO,
  GAME_DAY_FORMAT.AMERICANO_LIVE,
  GAME_DAY_FORMAT.PLAY,
  GAME_DAY_FORMAT.MEXICANO,
  GAME_DAY_FORMAT.KING_OF_COURT,
]);

/** Os nomes curtos, para cartões — os longos de `GAME_DAY_FORMAT_LABELS` quebram linha. */
export const OPEN_MATCH_FORMAT_SHORT = Object.freeze({
  [GAME_DAY_FORMAT.AMERICANO]: 'Americano',
  [GAME_DAY_FORMAT.AMERICANO_LIVE]: 'Americano aprimorado',
  [GAME_DAY_FORMAT.PLAY]: 'Play',
  [GAME_DAY_FORMAT.MEXICANO]: 'Mexicano',
  [GAME_DAY_FORMAT.KING_OF_COURT]: 'Rei da Quadra',
});

/** O nome curto do formato do dia de jogo. */
export function openMatchFormatLabel(format) {
  return OPEN_MATCH_FORMAT_SHORT[format] || GAME_DAY_FORMAT_LABELS[format] || '';
}

/** A vaga já é um dia de jogo? */
export function isLinkedOpenSlot(slot) {
  return typeof slot?.game_day_id === 'string' && slot.game_day_id.length > 0;
}

/** O dia de jogo nasceu de um jogo aberto? */
export function isOpenMatchGameDay(gameDay) {
  return typeof gameDay?.open_slot_id === 'string' && gameDay.open_slot_id.length > 0;
}

/**
 * As quadras da vaga, sempre como lista. A vaga antiga tem só `court_id`; a
 * ligada ao dia de jogo tem `court_ids` (pode rodar em mais de uma quadra —
 * um Americano com 8 atletas precisa de duas).
 */
export function openSlotCourtIds(slot) {
  if (Array.isArray(slot?.court_ids) && slot.court_ids.length > 0) {
    return Array.from(new Set(slot.court_ids.filter(Boolean)));
  }
  return slot?.court_id ? [slot.court_id] : [];
}

/** Quantas quadras um número de vagas pede, no formato de duplas. */
export function suggestedCourtCount(totalSpots) {
  const n = Math.max(0, Math.trunc(Number(totalSpots) || 0));
  return Math.max(1, Math.ceil(n / 4));
}

/**
 * Normaliza o que a arena preencheu ao publicar (ou editar) um jogo aberto
 * que é um dia de jogo.
 *
 * Devolve as DUAS metades prontas: `slot` (o que vai para a vitrine) e
 * `gameDay` (a entrada de `normalizeArenaGameDayInput`). Um formulário só,
 * duas gravações que nunca discordam — a data, o horário e as quadras saem do
 * mesmo campo para os dois.
 *
 * @param {object} input
 * @param {{ courts?: Array<{id:string,name?:string}>, formats?: string[] }} [ctx]
 *   `formats`: os formatos que a tela ofereceu (o Americano aprimorado só com
 *   a flag). Um formato fora da lista é recusado — senão uma edição feita por
 *   quem ainda vê a opção gravaria um formato que a tela de quem conduz não
 *   saberia abrir.
 * @returns {{ valid: boolean, errors: Record<string,string>, slot: object, gameDay: object }}
 */
export function normalizeOpenMatchInput(input = {}, { courts = [], formats = OPEN_MATCH_GAME_FORMATS } = {}) {
  const nomePorId = new Map((courts || []).map((c) => [c.id, c.name || '']));
  const courtIds = Array.from(new Set(
    (Array.isArray(input.court_ids) ? input.court_ids : [input.court_id])
      .map((id) => String(id ?? '').trim())
      .filter(Boolean),
  ));
  const nomes = courtIds.map((id) => nomePorId.get(id) || '').filter(Boolean);

  // A vitrine: as regras de sempre (nível na régua única, vagas de 2 a 20...).
  const base = normalizeOpenSlotInput({
    ...input,
    court_id: courtIds[0] || '',
    court: nomes.join(', ') || String(input.court ?? ''),
  });
  const errors = { ...base.errors };

  if (courtIds.length === 0) {
    // Um dia de jogo acontece em quadras. Sem quadra, o jogo não fecharia o
    // horário no calendário — e a arena venderia a mesma hora duas vezes.
    errors.court_ids = 'Escolha pelo menos uma quadra.';
  }

  const format = String(input.game_format ?? '').trim() || GAME_DAY_FORMAT.AMERICANO;
  if (!formats.includes(format)) errors.game_format = 'Escolha como o jogo vai ser jogado.';

  const manageMode = input.manage_mode === GAME_DAY_MANAGE_MODE.PARTICIPANTS
    ? GAME_DAY_MANAGE_MODE.PARTICIPANTS
    : GAME_DAY_MANAGE_MODE.OWNER_ONLY;

  const title = String(input.title ?? '').trim().slice(0, 80) || OPEN_MATCH_DEFAULT_TITLE;

  const slot = {
    ...base.value,
    court_ids: courtIds,
  };

  const gameDay = {
    title,
    date: base.value.date,
    notes: base.value.notes || '',
    format,
    manage_mode: manageMode,
    // No jogo aberto a lista é UMA para o dia inteiro — a arena distribui as
    // quadras pelo formato, e o teto é o número de vagas da vitrine.
    signup_mode: ARENA_SIGNUP_MODE.DAY,
    capacity: base.value.total_spots || null,
    arena_slots: courtIds.map((id) => ({
      court_id: id,
      court_name: nomePorId.get(id) || null,
      start_time: base.value.start,
      end_time: base.value.end,
      capacity: null,
    })),
  };

  return { valid: Object.keys(errors).length === 0, errors, slot, gameDay };
}

/**
 * A contagem de inscritos que vale para um jogo aberto ligado.
 *
 * A vaga guarda só contas da plataforma (`participants` é lista de uid); o
 * dia de jogo pode ter também CONVIDADOS que a arena inseriu à mão (quem
 * chegou na hora, sem conta). Os dois ocupam lugar na quadra, então o que
 * vale é o maior dos dois números.
 *
 * @param {object} slot
 * @param {Array<object>|null|undefined} gameDayParticipants null ⇒ desconhecido
 */
export function linkedOccupancy(slot, gameDayParticipants) {
  const naVaga = Array.isArray(slot?.participants) ? slot.participants.length : Number(slot?.filled_spots) || 0;
  const noDia = Array.isArray(gameDayParticipants) ? gameDayParticipants.length : 0;
  const usados = Math.max(naVaga, noDia);
  const total = Number(slot?.total_spots) || 0;
  return { usados, total, livres: Math.max(0, total - usados), cheio: total > 0 && usados >= total };
}

/**
 * Pode entrar num jogo aberto ligado? Complementa `canJoinOpenSlot` (nível,
 * status, prazo, "já está") com o que só o dia de jogo sabe: ele pode ter
 * sido encerrado, e os convidados da arena também ocupam lugar.
 *
 * @returns {{ ok: boolean, reason?: string }}
 */
export function canJoinLinkedGameDay({ slot, gameDay, participants = [], uid }) {
  if (!gameDay) return { ok: false, reason: 'O dia de jogo deste jogo aberto não foi encontrado.' };
  if (gameDay.status === 'archived') return { ok: false, reason: 'Este jogo foi encerrado.' };
  const jaNoDia = (participants || []).some((p) => p?.user_id === uid);
  if (jaNoDia) return { ok: true };
  if (linkedOccupancy(slot, participants).cheio || getAvailableSpots(slot) <= 0) {
    return { ok: false, reason: 'As vagas deste jogo acabaram.' };
  }
  return { ok: true };
}

/**
 * O que a vaga tem de gravar para ESPELHAR a lista do dia de jogo — usado
 * quando a ARENA insere ou tira alguém pela tela do dia de jogo, que não
 * passa pelo botão "Quero jogar".
 *
 * `participants` fica só com as contas (a vaga sempre foi lista de uid);
 * "lotado" considera também os convidados, porque eles ocupam lugar.
 */
export function slotMirrorFromGameDay(slot, gameDayParticipants = []) {
  const lista = Array.isArray(gameDayParticipants) ? gameDayParticipants : [];
  const uids = Array.from(new Set(lista.map((p) => p?.user_id).filter(Boolean)));
  const total = Number(slot?.total_spots) || 0;
  const status = total > 0 && lista.length >= total ? 'full' : 'open';
  return { participants: uids, filled_spots: uids.length, status };
}

/**
 * Um resumo de uma linha do jogo, para a vitrine: "Americano · 2 quadras ·
 * a arena conduz". É o que responde "como vai ser?" sem abrir a página.
 */
export function openMatchGameSummary(gameDay) {
  if (!gameDay) return '';
  const quadras = Array.isArray(gameDay.arena_slots) ? gameDay.arena_slots.length : 0;
  return [
    openMatchFormatLabel(gameDay.format),
    quadras > 0 ? `${quadras} ${quadras === 1 ? 'quadra' : 'quadras'}` : null,
    gameDay.manage_mode === GAME_DAY_MANAGE_MODE.PARTICIPANTS ? 'os inscritos conduzem' : 'a arena conduz',
  ].filter(Boolean).join(' · ');
}

/**
 * Onde a arena EDITA um dia de jogo dela — o endereço certo depende de onde
 * ele nasceu. O que veio de um jogo aberto se edita no jogo aberto (a vitrine
 * e o dia mudam juntos); o marcado no calendário, na tela de dias de jogo.
 * Mandar o jogo aberto para a tela de dias de jogo faria a arena editar só
 * metade, e a vitrine continuaria dizendo o horário antigo.
 */
export function arenaGameDayEditLink(gameDay) {
  if (!gameDay?.arena_id) return null;
  return isOpenMatchGameDay(gameDay)
    ? `/arenas/${gameDay.arena_id}/gerir?aba=jogo-aberto`
    : `/arenas/${gameDay.arena_id}/gerir/dia-de-jogo/${gameDay.id}`;
}
