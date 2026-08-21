/**
 * Domínio puro do agregado "meus jogos" de dia de jogo — normaliza os jogos em
 * que o atleta participou (do espelho `club_event_games` e da fonte
 * `game_days/.../games`) num formato único e os funde nas estatísticas.
 *
 * Regra do produto: em "Meu desempenho" (estatística + meus jogos) entram TODOS
 * os jogos que o atleta participa, sempre — independente de publicação no
 * ranking. A publicação afeta apenas o ranking individual e o de duplas.
 *
 * Sem I/O — recebe documentos já carregados.
 */

import { winRate, normalizeStatsFormat } from '@/modules/performance/domain/playerStats.js';
import { toMillis } from '@/modules/tournament/domain/participation.js';

/** Origem de um jogo agregado. */
export const MY_GAME_SOURCE = Object.freeze({
  GAME_DAY: 'game_day', // dia de jogo do atleta
  CLUB_GAME_DAY: 'club_game_day', // dia de jogo de clube (publicado)
});

/** Id determinístico do espelho de um jogo de dia de jogo do atleta. */
export function gameDayMirrorId(gameDayId, gameId) {
  return `gd_${gameDayId}_${gameId}`;
}

/**
 * Normaliza um documento do espelho `club_event_games` para "meu jogo".
 * Retorna null se não decidido ou se o atleta não participa.
 *
 * @param {string} uid
 * @param {object} m - doc de club_event_games
 * @param {Map<string,string>} [nameByUid] - uid → nome (adversários)
 */
export function mirrorGameToMyGame(uid, m, nameByUid) {
  if (!m || (m.winner_side !== 'a' && m.winner_side !== 'b')) return null;
  const a = Array.isArray(m.side_a_ids) ? m.side_a_ids.filter(Boolean) : [];
  const b = Array.isArray(m.side_b_ids) ? m.side_b_ids.filter(Boolean) : [];
  const mine = a.includes(uid) ? 'a' : (b.includes(uid) ? 'b' : null);
  if (!mine) return null;
  const myUids = mine === 'a' ? a : b;
  const oppUids = mine === 'a' ? b : a;
  const scoreA = Number(m.score_a) || 0;
  const scoreB = Number(m.score_b) || 0;
  const source = m.source === 'athlete_game_day' ? MY_GAME_SOURCE.GAME_DAY : MY_GAME_SOURCE.CLUB_GAME_DAY;
  const resolveName = (id) => (nameByUid && nameByUid.get(id)) || 'Atleta';
  return {
    id: m.id,
    at: toMillis(m.result_recorded_at) || toMillis(m.created_at) || 0,
    // Americano/duplas: sempre duplas; só individual se o espelho marcou singles.
    kind: normalizeStatsFormat(m.kind),
    label: m.event_title || 'Dia de jogo',
    source,
    // Parceiro(s) da MINHA dupla (os do meu lado que não sou eu). Vazio = individual.
    partner: myUids.filter((id) => id !== uid).map(resolveName).join(' / '),
    opponent: oppUids.map(resolveName).join(' / ') || 'Adversário',
    myScore: mine === 'a' ? scoreA : scoreB,
    oppScore: mine === 'a' ? scoreB : scoreA,
    won: m.winner_side === mine,
    walkover: false,
  };
}

/**
 * Normaliza um jogo da fonte `game_days/{id}/games` (schema do organizador:
 * `side_a`/`side_b` = [{ id (participantId), name }]). Resolve o user_id via o
 * mapa de participantes. Retorna null se não decidido ou se o atleta não jogou.
 *
 * @param {string} uid
 * @param {string} gameDayId
 * @param {string} gdTitle
 * @param {object} game
 * @param {Map<string,object>} partById - participantId → participante (com user_id)
 */
export function sourceGameToMyGame(uid, gameDayId, gdTitle, game, partById) {
  if (!game) return null;
  const sa = Number(game.score_a);
  const sb = Number(game.score_b);
  if (game.score_a == null || game.score_b == null || sa === sb) return null; // só decididos
  const sideUids = (side) => (side || []).map((p) => partById.get(p.id)?.user_id).filter(Boolean);
  const aU = sideUids(game.side_a);
  const bU = sideUids(game.side_b);
  const mine = aU.includes(uid) ? 'a' : (bU.includes(uid) ? 'b' : null);
  if (!mine) return null;
  const mySide = mine === 'a' ? game.side_a : game.side_b;
  const oppSide = mine === 'a' ? game.side_b : game.side_a;
  // Dia de jogo do atleta é sempre em DUPLAS (americano/mexicano/rei da quadra).
  // O formato não muda por um parceiro não estar cadastrado — vale o `kind` do
  // jogo (que nasce 'doubles'); a heurística por nº de jogadores foi removida
  // porque contava como individual um jogo de duplas com parceiro avulso.
  const kind = normalizeStatsFormat(game.kind);
  // Parceiro(s) da MINHA dupla: os do meu lado cujo user_id não sou eu (inclui
  // convidados avulsos, que não têm user_id).
  const partner = (mySide || [])
    .filter((p) => partById.get(p.id)?.user_id !== uid)
    .map((p) => p.name)
    .join(' / ');
  return {
    id: gameDayMirrorId(gameDayId, game.id),
    at: toMillis(game.updated_at) || toMillis(game.created_at) || 0,
    kind,
    label: gdTitle || 'Dia de jogo',
    source: MY_GAME_SOURCE.GAME_DAY,
    partner,
    opponent: (oppSide || []).map((p) => p.name).join(' / ') || 'Adversário',
    myScore: mine === 'a' ? sa : sb,
    oppScore: mine === 'a' ? sb : sa,
    won: mine === 'a' ? sa > sb : sb > sa,
    walkover: false,
  };
}

/**
 * Funde uma lista de jogos agregados (dia de jogo) nas estatísticas do jogador,
 * atualizando jogos/vitórias/derrotas/aproveitamento — geral e por formato.
 * Não altera torneios/inscrições/títulos/pódios.
 *
 * @param {object} stats - resultado de buildPlayerStats
 * @param {Array} games - jogos normalizados (mirrorGameToMyGame/sourceGameToMyGame)
 */
export function foldGameDayGamesIntoStats(stats, games) {
  const base = stats || {};
  let played = Number(base.played) || 0;
  let wins = Number(base.wins) || 0;
  let losses = Number(base.losses) || 0;
  const byFormat = {};
  Object.entries(base.byFormat || {}).forEach(([k, v]) => { byFormat[k] = { ...v }; });

  (games || []).forEach((g) => {
    played += 1;
    if (g.won) wins += 1; else losses += 1;
    const fmt = normalizeStatsFormat(g.kind);
    const b = byFormat[fmt] || { played: 0, wins: 0, losses: 0 };
    b.played += 1;
    if (g.won) b.wins += 1; else b.losses += 1;
    b.winRate = winRate(b.wins, b.losses);
    byFormat[fmt] = b;
  });

  return {
    ...base,
    played,
    wins,
    losses,
    winRate: winRate(wins, losses),
    byFormat,
  };
}
