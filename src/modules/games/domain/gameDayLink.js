/**
 * VÍNCULO do dia de jogo a um clube ou a uma arena — lógica pura, sem I/O.
 *
 * ## O que é (e o que de propósito NÃO é)
 *
 * Um dia de jogo criado em "Jogar" é do atleta. O vínculo diz de quem são as
 * ESTATÍSTICAS dele: as partidas entram no ranking interno do clube e no
 * ranking da casa da arena. É uma ATRIBUIÇÃO — o dia continua sendo do atleta,
 * com o mesmo criador, os mesmos organizadores, as mesmas telas.
 *
 * Por isso o vínculo NÃO grava `club_id`/`arena_id`: esses dois campos fazem o
 * dia VIRAR do clube/da arena — o gestor passa a poder editar e apagar, a
 * arena abre inscrição com teto de vagas, a quadra fecha no calendário e o dia
 * só se edita lá. Quem pediu "vincular" pediu estatística, não essas
 * consequências. Campos próprios, todos opcionais:
 *
 *   link_club_id, link_club_name, link_arena_id, link_arena_name
 *
 * Ausentes, nada aqui vale (todo dia já gravado segue como era). Um dia pode
 * ter o clube, a arena, ou os dois.
 *
 * ## Convidados
 *
 * Quem joga o dia e não é do clube (ou da arena) é CONVIDADO dele. É só um
 * rótulo: ninguém perde ranking, rating nem estatística, e o vínculo nunca
 * restringe a entrada — o dia vinculado é sempre público (ver `LINKED_VISIBILITY`).
 * Quando não se sabe quem é membro (consulta que falhou, lista que a pessoa não
 * lê), NINGUÉM é marcado: estado desconhecido não vira "convidado".
 */

import { t } from '@/core/i18n';

/** Os campos do vínculo no documento `game_days`. */
export const GAME_DAY_LINK_FIELDS = Object.freeze([
  'link_club_id', 'link_club_name', 'link_arena_id', 'link_arena_name',
]);

/**
 * O dia vinculado é sempre público: a página do clube/da arena e o ranking da
 * casa leem só dias públicos, e um dia "só para membros" não existe aqui — o
 * vínculo traz gente de fora (convidados).
 */
export const LINKED_VISIBILITY = 'public';

const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * O vínculo gravado, normalizado. Sem id, não há vínculo (um nome solto é lixo).
 *
 * @param {object|null|undefined} gameDay
 * @returns {{ club: { id: string, name: string }|null, arena: { id: string, name: string }|null }}
 */
export function gameDayLinks(gameDay) {
  const clubId = texto(gameDay?.link_club_id);
  const arenaId = texto(gameDay?.link_arena_id);
  return {
    club: clubId ? { id: clubId, name: texto(gameDay?.link_club_name) || t('Clube') } : null,
    arena: arenaId ? { id: arenaId, name: texto(gameDay?.link_arena_name) || t('Arena') } : null,
  };
}

/** O dia está vinculado a um clube ou a uma arena? */
export function isLinkedGameDay(gameDay) {
  const { club, arena } = gameDayLinks(gameDay);
  return !!(club || arena);
}

/** O clube vinculado (id) ou null. */
export function linkedClubId(gameDay) {
  return gameDayLinks(gameDay).club?.id || null;
}

/** A arena vinculada (id) ou null. */
export function linkedArenaId(gameDay) {
  return gameDayLinks(gameDay).arena?.id || null;
}

/**
 * Este dia aceita vínculo? Só o dia do ATLETA: o dia que já é de uma arena ou de
 * um clube (`arena_id`/`club_id`, inclusive o que nasceu de um jogo aberto)
 * pertence a ele e já tem as estatísticas lá.
 */
export function canLinkGameDay(gameDay) {
  if (!gameDay) return false;
  if (texto(gameDay.arena_id) || texto(gameDay.club_id)) return false;
  if (texto(gameDay.open_slot_id)) return false;
  return true;
}

/**
 * O patch do vínculo, pronto para gravar. `null` = desvincular aquele lado.
 * Os dois lados vão SEMPRE no patch: o que não foi escolhido é apagado, senão
 * "trocar de clube" deixaria o nome do clube antigo para trás.
 *
 * @param {{ club?: {id: string, name?: string}|null, arena?: {id: string, name?: string}|null }} escolha
 */
export function buildLinkPatch({ club = null, arena = null } = {}) {
  const clubId = texto(club?.id);
  const arenaId = texto(arena?.id);
  return {
    link_club_id: clubId,
    link_club_name: clubId ? (texto(club?.name) || null) : null,
    link_arena_id: arenaId,
    link_arena_name: arenaId ? (texto(arena?.name) || null) : null,
  };
}

/** "Clube Norte · Arena Sol" — o texto do selo, ou null sem vínculo. */
export function linkLabel(gameDay) {
  const { club, arena } = gameDayLinks(gameDay);
  const partes = [club?.name, arena?.name].filter(Boolean);
  return partes.length ? partes.join(' · ') : null;
}

/**
 * Quem é CONVIDADO neste dia, em relação a um conjunto de membros.
 *
 * - `memberUids` desconhecido (`null`/`undefined`) ⇒ `known: false` e ninguém é
 *   marcado.
 * - participante sem conta (convidado avulso) é convidado: não é membro de nada.
 *
 * @param {Array<{ id?: string, user_id?: string|null }>} participants
 * @param {Iterable<string>|null|undefined} memberUids
 * @returns {{ known: boolean, guests: Array, guestIds: Set<string>, members: number, total: number }}
 */
export function splitGuests(participants = [], memberUids) {
  const lista = Array.isArray(participants) ? participants.filter(Boolean) : [];
  if (memberUids == null) {
    return { known: false, guests: [], guestIds: new Set(), members: 0, total: lista.length };
  }
  const membros = memberUids instanceof Set ? memberUids : new Set(memberUids);
  const guests = lista.filter((p) => !p.user_id || !membros.has(p.user_id));
  return {
    known: true,
    guests,
    guestIds: new Set(guests.map((p) => p.id).filter(Boolean)),
    members: lista.length - guests.length,
    total: lista.length,
  };
}

/** O participante é convidado? (`null` quando não se sabe) */
export function isGuest(participant, memberUids) {
  if (memberUids == null || !participant) return null;
  const membros = memberUids instanceof Set ? memberUids : new Set(memberUids);
  return !participant.user_id || !membros.has(participant.user_id);
}

/**
 * O que a pessoa pode vincular: os clubes que ADMINISTRA e as arenas que GERE
 * (a regra do Firestore confere de novo). Vincular é ato institucional — o dia
 * vai para a página e para o ranking do clube/arena —, por isso não basta ser
 * membro do clube. Ordenado por nome, sem repetição.
 *
 * @param {{ clubs?: Array<{id: string, name?: string, my_role?: string}>, arenas?: Array<{id: string, name?: string}> }} fontes
 */
export function linkOptions({ clubs = [], arenas = [] } = {}) {
  const limpar = (lista) => {
    const vistos = new Set();
    return (Array.isArray(lista) ? lista : [])
      .filter((x) => x?.id && !vistos.has(x.id) && vistos.add(x.id))
      .map((x) => ({ id: x.id, name: texto(x.name) || '' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  };
  const adminDe = (lista) => (Array.isArray(lista) ? lista : []).filter((c) => c?.my_role === 'admin');
  return { clubs: limpar(adminDe(clubs)), arenas: limpar(arenas) };
}
