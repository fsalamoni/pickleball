/**
 * Engine de ranking para torneios de pickleball.
 *
 * O ranking é calculado por modalidade, consolidando todos os jogos
 * finalizados (de todas as fases). Cada participante (jogador ou dupla)
 * acumula pontos conforme a configuração de pontuação do torneio.
 *
 * Critérios de desempate (em ordem):
 *   1. Pontos
 *   2. Confronto direto (head-to-head) — quando aplicável
 *   3. Saldo de sets (ganhos − perdidos)
 *   4. Saldo de pontos (game-points)
 *   5. Sets vencidos
 *   6. Sorteio (mantém ordem original)
 */

import { getMatchPoints, getMatchResult } from './scoring.js';

/**
 * @param {Array<object>} matches - jogos da modalidade
 * @param {Array<string>} participantIds - lista de participantes
 * @param {object} scoringConfig
 * @returns {Array<{
 *   participant_id: string,
 *   played: number,
 *   wins: number,
 *   losses: number,
 *   sets_won: number,
 *   sets_lost: number,
 *   points_for: number,
 *   points_against: number,
 *   ranking_points: number,
 * }>}
 */
export function buildStandings(matches, participantIds, scoringConfig) {
  const stats = new Map();
  participantIds.forEach((id) => {
    stats.set(id, {
      participant_id: id,
      played: 0,
      wins: 0,
      losses: 0,
      sets_won: 0,
      sets_lost: 0,
      points_for: 0,
      points_against: 0,
      ranking_points: 0,
    });
  });

  matches.forEach((m) => {
    const result = getMatchResult(m, scoringConfig);
    if (!result.finished) return;
    const pts = getMatchPoints(m, scoringConfig);
    const a = stats.get(m.side_a);
    const b = stats.get(m.side_b);
    if (!a || !b) return;
    a.played += 1;
    b.played += 1;
    a.sets_won += result.sets_a;
    a.sets_lost += result.sets_b;
    b.sets_won += result.sets_b;
    b.sets_lost += result.sets_a;
    a.ranking_points += pts.a;
    b.ranking_points += pts.b;
    if (result.winner === 'a') {
      a.wins += 1;
      b.losses += 1;
    } else if (result.winner === 'b') {
      b.wins += 1;
      a.losses += 1;
    }
    const gamesForA = (m.games || []).reduce((s, g) => s + (Number(g?.a) || 0), 0);
    const gamesForB = (m.games || []).reduce((s, g) => s + (Number(g?.b) || 0), 0);
    a.points_for += gamesForA;
    a.points_against += gamesForB;
    b.points_for += gamesForB;
    b.points_against += gamesForA;
  });

  return Array.from(stats.values());
}

/**
 * Ordena standings aplicando critérios de desempate.
 * @param {Array} standings
 * @param {Array<object>} matches - usado para head-to-head
 * @param {object} scoringConfig
 */
export function rankStandings(standings, matches, scoringConfig) {
  const cmp = (x, y) => {
    if (y.ranking_points !== x.ranking_points) return y.ranking_points - x.ranking_points;
    // Head-to-head
    const h2h = headToHeadDiff(x.participant_id, y.participant_id, matches, scoringConfig);
    if (h2h !== 0) return h2h;
    const xSetDiff = x.sets_won - x.sets_lost;
    const ySetDiff = y.sets_won - y.sets_lost;
    if (ySetDiff !== xSetDiff) return ySetDiff - xSetDiff;
    const xPtsDiff = x.points_for - x.points_against;
    const yPtsDiff = y.points_for - y.points_against;
    if (yPtsDiff !== xPtsDiff) return yPtsDiff - xPtsDiff;
    if (y.sets_won !== x.sets_won) return y.sets_won - x.sets_won;
    return 0;
  };
  const sorted = standings.slice().sort(cmp);
  return sorted.map((s, i) => ({ ...s, position: i + 1 }));
}

/**
 * Calcula a diferença head-to-head entre dois participantes (vitórias do x − vitórias do y).
 */
export function headToHeadDiff(xId, yId, matches, scoringConfig) {
  let x = 0;
  let y = 0;
  matches.forEach((m) => {
    const involves =
      (m.side_a === xId && m.side_b === yId) || (m.side_a === yId && m.side_b === xId);
    if (!involves) return;
    const r = getMatchResult(m, scoringConfig);
    if (!r.finished || !r.winner) return;
    const xIsA = m.side_a === xId;
    if ((r.winner === 'a' && xIsA) || (r.winner === 'b' && !xIsA)) x += 1;
    else y += 1;
  });
  return y - x; // positivo → y na frente → y antes
}

/**
 * Conveniência: já constrói e ordena.
 */
export function buildRanking(matches, participantIds, scoringConfig) {
  const standings = buildStandings(matches, participantIds, scoringConfig);
  return rankStandings(standings, matches, scoringConfig);
}
