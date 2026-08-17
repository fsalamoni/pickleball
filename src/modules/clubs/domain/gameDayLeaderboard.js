/**
 * Ranking do dia (classificação interna de UM dia de jogo). Sem I/O.
 *
 * Agrega os resultados dos jogos do dia por PARTICIPANTE, calculando jogos,
 * vitórias, derrotas, pontos pró/contra e saldo. É independente do ranking
 * geral da plataforma (`club_event_games`): serve para mostrar, ali mesmo no
 * dia de jogo, como cada atleta se saiu.
 *
 * Chaveado pelo `id` do participante (o mesmo id guardado em `side_a`/`side_b`
 * de cada jogo). Só contam jogos DECIDIDOS (ambos os placares preenchidos).
 *
 * Ordenação (do 1º ao último):
 *  1. maior número de VITÓRIAS;
 *  2. menor número de DERROTAS;
 *  3. melhor SALDO de pontos (pró − contra);
 *  4. menor número de pontos SOFRIDOS (contra);
 *  5. nome (desempate estável em pt-BR).
 */

function makeRow(id, name) {
  return {
    id,
    name: name || 'Jogador',
    games: 0,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  };
}

/**
 * @param {Array<{id:string,name?:string}>} participants  participantes do dia
 * @param {Array} games  jogos do dia (com side_a/side_b/score_a/score_b)
 * @returns {Array<{id,name,games,wins,losses,pointsFor,pointsAgainst,diff}>}
 */
export function computeGameDayLeaderboard(participants, games) {
  const rows = new Map();

  const ensure = (id, name) => {
    if (!id) return null;
    if (!rows.has(id)) rows.set(id, makeRow(id, name));
    const row = rows.get(id);
    // Preenche/melhora o nome se estava genérico.
    if (name && (!row.name || row.name === 'Jogador')) row.name = name;
    return row;
  };

  // Todos os participantes aparecem, mesmo sem jogos.
  (participants || []).forEach((p) => ensure(p?.id, p?.name));

  (games || []).forEach((g) => {
    if (!g) return;
    const a = Number(g.score_a);
    const b = Number(g.score_b);
    const decided = g.score_a != null && g.score_b != null
      && Number.isFinite(a) && Number.isFinite(b);
    if (!decided) return;

    const aWin = a > b;
    const bWin = b > a;

    (g.side_a || []).forEach((p) => {
      const row = ensure(p?.id, p?.name);
      if (!row) return;
      row.games += 1;
      row.pointsFor += a;
      row.pointsAgainst += b;
      if (aWin) row.wins += 1;
      else if (bWin) row.losses += 1;
    });
    (g.side_b || []).forEach((p) => {
      const row = ensure(p?.id, p?.name);
      if (!row) return;
      row.games += 1;
      row.pointsFor += b;
      row.pointsAgainst += a;
      if (bWin) row.wins += 1;
      else if (aWin) row.losses += 1;
    });
  });

  return Array.from(rows.values())
    .map((r) => ({ ...r, diff: r.pointsFor - r.pointsAgainst }))
    .sort((x, y) => {
      if (y.wins !== x.wins) return y.wins - x.wins;
      if (x.losses !== y.losses) return x.losses - y.losses;
      if (y.diff !== x.diff) return y.diff - x.diff;
      if (x.pointsAgainst !== y.pointsAgainst) return x.pointsAgainst - y.pointsAgainst;
      return String(x.name || '').localeCompare(String(y.name || ''), 'pt-BR');
    });
}
