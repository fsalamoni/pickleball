/**
 * Engine de ranking para torneios de pickleball.
 *
 * O ranking é calculado por modalidade, consolidando todos os jogos
 * finalizados (de todas as fases). A classificação é por número de vitórias.
 *
 * Critérios de desempate (em ordem):
 *   1. Maior número de vitórias
 *   2. Saldo de pontos (pontos a favor − pontos contra)
 *   3. Maior número de pontos a favor
 *   4. Menor número de pontos sofridos
 *
 * Para modalidades em formato Americana (rotação), os créditos de cada jogo
 * são distribuídos individualmente para todos os jogadores das duas duplas
 * (o ranking é por jogador, não por dupla).
 */

import { getMatchResult } from './scoring.js';

function emptyStats(id) {
  return {
    participant_id: id,
    played: 0,
    wins: 0,
    losses: 0,
    sets_won: 0,
    sets_lost: 0,
    points_for: 0,
    points_against: 0,
  };
}

function getSideIds(match, sideKey) {
  const idsKey = sideKey === 'a' ? 'side_a_ids' : 'side_b_ids';
  const ids = match?.[idsKey];
  if (Array.isArray(ids) && ids.length > 0) {
    return ids
      .map((id) => String(id).trim())
      .filter((id) => id.length > 0);
  }
  const raw = match?.[sideKey === 'a' ? 'side_a' : 'side_b'];
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((id) => String(id));
  return String(raw)
    .split('+')
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Constrói as estatísticas brutas por participante. Suporta tanto formatos
 * tradicionais (1 ID por lado: singles, doubles, grupos, mata-mata) quanto
 * americana (2 IDs por lado, créditos distribuídos individualmente).
 */
export function buildStandings(matches, participantIds, scoringConfig) {
  const stats = new Map();
  participantIds.forEach((id) => stats.set(String(id), emptyStats(String(id))));

  matches.forEach((m) => {
    const result = getMatchResult(m, scoringConfig);
    if (!result.finished) return;

    const idsA = getSideIds(m, 'a');
    const idsB = getSideIds(m, 'b');
    if (idsA.length === 0 || idsB.length === 0) return;

    const gamesForA = (m.games || []).reduce((s, g) => s + (Number(g?.a) || 0), 0);
    const gamesForB = (m.games || []).reduce((s, g) => s + (Number(g?.b) || 0), 0);

    idsA.forEach((id) => {
      let s = stats.get(id);
      if (!s) {
        s = emptyStats(id);
        stats.set(id, s);
      }
      s.played += 1;
      s.sets_won += result.sets_a;
      s.sets_lost += result.sets_b;
      s.points_for += gamesForA;
      s.points_against += gamesForB;
      if (result.winner === 'a') s.wins += 1;
      else if (result.winner === 'b') s.losses += 1;
    });

    idsB.forEach((id) => {
      let s = stats.get(id);
      if (!s) {
        s = emptyStats(id);
        stats.set(id, s);
      }
      s.played += 1;
      s.sets_won += result.sets_b;
      s.sets_lost += result.sets_a;
      s.points_for += gamesForB;
      s.points_against += gamesForA;
      if (result.winner === 'b') s.wins += 1;
      else if (result.winner === 'a') s.losses += 1;
    });
  });

  return Array.from(stats.values());
}

/**
 * Ordena standings aplicando os critérios oficiais da plataforma:
 *   1. mais vitórias
 *   2. melhor saldo de pontos (PF − PC)
 *   3. mais pontos a favor (PF)
 *   4. menos pontos sofridos (PC)
 */
export function rankStandings(standings) {
  const cmp = (x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    const xBalance = (x.points_for || 0) - (x.points_against || 0);
    const yBalance = (y.points_for || 0) - (y.points_against || 0);
    if (yBalance !== xBalance) return yBalance - xBalance;
    if ((y.points_for || 0) !== (x.points_for || 0)) return (y.points_for || 0) - (x.points_for || 0);
    if ((x.points_against || 0) !== (y.points_against || 0)) return (x.points_against || 0) - (y.points_against || 0);
    return 0;
  };
  const sorted = standings.slice().sort(cmp);
  return sorted.map((s, i) => ({ ...s, position: i + 1 }));
}

export function buildRanking(matches, participantIds, scoringConfig) {
  const standings = buildStandings(matches, participantIds, scoringConfig);
  return rankStandings(standings);
}
