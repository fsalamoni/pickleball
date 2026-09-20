/**
 * Engine de ranking para torneios de pickleball.
 *
 * O ranking é calculado por modalidade, consolidando todos os jogos
 * finalizados (de todas as fases). A classificação é por número de vitórias.
 *
 * Critérios de desempate (em ordem) — os do regulamento (USA Pickleball
 * 15.B.4), com a fonte única em `tiebreak.js`:
 *   1. Maior número de vitórias
 *   2. CONFRONTO DIRETO entre os empatados
 *   3. Saldo de pontos (pontos a favor − pontos contra)
 *   4. Saldo de pontos NO CONFRONTO DIRETO
 *   5. Maior número de pontos a favor
 *   6. Menor número de pontos sofridos
 *
 * Para modalidades em formato Americana (rotação), os créditos de cada jogo
 * são distribuídos individualmente para todos os jogadores das duas duplas
 * (o ranking é por jogador, não por dupla).
 */

import { getMatchResult } from './scoring.js';
import { buildHeadToHead, rankByOfficialCriteria } from './tiebreak.js';

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
    const configForMatch = typeof scoringConfig === 'function' ? scoringConfig(m) : scoringConfig;
    const result = getMatchResult(m, configForMatch);
    if (!result.finished) return;

    const idsA = getSideIds(m, 'a');
    const idsB = getSideIds(m, 'b');
    if (idsA.length === 0 || idsB.length === 0) return;

    // Pontos a favor/contra: a soma dos games do jogo — ou, num CONFRONTO DE
    // EQUIPES, a soma dos pontos de todas as etapas (gravada no confronto).
    const gamesForA = m.team_confrontation
      ? Number(m.points_a) || 0
      : (m.games || []).reduce((s, g) => s + (Number(g?.a) || 0), 0);
    const gamesForB = m.team_confrontation
      ? Number(m.points_b) || 0
      : (m.games || []).reduce((s, g) => s + (Number(g?.b) || 0), 0);

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
 * Índice de confrontos diretos a partir dos jogos, no formato que
 * `tiebreak.js` espera. Exportado porque a progressão entre fases precisa do
 * mesmo índice — e duas construções do mesmo índice divergiriam um dia.
 */
export function headToHeadFromMatches(matches, scoringConfig) {
  return buildHeadToHead(matches, {
    sideIds: (m, side) => getSideIds(m, side),
    result: (m) => {
      const cfg = typeof scoringConfig === 'function' ? scoringConfig(m) : scoringConfig;
      const r = getMatchResult(m, cfg);
      if (!r.finished || !r.winner) return null;
      const pontos = (lado) => (m.team_confrontation
        ? Number(m[lado === 'a' ? 'points_a' : 'points_b']) || 0
        : (m.games || []).reduce((soma, g) => soma + (Number(g?.[lado]) || 0), 0));
      return { winner: r.winner, pointsA: pontos('a'), pointsB: pontos('b') };
    },
  });
}

/**
 * Ordena standings aplicando os critérios oficiais.
 *
 * `matches` é OPCIONAL: sem eles o confronto direto não pode ser calculado e a
 * classificação sai exatamente como saía antes (vitórias → saldo → pontos a
 * favor → pontos sofridos). Com eles, o confronto direto entra no lugar que o
 * regulamento manda — logo depois das vitórias.
 *
 * @param {Array<object>} standings
 * @param {{ matches?: Array<object>|null, scoringConfig?: any }} [options]
 */
export function rankStandings(standings, options = {}) {
  const headToHead = options.matches
    ? headToHeadFromMatches(options.matches, options.scoringConfig)
    : null;
  const sorted = rankByOfficialCriteria(standings || [], {
    headToHead,
    idOf: (r) => String(r?.participant_id ?? r?.id ?? ''),
  });
  return sorted.map((s, i) => ({ ...s, position: i + 1 }));
}

export function buildRanking(matches, participantIds, scoringConfig) {
  const standings = buildStandings(matches, participantIds, scoringConfig);
  // Os jogos estão em mãos: o confronto direto entra na conta.
  return rankStandings(standings, { matches, scoringConfig });
}
