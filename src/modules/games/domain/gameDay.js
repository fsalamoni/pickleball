/**
 * Domínio puro do "Dia de jogo do atleta" (flag athlete_game_day).
 *
 * Um atleta cria seu próprio dia de jogo (público ou privado por convite),
 * insere/convida qualquer atleta da plataforma e organiza os jogos. É um
 * primo do dia de jogo dos clubes, mas escopado ao atleta criador — sem clube
 * dono. Sem I/O; recebe/valida dados e calcula visibilidade e membros.
 *
 * Coleções (ver firestore.rules):
 *  - game_days/{id}                       — o dia de jogo (dono, visibilidade, membros)
 *  - game_days/{id}/participants/{pid}    — participantes do dia (com user_id/guest)
 *  - game_days/{id}/games/{gid}           — jogos sorteados/avulsos do dia
 *  - open_games (kind='game_day')         — convite público em "Procura-se jogo"
 *  - club_event_games                     — espelho dos resultados no ranking
 */

import { GAME_DAY_FORMAT } from '@/modules/clubs/domain/gameDayFormats.js';

/** Visibilidade do dia de jogo. */
export const GAME_DAY_VISIBILITY = Object.freeze({
  PUBLIC: 'public', // publica convite em "Procura-se jogo"
  PRIVATE: 'private', // apenas convidados/inseridos
});

export const GAME_DAY_VISIBILITY_LABELS = Object.freeze({
  [GAME_DAY_VISIBILITY.PUBLIC]: 'Público (aparece em Procura-se jogo)',
  [GAME_DAY_VISIBILITY.PRIVATE]: 'Privado (somente convidados)',
});

/** Estado do dia de jogo. */
export const GAME_DAY_STATUS = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

/** Origem de um participante do dia de jogo do atleta. */
export const GD_PARTICIPANT_SOURCE = Object.freeze({
  OWNER: 'owner', // o próprio criador
  INVITED: 'invited', // atleta convidado/inserido pelo criador
  JOINED: 'joined', // atleta que participou pelo convite público
  GUEST: 'guest', // convidado avulso (fora da plataforma, só nome)
});

export const GD_PARTICIPANT_SOURCE_LABELS = Object.freeze({
  [GD_PARTICIPANT_SOURCE.OWNER]: 'Organizador',
  [GD_PARTICIPANT_SOURCE.INVITED]: 'Convidado',
  [GD_PARTICIPANT_SOURCE.JOINED]: 'Entrou pelo convite',
  [GD_PARTICIPANT_SOURCE.GUEST]: 'Convidado avulso',
});

/** Limites do dia de jogo do atleta. */
export const GAME_DAY_LIMITS = Object.freeze({
  MAX_PARTICIPANTS: 64,
  MAX_ROUNDS: 30,
  TITLE_MAX: 80,
  NOTES_MAX: 1000,
  MAX_COURTS: 12,
});

/** Normaliza o número de quadras do formato Play (1..MAX_COURTS). */
export function normalizePlayCourts(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(GAME_DAY_LIMITS.MAX_COURTS, n);
}

function trimmed(value) {
  return String(value ?? '').trim();
}

/**
 * Normaliza e valida o input de criação/edição de um dia de jogo.
 * @param {object} input
 * @returns {{ valid: boolean, errors: Record<string,string>, value: object }}
 */
export function normalizeGameDayInput(input = {}) {
  const value = {
    title: trimmed(input.title).slice(0, GAME_DAY_LIMITS.TITLE_MAX),
    visibility: Object.values(GAME_DAY_VISIBILITY).includes(input.visibility)
      ? input.visibility
      : GAME_DAY_VISIBILITY.PRIVATE,
    date: trimmed(input.date) || null,
    time: trimmed(input.time) || null,
    location: trimmed(input.location).slice(0, 160) || null,
    city: trimmed(input.city).slice(0, 80) || null,
    state: trimmed(input.state).toUpperCase().slice(0, 2) || null,
    notes: trimmed(input.notes).slice(0, GAME_DAY_LIMITS.NOTES_MAX) || null,
    format: Object.values(GAME_DAY_FORMAT).includes(input.format)
      ? input.format
      : GAME_DAY_FORMAT.AMERICANO,
    play_courts: normalizePlayCourts(input.play_courts),
  };

  const errors = {};
  if (!value.title) errors.title = 'Dê um nome ao seu dia de jogo.';

  return { valid: Object.keys(errors).length === 0, errors, value };
}

/** É o dia de jogo público? (ausência de campo = privado). */
export function isPublicGameDay(gameDay) {
  return (gameDay?.visibility || GAME_DAY_VISIBILITY.PRIVATE) === GAME_DAY_VISIBILITY.PUBLIC;
}

/** É o criador do dia de jogo? */
export function isGameDayOwner(gameDay, uid) {
  return !!uid && gameDay?.created_by === uid;
}

/**
 * Recalcula a lista de membros (uids com acesso ao dia de jogo): o criador +
 * os convidados + os participantes com user_id. Determinístico e deduplicado.
 *
 * @param {object} args
 * @param {string} args.createdBy
 * @param {string[]} [args.invitedUids]
 * @param {Array<{user_id?: string}>} [args.participants]
 * @returns {string[]}
 */
export function computeMemberUids({ createdBy, invitedUids = [], participants = [] } = {}) {
  const set = new Set();
  if (createdBy) set.add(createdBy);
  (invitedUids || []).forEach((uid) => { if (uid) set.add(uid); });
  (participants || []).forEach((p) => { if (p?.user_id) set.add(p.user_id); });
  return Array.from(set);
}

/**
 * Pode ver este dia de jogo? Somente o criador e os membros (convidados/que
 * entraram pelo convite). Dias de jogo públicos não são listados abertamente:
 * eles aparecem via convite em "Procura-se jogo" e só entram na lista do
 * atleta depois que ele participa.
 */
export function canViewGameDay(gameDay, uid) {
  if (!gameDay || !uid) return false;
  if (isGameDayOwner(gameDay, uid)) return true;
  return Array.isArray(gameDay.member_uids) && gameDay.member_uids.includes(uid);
}

/** Resumo curto de data/hora/local para cartões. */
export function gameDayWhenText(gameDay) {
  if (!gameDay) return '';
  const parts = [];
  if (gameDay.date) parts.push(gameDay.date);
  if (gameDay.time) parts.push(gameDay.time);
  const when = parts.join(' · ');
  const place = [gameDay.location, [gameDay.city, gameDay.state].filter(Boolean).join('/')].filter(Boolean).join(' — ');
  return [when, place].filter(Boolean).join(' · ');
}
