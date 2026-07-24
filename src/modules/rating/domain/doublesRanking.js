/**
 * Domínio puro do ranking de duplas (flag doubles_ranking).
 *
 * Agrega os jogos de duplas finalizados por PARCERIA (os dois atletas que
 * jogaram juntos no mesmo lado), contando vitórias, derrotas, saldo de pontos e
 * aproveitamento. Sem I/O — recebe os jogos já normalizados.
 *
 * Formato de jogo esperado (mesmo do motor de rating):
 *   { side_a: [uidA1, uidA2], side_b: [uidB1, uidB2], winner: 'a'|'b',
 *     points_a?, points_b? }
 * Só consideram-se lados com exatamente 2 atletas (duplas).
 */

/** Chave estável de uma parceria (par de ids ordenado). */
export function pairKey(id1, id2) {
  return [String(id1), String(id2)].sort().join('__');
}

function ensure(map, ids) {
  const key = pairKey(ids[0], ids[1]);
  if (!map.has(key)) {
    map.set(key, {
      pair_key: key,
      player_ids: [ids[0], ids[1]].slice().sort(),
      games: 0, wins: 0, losses: 0,
      points_for: 0, points_against: 0,
    });
  }
  return map.get(key);
}

/**
 * Calcula o ranking de duplas.
 * @param {Array} matches jogos normalizados
 * @param {{ minGames?: number }} [opts]
 * @returns {Array<{pair_key, player_ids, games, wins, losses, win_rate,
 *   points_for, points_against, points_balance}>} ordenado por vitórias e aproveitamento
 */
export function computeDoublesRanking(matches = [], opts = {}) {
  const minGames = Number.isFinite(opts.minGames) ? opts.minGames : 1;
  const map = new Map();

  (matches || []).forEach((m) => {
    const a = (m.side_a || []).filter(Boolean);
    const b = (m.side_b || []).filter(Boolean);
    if (a.length !== 2 || b.length !== 2) return; // só duplas
    if (m.winner !== 'a' && m.winner !== 'b') return;
    const pa = Number(m.points_a) || 0;
    const pb = Number(m.points_b) || 0;

    const rowA = ensure(map, a);
    const rowB = ensure(map, b);
    rowA.games += 1; rowB.games += 1;
    rowA.points_for += pa; rowA.points_against += pb;
    rowB.points_for += pb; rowB.points_against += pa;
    if (m.winner === 'a') { rowA.wins += 1; rowB.losses += 1; } else { rowB.wins += 1; rowA.losses += 1; }
  });

  return Array.from(map.values())
    .filter((r) => r.games >= minGames)
    .map((r) => ({
      ...r,
      win_rate: r.games > 0 ? r.wins / r.games : 0,
      points_balance: r.points_for - r.points_against,
    }))
    .sort((x, y) => (
      y.wins - x.wins
      || y.win_rate - x.win_rate
      || y.points_balance - x.points_balance
      || y.games - x.games
    ));
}
