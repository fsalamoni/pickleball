/**
 * Normalização pura do LOG de jogos finalizados para os motores de rating.
 *
 * Espelha exatamente a normalização usada em
 * `ratingService.recomputeAllRatings` (passos 4a/4b): torneios (via
 * `tournament_registrations`) + jogos de dia de jogo (`club_event_games`, com
 * uids reais). Confrontos de EQUIPES em `tournament_matches` são ignorados
 * aqui porque cada etapa já é espelhada em `club_event_games`.
 *
 * Mantido separado e testado para que o ranking "estilo DUPR" reaproveite a
 * MESMA fonte de jogos SEM tocar no caminho do rating ELO existente.
 */

import { MODALITY_FORMAT } from '@/modules/tournament/domain/constants';
import { toMillis } from '@/modules/tournament/domain/participation';

/** uids de uma inscrição; `complete` indica se todos os jogadores têm conta. */
function registrationUids(reg) {
  if (!reg) return { uids: [], complete: false };
  const isDoubles = reg.format === MODALITY_FORMAT.DOUBLES;
  const a = reg.player_a_user_id || null;
  const b = reg.player_b_user_id || null;
  if (isDoubles) {
    return { uids: [a, b].filter(Boolean), complete: Boolean(a && b) };
  }
  return { uids: a ? [a] : [], complete: Boolean(a) };
}

/** Mapeia os ids de inscrição de um lado para uids; completo só se todos resolverem. */
function sideUids(sideIds, regById) {
  const uids = [];
  let complete = true;
  (sideIds || []).forEach((regId) => {
    const resolved = registrationUids(regById.get(regId));
    if (!resolved.complete) complete = false;
    uids.push(...resolved.uids);
  });
  if (uids.length === 0) complete = false;
  return { uids, complete };
}

/**
 * Constrói a lista de jogos normalizados (para os motores de rating) a partir
 * dos jogos finalizados de torneio e de dia de jogo.
 *
 * @param {object} params
 * @param {Array<object>} params.tournamentMatches jogos de `tournament_matches` finalizados
 * @param {Array<object>} params.clubEventMatches jogos de `club_event_games` finalizados
 * @param {Map<string, object>} params.regById inscrições por id (regId → dados)
 * @returns {Array<{ side_a: string[], side_b: string[], winner: 'a'|'b', points_a: number, points_b: number, tournament_id: string|null, at: number }>}
 */
export function normalizeFinishedGames({ tournamentMatches = [], clubEventMatches = [], regById = new Map() }) {
  const out = [];

  // 4a) Jogos de torneio (regId → uids via inscrições).
  tournamentMatches.forEach((m) => {
    if (m.team_confrontation) return; // espelhado em club_event_games
    if (m.winner_side !== 'a' && m.winner_side !== 'b') return;
    const a = sideUids(m.side_a_ids, regById);
    const b = sideUids(m.side_b_ids, regById);
    if (!a.complete || !b.complete) return;
    const games = Array.isArray(m.games) ? m.games : [];
    const pointsA = games.reduce((sum, g) => sum + (Number(g.a) || 0), 0);
    const pointsB = games.reduce((sum, g) => sum + (Number(g.b) || 0), 0);
    out.push({
      side_a: a.uids,
      side_b: b.uids,
      winner: m.winner_side,
      points_a: pointsA,
      points_b: pointsB,
      tournament_id: m.tournament_id || null,
      at: toMillis(m.result_recorded_at) || toMillis(m.updated_at) || toMillis(m.created_at),
    });
  });

  // 4b) Jogos de dia de jogo — uids já são dos próprios atletas.
  clubEventMatches.forEach((m) => {
    if (m.winner_side !== 'a' && m.winner_side !== 'b') return;
    const sideA = Array.isArray(m.side_a_ids) ? m.side_a_ids : [];
    const sideB = Array.isArray(m.side_b_ids) ? m.side_b_ids : [];
    if (sideA.length === 0 || sideB.length === 0) return;
    if (sideA.some((u) => !u) || sideB.some((u) => !u)) return;
    out.push({
      side_a: sideA,
      side_b: sideB,
      winner: m.winner_side,
      points_a: Number(m.score_a) || 0,
      points_b: Number(m.score_b) || 0,
      tournament_id: m.tournament_id || null,
      at: toMillis(m.result_recorded_at) || toMillis(m.created_at) || Date.now(),
    });
  });

  return out;
}
