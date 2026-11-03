/**
 * A lista de dias de jogo do Painel admin (Torneios → Dias de jogo): de onde
 * vem cada dia, quando começa e o que falta nele. Puro, sem I/O.
 *
 * Existe para o administrador da plataforma ACHAR o dia de outra pessoa e
 * ajustá-lo (ele configura qualquer dia — `canConfigureGameDay` com
 * `platformAdmin`). "Sem data ou horário" aponta os dias antigos que nasceram
 * antes de data e horário de início serem obrigatórios.
 */

import { GAME_DAY_STATUS } from './gameDay.js';

export const ADMIN_GAME_DAY_ORIGIN = Object.freeze({
  ATHLETE: 'atleta',
  ARENA: 'arena',
  CLUB: 'clube',
});

export const ADMIN_GAME_DAY_FILTER = Object.freeze({
  ALL: 'todos',
  UPCOMING: 'proximos',
  PAST: 'passados',
  MISSING_TIME: 'sem_horario',
  ARCHIVED: 'arquivados',
});

/** De onde vem o dia de jogo. */
export function adminGameDayOrigin(gameDay) {
  if (typeof gameDay?.arena_id === 'string' && gameDay.arena_id) return ADMIN_GAME_DAY_ORIGIN.ARENA;
  if (typeof gameDay?.club_id === 'string' && gameDay.club_id) return ADMIN_GAME_DAY_ORIGIN.CLUB;
  return ADMIN_GAME_DAY_ORIGIN.ATHLETE;
}

/**
 * O horário de início do dia: o campo `time` e, no dia de ARENA (que não tem
 * `time`), o começo da primeira quadra reservada.
 */
export function adminGameDayStart(gameDay) {
  if (gameDay?.time) return String(gameDay.time).slice(0, 5);
  const inicios = (Array.isArray(gameDay?.arena_slots) ? gameDay.arena_slots : [])
    .map((s) => s?.start_time)
    .filter(Boolean)
    .sort();
  return inicios[0] ? String(inicios[0]).slice(0, 5) : null;
}

/** Falta a data ou o horário de início? */
export function adminGameDayMissingTime(gameDay) {
  return !gameDay?.date || !adminGameDayStart(gameDay);
}

function semAcento(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Filtra e ordena. Próximos do mais cedo ao mais tarde; o resto, do mais
 * recente ao mais antigo. Arquivados só aparecem no filtro deles.
 *
 * @param {Array<object>} gameDays
 * @param {{ busca?: string, origem?: string|null, filtro?: string, hoje: string }} opts
 */
export function adminGameDayRows(gameDays, { busca = '', origem = null, filtro = ADMIN_GAME_DAY_FILTER.ALL, hoje } = {}) {
  const termo = semAcento(busca).trim();
  const linhas = (gameDays || []).filter((gd) => {
    if (!gd?.id) return false;
    const arquivado = gd.status === GAME_DAY_STATUS.ARCHIVED;
    if (filtro === ADMIN_GAME_DAY_FILTER.ARCHIVED) {
      if (!arquivado) return false;
    } else if (arquivado) return false;
    if (origem && adminGameDayOrigin(gd) !== origem) return false;
    if (filtro === ADMIN_GAME_DAY_FILTER.UPCOMING && !(gd.date && gd.date >= hoje)) return false;
    if (filtro === ADMIN_GAME_DAY_FILTER.PAST && !(gd.date && gd.date < hoje)) return false;
    if (filtro === ADMIN_GAME_DAY_FILTER.MISSING_TIME && !adminGameDayMissingTime(gd)) return false;
    if (termo) {
      const alvo = semAcento([gd.title, gd.creator_name, gd.arena_name, gd.club_name, gd.city, gd.id].join(' '));
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });
  const chave = (gd) => `${gd.date || ''} ${adminGameDayStart(gd) || ''}`;
  if (filtro === ADMIN_GAME_DAY_FILTER.UPCOMING) {
    return linhas.sort((a, b) => chave(a).localeCompare(chave(b)));
  }
  return linhas.sort((a, b) => chave(b).localeCompare(chave(a))
    || Number(b.created_at_ms || 0) - Number(a.created_at_ms || 0));
}
