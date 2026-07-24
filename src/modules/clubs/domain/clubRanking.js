/**
 * Domínio puro do ranking interno do clube (flag club_internal_ranking).
 *
 * Agrega os jogos dos dias de jogo (game day) por atleta, contando vitórias,
 * derrotas, saldo de pontos e aproveitamento. É um ranking casual, separado do
 * ranking nacional. Sem I/O.
 *
 * Formato de jogo esperado (mesmo do organizador de game day):
 *   { side_a: [{id,name}|id], side_b: [...], score_a, score_b }
 */

function sideEntries(side) {
  return (side || []).map((p) => (p && typeof p === 'object' ? p : { id: p, name: String(p) })).filter((p) => p && p.id);
}

function ensure(map, entry) {
  if (!map.has(entry.id)) {
    map.set(entry.id, {
      id: entry.id, name: entry.name || 'Jogador',
      games: 0, wins: 0, losses: 0, points_for: 0, points_against: 0,
    });
  }
  const row = map.get(entry.id);
  if (entry.name && row.name === 'Jogador') row.name = entry.name;
  return row;
}

/**
 * Calcula o ranking interno a partir de uma lista de jogos com placar.
 * @param {Array} games
 * @returns {Array<{id,name,games,wins,losses,win_rate,points_for,points_against,points_balance}>}
 */
export function computeClubRanking(games = []) {
  const map = new Map();

  (games || []).forEach((g) => {
    const a = sideEntries(g.side_a);
    const b = sideEntries(g.side_b);
    if (a.length === 0 || b.length === 0) return;
    const sa = g.score_a;
    const sb = g.score_b;
    const decided = sa != null && sb != null && Number(sa) !== Number(sb);
    if (!decided) return;
    const aWon = Number(sa) > Number(sb);

    a.forEach((e) => {
      const r = ensure(map, e);
      r.games += 1; r.points_for += Number(sa) || 0; r.points_against += Number(sb) || 0;
      if (aWon) r.wins += 1; else r.losses += 1;
    });
    b.forEach((e) => {
      const r = ensure(map, e);
      r.games += 1; r.points_for += Number(sb) || 0; r.points_against += Number(sa) || 0;
      if (aWon) r.losses += 1; else r.wins += 1;
    });
  });

  return Array.from(map.values())
    .map((r) => ({ ...r, win_rate: r.games > 0 ? r.wins / r.games : 0, points_balance: r.points_for - r.points_against }))
    .sort((x, y) => (
      y.wins - x.wins
      || y.win_rate - x.win_rate
      || y.points_balance - x.points_balance
      || y.games - x.games
    ));
}
